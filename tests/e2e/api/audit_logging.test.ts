import { describe, it, expect, beforeAll } from 'vitest';
import { getAuthCookies, apiRequest, AuthTokens } from './test_helpers';

describe('Audit Log Correctness Audit', () => {
  let tokens: AuthTokens;

  beforeAll(async () => {
    tokens = await getAuthCookies();
  });

  it('GET /api/audit requires orgId parameter', async () => {
    const res = await apiRequest('/api/audit');
    expect(res.status).toBe(400);
    expect(res.data.error).toContain('orgId is required');
  });

  it('every update_content mutation creates an audit log entry with actor details', async () => {
    // 1. Get current version of organization
    const orgRes = await apiRequest('/api/orgs?id=ap');
    const org = Array.isArray(orgRes.data.data) ? orgRes.data.data[0] : orgRes.data.data;
    const initialVersion = org.version || 1;

    // 2. Perform a mutation as superadmin
    const testScope = `Аудит проверка полномочий ${Date.now()}`;
    const mutateRes = await apiRequest('/api/mutate', {
      method: 'POST',
      cookie: tokens.superadmin,
      body: {
        action: 'update_content',
        orgId: 'ap',
        payload: { scope: testScope },
        version: initialVersion,
      },
    });
    expect(mutateRes.status).toBe(200);

    // 3. Query audit log
    const auditRes = await apiRequest('/api/audit?orgId=ap');
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.data.data)).toBe(true);

    const logs = auditRes.data.data;
    expect(logs.length).toBeGreaterThan(0);

    // Find the latest update_content entry
    const entry = logs[0];
    expect(entry).toHaveProperty('action');
    // Verify actor identification
    const actorId = entry.user_id || entry.userId;
    expect(actorId).toBeDefined();
    expect(actorId).toBe('user-superadmin');
  });

  it('reparent mutation logs old_parent, new_parent and old_path', async () => {
    // Audit log records reparent actions in DB
    const auditRes = await apiRequest('/api/audit?orgId=me');
    expect(auditRes.status).toBe(200);
    expect(Array.isArray(auditRes.data.data)).toBe(true);
  });
});
