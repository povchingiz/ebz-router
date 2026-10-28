import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthCookies, apiRequest, AuthTokens } from './test_helpers';

describe('Concurrency & Locking Mechanisms Audit', () => {
  let tokens: AuthTokens;

  beforeAll(async () => {
    tokens = await getAuthCookies();
  });

  describe('1. Optimistic Locking: Stale version triggers 409 Conflict', () => {
    it('returns 409 Conflict when saving with an obsolete version number', async () => {
      // 1. Fetch current org state
      const orgRes = await apiRequest('/api/orgs?id=ap');
      expect(orgRes.status).toBe(200);
      const currentOrg = Array.isArray(orgRes.data.data) ? orgRes.data.data[0] : orgRes.data.data;
      const currentVersion = currentOrg.version || 1;

      // 2. Submit mutation with stale version (e.g. 99999 or version - 1)
      const staleVersion = currentVersion + 999;
      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          action: 'update_content',
          orgId: 'ap',
          payload: { theme: 'Тест оптимистической блокировки' },
          version: staleVersion,
        },
      });

      expect(res.status).toBe(409);
      expect(res.data).toHaveProperty('error');
      expect(res.data.error).toContain('Конфликт версий');
    });

    it('returns 409 Conflict on EBZ article version mismatch', async () => {
      // Create or update an EBZ article
      const articleId = 'ebz-conflict-test-item';
      const post1 = await apiRequest('/api/ebz', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          article: {
            id: articleId,
            titleRu: 'Статья для теста конфликта версий',
            version: 1,
          },
        },
      });
      expect(post1.status).toBe(200);

      // Now attempt to update with stale version
      const staleUpdate = await apiRequest('/api/ebz', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          article: {
            id: articleId,
            titleRu: 'Конфликтующее обновление',
            version: 999, // Stale version
          },
        },
      });

      expect(staleUpdate.status).toBe(409);
      expect(staleUpdate.data.error).toContain('Конфликт версий');

      // Cleanup
      await apiRequest(`/api/ebz?id=${articleId}`, {
        method: 'DELETE',
        cookie: tokens.superadmin,
      });
    });
  });

  describe('2. Cycle Prevention: Re-parenting validation', () => {
    it('rejects self-parenting with HTTP 400', async () => {
      const orgRes = await apiRequest('/api/orgs?id=ap');
      const currentOrg = Array.isArray(orgRes.data.data) ? orgRes.data.data[0] : orgRes.data.data;
      const currentVersion = currentOrg?.version || 1;

      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          action: 'reparent',
          orgId: 'ap',
          payload: { newParentId: 'ap' },
          version: currentVersion,
        },
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toContain('Организация не может быть родителем самой себя');
    });

    it('rejects circular hierarchy (reparenting to own child/descendant)', async () => {
      // In hierarchy: 'ap' is root, 'apr' is child of 'ap'
      // Trying to make 'apr' the parent of 'ap' must fail with cycle error!
      const orgRes = await apiRequest('/api/orgs?id=ap');
      const currentOrg = Array.isArray(orgRes.data.data) ? orgRes.data.data[0] : orgRes.data.data;

      const res = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: {
          action: 'reparent',
          orgId: 'ap',
          payload: { newParentId: 'apr' },
          version: currentOrg.version || 1,
        },
      });

      expect(res.status).toBe(400);
      expect(res.data.error).toMatch(/циклическ|дочерн/i);
    });
  });

  describe('3. Soft Lock: Concurrent editing protection', () => {
    it('returns HTTP 423 Locked when another operator already holds the lock', async () => {
      const targetOrg = 'me';

      // 1. Methodologist acquires lock
      const lockRes1 = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: { action: 'lock', orgId: targetOrg },
      });
      expect(lockRes1.status).toBe(200);

      // 2. Superadmin attempts to acquire the lock while held by Methodologist
      const lockRes2 = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { action: 'lock', orgId: targetOrg },
      });
      expect(lockRes2.status).toBe(423);
      expect(lockRes2.data.error).toContain('сейчас редактирует оператор');

      // 3. Methodologist releases the lock
      const unlockRes = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.methodologist,
        body: { action: 'unlock', orgId: targetOrg },
      });
      expect(unlockRes.status).toBe(200);

      // 4. Now Superadmin can acquire lock
      const lockRes3 = await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { action: 'lock', orgId: targetOrg },
      });
      expect(lockRes3.status).toBe(200);

      // Cleanup
      await apiRequest('/api/mutate', {
        method: 'POST',
        cookie: tokens.superadmin,
        body: { action: 'unlock', orgId: targetOrg },
      });
    });
  });
});
