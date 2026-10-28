import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { getAuthCookies, apiRequest, AuthTokens } from './test_helpers';

describe('Security & Vulnerability Audit', () => {
  let tokens: AuthTokens;

  beforeAll(async () => {
    tokens = await getAuthCookies();
  });

  describe('1. Secrets, Signature Forgery & Auth Bypass (FIXED)', () => {
    it('FIXED: token signed with the old hardcoded fallback secret is rejected', async () => {
      const FALLBACK_SECRET = 'ebz-router-super-secret-key-2026-auth';
      const forgedSession = {
        userId: 'forged-admin',
        username: 'forged_superadmin',
        fullName: 'Forged Admin',
        role: 'GLOBAL_ADMIN',
        orgId: 'ap',
        expiresAt: Date.now() + 3600000,
      };
      const payload = Buffer.from(JSON.stringify(forgedSession)).toString('base64');
      const signature = crypto.createHmac('sha256', FALLBACK_SECRET).update(payload).digest('hex');
      const forgedCookie = `${tokens.gateOnly}; ebz_session=${payload}.${signature}`;

      const res = await apiRequest('/api/analytics/readiness', { cookie: forgedCookie });
      expect([401, 403]).toContain(res.status);

      const me = await apiRequest('/api/auth/me', { cookie: forgedCookie });
      expect(me.data.user).toBeNull();
    });

    it('FIXED: body.user role bypass in POST /api/mutate is gone (401 without session)', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        body: {
          action: 'create_org',
          user: { id: 'anon', name: 'Anonymous Attacker', role: 'superadmin' },
          payload: { name: 'Hacked Backdoor Org', parentId: 'ap' },
        },
      });
      expect(res.status).toBe(401);

      // ...и не повышает права реальной сессии viewer
      const viewer = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.viewer,
        body: {
          action: 'create_org',
          user: { id: 'v', name: 'V', role: 'superadmin' },
          payload: { name: 'Hacked Backdoor Org', parentId: 'ap' },
        },
      });
      expect(viewer.status).toBe(403);
    });

    it('FIXED: GET /api/auth/me does not leak passwords', async () => {
      const res = await apiRequest('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.data.testAccounts).toBeUndefined();
      expect(JSON.stringify(res.data)).not.toMatch(/"password"/);
    });

    it('FIXED: /api/ebz write and delete require auth', async () => {
      const post = await apiRequest('/api/ebz', {
        method: 'POST',
        body: { article: { id: 'sec-probe', titleRu: 'probe' } },
      });
      expect(post.status).toBe(401);
      const del = await apiRequest('/api/ebz?id=sec-probe', { method: 'DELETE' });
      expect(del.status).toBe(401);
    });
  });

  describe('1b. Site gate enforced server-side (middleware)', () => {
    it('API without gate cookie is rejected with 401', async () => {
      for (const ep of ['/api/orgs', '/api/ebz', '/api/auth/me', '/api/bulk']) {
        const res = await apiRequest(ep, { cookie: tokens.noGate });
        expect(res.status, ep).toBe(401);
      }
    });

    it('/api/health and /api/gate stay reachable without gate cookie', async () => {
      expect((await apiRequest('/api/health', { cookie: tokens.noGate })).status).toBe(200);
      expect((await apiRequest('/api/gate', { cookie: tokens.noGate })).status).toBe(200);
    });

    it('forged / legacy gate cookie value is rejected', async () => {
      for (const v of ['unlocked_2026', '9999999999999.deadbeef', '1.abc']) {
        const res = await apiRequest('/api/orgs', { cookie: `site_gate_pass=${v}` });
        expect(res.status, v).toBe(401);
      }
    });

    it('pages without gate cookie are not served (rewritten to empty lock page)', async () => {
      const res = await apiRequest('/', { cookie: tokens.noGate });
      expect(res.status).toBe(200);
      expect(String(res.data)).not.toContain('Структура');
    });
  });

  describe('2. SQL Injection Resistance & Input Probing', () => {
    it('probes search endpoint /api/orgs?q= with SQL injection strings', async () => {
      const sqlPayloads = [
        `' OR '1'='1`,
        `" OR "1"="1`,
        `'; DROP TABLE platform.test_sqli; --`,
        `1 UNION SELECT null, null, null--`,
      ];

      for (const payload of sqlPayloads) {
        const res = await apiRequest(`/api/orgs?q=${encodeURIComponent(payload)}`);
        // Parameterized queries should handle this without 500 error
        expect([200, 404]).toContain(res.status);
      }
    });

    it('probes /api/bulk?limit= with non-numeric input', async () => {
      // In src/app/api/bulk/route.ts: parseInt(searchParams.get('limit') || '500', 10)
      // When limit is 'abc', parseInt returns NaN, query has 'LIMIT NaN'
      // It falls back to in-memory store rather than crashing
      const res = await apiRequest('/api/bulk?limit=invalid_number');
      expect(res.status).toBe(200);
    });
  });

  describe('3. XSS in Stored Content', () => {
    it('FIXED: angle brackets in persisted strings are escaped', async () => {
      const xssPayload = `<script>alert('XSS_AUDIT')</script><img src=x onerror=alert(1)>`;
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { action: 'update_content', orgId: 'ap', payload: { scope: xssPayload }, version: 1 },
      });
      if (res.status === 200) {
        expect(res.data.org.scope).not.toContain('<script>');
        expect(res.data.org.scope).toContain('&lt;script&gt;');
      } else {
        expect([409, 423]).toContain(res.status);
      }
    });
  });

  // Тесты лимитера используют уникальный X-Forwarded-For (сервер запущен с TRUST_PROXY=true),
  // чтобы не заблокировать общий адрес остальных тестов и UI QA.
  describe('4. Rate Limiting (FIXED)', () => {
    it('/api/gate returns 429 after repeated wrong passwords', async () => {
      const ip = '203.0.113.10';
      const statuses: number[] = [];
      for (let i = 0; i < 15; i++) {
        const r = await apiRequest('/api/gate', {
          method: 'POST',
          headers: { 'X-Forwarded-For': ip },
          body: { password: `bruteforce_${i}` },
        });
        statuses.push(r.status);
      }
      expect(statuses).toContain(429);
      expect(statuses[0]).toBe(401);
    });

    it('/api/auth/login returns 429 after repeated failures', async () => {
      const ip = '203.0.113.11';
      const user = `probe_${Date.now()}`;
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        const r = await apiRequest('/api/auth/login', {
          method: 'POST',
          headers: { 'X-Forwarded-For': ip },
          body: { username: user, password: 'wrong_password' },
        });
        statuses.push(r.status);
      }
      expect(statuses).toContain(429);
      expect(statuses[0]).toBe(401);
    });
  });

  describe('5. CORS and Security Headers (FIXED)', () => {
    it('no wildcard CORS; foreign origin gets no ACAO header', async () => {
      const res = await apiRequest('/api/health', { headers: { Origin: 'https://evil.example' } });
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('preflight from foreign origin is rejected', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
      });
      expect(res.status).toBe(403);
    });

    it('cross-origin state-changing request is blocked', async () => {
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        headers: { Origin: 'https://evil.example' },
        body: { action: 'lock', orgId: 'ap' },
      });
      expect(res.status).toBe(403);
    });

    it('CSP, frame-ancestors and nosniff are set', async () => {
      const res = await apiRequest('/api/health');
      const csp = res.headers.get('content-security-policy') || '';
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      // HSTS выставляется только при NODE_ENV=production
      if (process.env.NODE_ENV === 'production') {
        expect(res.headers.get('strict-transport-security')).toContain('max-age=');
      }
    });
  });
});
