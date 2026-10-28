import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthCookies, apiRequest, AuthTokens, GATE_PASSWORD } from './test_helpers';

describe('Route x Method x Role Matrix Audit', () => {
  let tokens: AuthTokens;

  beforeAll(async () => {
    tokens = await getAuthCookies();
  });

  // 1. Health
  describe('GET /api/health', () => {
    it.each(['unauth', 'gateOnly', 'viewer', 'methodologist', 'superadmin'] as const)(
      'accessible by %s',
      async (role) => {
        const res = await apiRequest('/api/health', { cookie: tokens[role] });
        expect(res.status).toBe(200);
        expect(res.data).toHaveProperty('status', 'pass');
        expect(res.data).toHaveProperty('database');
      }
    );
  });

  // 2. Gate
  describe('Gate Endpoints (/api/gate)', () => {
    it('GET /api/gate reports unlocked status for noGate vs gateOnly', async () => {
      const resUnauth = await apiRequest('/api/gate', { cookie: tokens.noGate });
      expect(resUnauth.status).toBe(200);
      expect(resUnauth.data).toEqual({ unlocked: false });

      const resGate = await apiRequest('/api/gate', { cookie: tokens.gateOnly });
      expect(resGate.status).toBe(200);
      expect(resGate.data).toEqual({ unlocked: true });
    });

    it('POST /api/gate validates password correctly', async () => {
      const wrong = await apiRequest('/api/gate', {
        method: 'POST',
        body: { password: 'wrongpassword123' },
      });
      expect(wrong.status).toBe(401);
      expect(wrong.data.success).toBe(false);

      const right = await apiRequest('/api/gate', {
        method: 'POST',
        body: { password: GATE_PASSWORD },
      });
      expect(right.status).toBe(200);
      expect(right.data.success).toBe(true);
    });
  });

  // 3. Auth
  describe('Auth Endpoints (/api/auth/*)', () => {
    it('FIXED: GET /api/auth/me never returns credentials', async () => {
      const res = await apiRequest('/api/auth/me', { cookie: tokens.unauth });
      expect(res.status).toBe(200);
      expect(res.data.ok).toBe(true);
      expect(res.data.testAccounts).toBeUndefined();
      expect(JSON.stringify(res.data)).not.toMatch(/admin8391|guest1048|energo2026|password/i);
    });

    it('POST /api/auth/users: RBAC check - only superadmin should create users', async () => {
      // Unauth
      const rUnauth = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.unauth,
        body: { username: 'test_u1', password: 'p', role: 'VIEWER' },
      });
      expect(rUnauth.status).toBe(403);

      // Gate-only
      const rGate = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.gateOnly,
        body: { username: 'test_u2', password: 'p', role: 'VIEWER' },
      });
      expect(rGate.status).toBe(403);

      // Viewer
      const rViewer = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.viewer,
        body: { username: 'test_u3', password: 'p', role: 'VIEWER' },
      });
      expect(rViewer.status).toBe(403);

      // Methodologist (ORG_ADMIN)
      const rMeth = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: { username: 'test_u4', password: 'p', role: 'VIEWER' },
      });
      expect(rMeth.status).toBe(403);

      // Superadmin
      const rAdmin = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { username: `test_user_${Date.now()}`, password: 'password123', role: 'VIEWER' },
      });
      expect(rAdmin.status).toBe(200);
      expect(rAdmin.data.status).toBe('ok');
    });
  });

  // 4. Orgs
  describe('GET /api/orgs', () => {
    it.each(['unauth', 'gateOnly', 'viewer', 'methodologist', 'superadmin'] as const)(
      'accessible by %s (No gate/session enforcement server-side)',
      async (role) => {
        const res = await apiRequest('/api/orgs?root_only=true', { cookie: tokens[role] });
        expect(res.status).toBe(200);
        expect(res.data.status).toBe('ok');
        expect(Array.isArray(res.data.data)).toBe(true);
      }
    );

    it('BUG: ?parentId parameter from OpenAPI is ignored vs ?parent_id', async () => {
      // OpenAPI spec says query parameter is 'parentId', but implementation reads 'parent_id'
      const openApiParamRes = await apiRequest('/api/orgs?parentId=ap');
      const implParamRes = await apiRequest('/api/orgs?parent_id=ap');
      expect(implParamRes.status).toBe(200);
      expect(implParamRes.data.data.length).toBeGreaterThan(0);
      // Using openApi spec's parentId returns fallback/all orgs rather than filtered children!
      expect(openApiParamRes.data.data.length).not.toBe(implParamRes.data.data.length);
    });
  });

  // 5. Analytics Readiness & Conflicts
  describe('Analytics Endpoints (/api/analytics/*)', () => {
    it.each(['unauth', 'gateOnly', 'viewer', 'methodologist'] as const)(
      'readiness dashboard blocked with 403 for %s',
      async (role) => {
        const res = await apiRequest('/api/analytics/readiness', { cookie: tokens[role] });
        expect(res.status).toBe(403);
      }
    );

    it('readiness dashboard allowed for superadmin', async () => {
      const res = await apiRequest('/api/analytics/readiness', { cookie: tokens.superadmin });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('summary');
      expect(res.data).toHaveProperty('ministries');
    });

    it.each(['unauth', 'gateOnly', 'viewer', 'methodologist'] as const)(
      'conflicts detector blocked with 403 for %s',
      async (role) => {
        const res = await apiRequest('/api/analytics/conflicts', { cookie: tokens[role] });
        expect(res.status).toBe(403);
      }
    );

    it('conflicts detector allowed for superadmin', async () => {
      const res = await apiRequest('/api/analytics/conflicts', { cookie: tokens.superadmin });
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('conflicts');
      expect(res.data).toHaveProperty('totalConflicts');
    });
  });

  // 6. EBZ Knowledge Base
  describe('EBZ Endpoints (/api/ebz)', () => {
    it('GET /api/ebz is accessible without auth', async () => {
      const res = await apiRequest('/api/ebz');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(Array.isArray(res.data.data)).toBe(true);
    });

    it('POST /api/ebz blocks viewer role', async () => {
      const res = await apiRequest('/api/ebz', {
        method: 'POST',
        cookie: tokens.viewer,
        body: { titleRu: 'Тестовая статья' },
      });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/ebz blocks viewer and methodologist', async () => {
      const resViewer = await apiRequest('/api/ebz?id=nonexistent', {
        method: 'DELETE',
        cookie: tokens.viewer,
      });
      expect(resViewer.status).toBe(403);

      const resMeth = await apiRequest('/api/ebz?id=nonexistent', {
        method: 'DELETE',
        cookie: tokens.methodologist,
      });
      expect(resMeth.status).toBe(403);
    });
  });

  // 7. Bulk API
  describe('Bulk Endpoints (/api/bulk)', () => {
    it('GET /api/bulk exports xlsx without auth (leak of bulk registry)', async () => {
      const res = await apiRequest('/api/bulk?limit=5');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
    });

    it('POST /api/bulk blocks viewer role', async () => {
      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.viewer,
        body: { rows: [] },
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/bulk allows methodologist (ORG_ADMIN) to update records in jurisdiction', async () => {
      // Minenergo ID: 17862
      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          dryRun: true,
          rows: [
            {
              'ID организации': 17862,
              'Краткое наименование (RU)': 'Минэнерго РК (Пакетный тест)',
              'Полное официальное наименование (RU)': 'Министерство энергетики Республики Казахстан',
            },
          ],
        },
      });
      expect(res.status).toBe(200);
      expect(res.data.processed).toBe(1);
    });
  });

  // 8. Mutate API
  describe('Mutate Endpoints (/api/mutate)', () => {
    it('POST /api/mutate blocks viewer from mutating', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.viewer,
        body: {
          action: 'update_content',
          orgId: 'me',
          payload: { name: 'New Name' },
          version: 1,
        },
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/mutate allows methodologist to update content in own org', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'update_content',
          orgId: 'me',
          payload: { scope: 'Тестовая сфера ведения Минэнерго' },
          version: 1,
        },
      });
      expect([200, 409]).toContain(res.status); // 200 or 409 conflict
    });

    it('POST /api/mutate blocks methodologist from mutating outside org', async () => {
      // Trying to edit MVD ('mvd') when logged in as Minenergo
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'update_content',
          orgId: 'mvd',
          payload: { name: 'Hacked MVD' },
          version: 1,
        },
      });
      expect(res.status).toBe(403);
    });
  });

  // 9. Locations
  describe('Locations (/api/locations)', () => {
    it('GET /api/locations returns 20 root regions for unauth', async () => {
      const res = await apiRequest('/api/locations');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.locations.length).toBeGreaterThan(15);
    });

    it('GET /api/locations?query=астана searches correctly', async () => {
      const res = await apiRequest('/api/locations?query=астана');
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.locations.length).toBeGreaterThan(0);
      expect(res.data.locations[0].name.toLowerCase()).toContain('астана');
    });
  });

  // 10. Audit
  describe('Audit (/api/audit)', () => {
    it('GET /api/audit requires orgId query param', async () => {
      const res = await apiRequest('/api/audit');
      expect(res.status).toBe(400);
    });

    it('GET /api/audit returns logs for orgId', async () => {
      const res = await apiRequest('/api/audit?orgId=me');
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      expect(Array.isArray(res.data.data)).toBe(true);
    });
  });

  // 11. MCP Protocol
  describe('MCP Protocol (/api/mcp)', () => {
    it('POST /api/mcp handles initialize and tools/list', async () => {
      const initRes = await apiRequest('/api/mcp', {
        method: 'POST',
        body: { jsonrpc: '2.0', id: '1', method: 'initialize' },
      });
      expect(initRes.status).toBe(200);
      expect(initRes.data.result.serverInfo.name).toBe('eotinish-ebz-router-mcp');

      const listRes = await apiRequest('/api/mcp', {
        method: 'POST',
        body: { jsonrpc: '2.0', id: '2', method: 'tools/list' },
      });
      expect(listRes.status).toBe(200);
      expect(listRes.data.result.tools).toHaveLength(5);
    });
  });
});
