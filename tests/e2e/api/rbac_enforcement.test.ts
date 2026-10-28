import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthCookies, apiRequest, AuthTokens } from './test_helpers';

describe('RBAC Server-Side Enforcement Audit', () => {
  let tokens: AuthTokens;

  beforeAll(async () => {
    tokens = await getAuthCookies();
  });

  describe('1. User Creation: Only superadmin creates users', () => {
    it('blocks unauthenticated requests with 403', async () => {
      const res = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.unauth,
        body: { username: 'test_unauth', password: 'p', role: 'VIEWER' },
      });
      expect(res.status).toBe(403);
    });

    it('blocks gate-only requests with 403', async () => {
      const res = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.gateOnly,
        body: { username: 'test_gate', password: 'p', role: 'VIEWER' },
      });
      expect(res.status).toBe(403);
    });

    it('blocks viewer (operator) with 403', async () => {
      const res = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.viewer,
        body: { username: 'test_viewer', password: 'p', role: 'VIEWER' },
      });
      expect(res.status).toBe(403);
    });

    it('blocks methodologist (ORG_ADMIN) with 403', async () => {
      const res = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: { username: 'test_meth', password: 'p', role: 'VIEWER' },
      });
      expect(res.status).toBe(403);
    });

    it('allows superadmin to create user with 200', async () => {
      const uname = `audit_user_${Date.now()}`;
      const res = await apiRequest('/api/auth/users', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          username: uname,
          password: 'Password123!',
          fullName: 'Audit Test User',
          role: 'VIEWER',
        },
      });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      expect(res.data.user.username).toBe(uname);
    });
  });

  describe('2. Structure & Reparenting: Methodologist cannot change structure/parent', () => {
    it('FIXED: Methodologist cannot reparent (403)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'reparent',
          orgId: 'me',
          payload: { newParentId: 'apr' },
          version: 1,
        },
      });

      expect(res.status).toBe(403);
    });

    it('FIXED: Methodologist cannot convert dept to org (403)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'convert_dept_to_org',
          payload: { parentOrgId: 'me', deptId: 999999 },
        },
      });
      expect(res.status).toBe(403);
    });

    it('FIXED: Methodologist cannot create child orgs (403)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'create_org',
          payload: {
            name: 'Новый подотчетный отдел Минэнерго',
            parentId: 'me',
          },
        },
      });
      expect(res.status).toBe(403);
    });

    it('FIXED: Methodologist cannot convert org to dept (403)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: { action: 'convert_org_to_dept', payload: { orgId: 'me', targetParentId: 'ap' } },
      });
      expect(res.status).toBe(403);
    });

    it('superadmin is still allowed to create orgs', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { action: 'create_org', payload: { name: 'RBAC Probe Org', parentId: 'me' } },
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('3. CSV / Bulk Import: Only superadmin imports CSV', () => {
    it('FIXED: Methodologist cannot call import_csv via /api/mutate (403)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'import_csv',
          payload: {
            items: [
              {
                id: 'org-test-csv-audit',
                name: 'Audit CSV Test',
                parentId: 'me',
              },
            ],
          },
        },
      });
      expect(res.status).toBe(403);
    });

    it('AUDIT DEFECT: Methodologist can call /api/bulk to update records', async () => {
      const res = await apiRequest('/api/bulk', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          dryRun: true,
          rows: [
            {
              'ID организации': 17862,
              'Краткое наименование (RU)': 'Минэнерго РК (Dry Run)',
            },
          ],
        },
      });
      // Methodologist is permitted by POST /api/bulk
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  describe('4. Readiness & Conflicts Dashboard: Only superadmin sees dashboards', () => {
    it('blocks methodologist from seeing readiness dashboard with 403', async () => {
      const res = await apiRequest('/api/analytics/readiness', {
        cookie: tokens.methodologist,
      });
      expect(res.status).toBe(403);
    });

    it('blocks methodologist from seeing conflicts detector with 403', async () => {
      const res = await apiRequest('/api/analytics/conflicts', {
        cookie: tokens.methodologist,
      });
      expect(res.status).toBe(403);
    });

    it('allows superadmin to see readiness dashboard', async () => {
      const res = await apiRequest('/api/analytics/readiness', {
        cookie: tokens.superadmin,
      });
      expect(res.status).toBe(200);
      expect(res.data.summary.total).toBeGreaterThan(0);
    });

    it('allows superadmin to see conflicts detector', async () => {
      const res = await apiRequest('/api/analytics/conflicts', {
        cookie: tokens.superadmin,
      });
      expect(res.status).toBe(200);
      expect(res.data.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('5. Jurisdiction boundary enforcement', () => {
    it('methodologist of Minenergo cannot edit MVD organization', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'update_content',
          orgId: 'mvd',
          payload: { name: 'Unauthorized rename' },
          version: 1,
        },
      });
      expect(res.status).toBe(403);
      expect(res.data.error).toMatch(/вне вашей юрисдикции|на одном уровне с вашим ведомством/);
    });

    it('methodologist cannot change showOnFrontend (restricted to GLOBAL_ADMIN)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: {
          action: 'update_content',
          orgId: 'me',
          payload: { showOnFrontend: false },
          version: 1,
        },
      });
      // The update may succeed or conflict, but showOnFrontend in response must NOT be overridden by methodologist
      if (res.status === 200) {
        expect(res.data.org.showOnFrontend).not.toBe(false);
      }
    });
  });
});
