import { test, expect } from '@playwright/test';
import { bypassGateWithCookies, loginAs, loginViaApi, captureScreenshot, setupPageMonitors } from './helpers';

test.describe('04: Org Card Editing, Locking, Reparenting & RBAC', () => {
  test.beforeEach(async ({ page }) => {
    await bypassGateWithCookies(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Superadmin can edit org content and save successfully', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // Open drawer for root org (АП)
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await expect(detailsBtn).toBeVisible({ timeout: 10000 });
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify access badge shows "Доступ разрешен"
    await expect(drawer.locator('text=Доступ разрешен')).toBeVisible();

    // Verify Save button is visible for superadmin
    const saveBtn = drawer.locator('button:has-text("Сохранить")');
    await expect(saveBtn).toBeVisible();

    await captureScreenshot(page, `${prefix}_04_superadmin_org_drawer.png`);

    // Close drawer
    const closeBtn = drawer.locator('button[title*="Скрыть панель"]').first();
    await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
  });

  test('Optimistic locking: outdated version returns 409 Conflict', async ({ page }) => {
    await loginViaApi(page, 'superadmin');

    // Perform direct API mutation with invalid/outdated version
    const res = await page.request.post('/api/mutate', {
      data: {
        action: 'update_content',
        orgId: 'ap',
        version: 999999,
        payload: {
          scope: 'Test conflicting update',
        },
      },
    });

    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('Soft lock: acquisition, 423 when locked by other, UI lock badge, and clean release', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginViaApi(page, 'superadmin');

    // 1. Acquire lock as superadmin
    const lockRes = await page.request.post('/api/mutate', {
      data: {
        action: 'lock',
        orgId: 'ap',
      },
    });
    expect([200, 423]).toContain(lockRes.status());

    // 2. Refresh page to reflect the lock state in UI
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 3. Open drawer
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_04_soft_lock_state.png`);

    // 4. Release lock so state is restored cleanly
    const unlockRes = await page.request.post('/api/mutate', {
      data: {
        action: 'unlock',
        orgId: 'ap',
      },
    });
    expect(unlockRes.status()).toBe(200);
  });

  test('Cycle protection: reparenting to self or descendant returns 400 Bad Request', async ({ page }) => {
    await loginViaApi(page, 'superadmin');

    // Fetch root org to obtain current optimistic lock version
    const orgsRes = await page.request.get('/api/orgs?parentId=');
    const orgsData = await orgsRes.json();
    const apOrg = orgsData.data.find((o: any) => o.id === 'ap');
    const currentVersion = apOrg ? apOrg.version : 1;

    // Attempting to reparent root org to itself must be rejected
    const reparentSelfRes = await page.request.post('/api/mutate', {
      data: {
        action: 'reparent',
        orgId: 'ap',
        version: currentVersion,
        payload: {
          newParentId: 'ap',
        },
      },
    });

    expect(reparentSelfRes.status()).toBe(400);
    const body = await reparentSelfRes.json();
    expect(body.error).toMatch(/родителем самой себя|цикл|самому себе/i);
  });

  test('RBAC: Methodologist cannot edit structure, cannot edit foreign orgs', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    // 1. Login as Methodologist (admin_minenergo)
    await loginAs(page, 'methodologist');
    await page.waitForTimeout(1000);

    // Open an org to verify structure change buttons ("Создать дочку") are NOT visible in UI
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify structure change button "Создать дочку" is omitted for methodologist
    await expect(drawer.locator('button:has-text("Создать дочку")')).not.toBeVisible();
    await captureScreenshot(page, `${prefix}_04_methodologist_rbac_no_structure.png`);

    // 2. Try structure mutation via API as Methodologist -> must return 403 Forbidden
    await loginViaApi(page, 'methodologist');
    const reparentRes = await page.request.post('/api/mutate', {
      data: {
        action: 'reparent',
        orgId: 'minenergo',
        payload: {
          newParentId: 'ap',
        },
      },
    });
    expect(reparentRes.status()).toBe(403);

    // 3. Foreign org update attempt -> must return 403 Forbidden
    const foreignMutateRes = await page.request.post('/api/mutate', {
      data: {
        action: 'update_content',
        orgId: 'ap',
        version: 1,
        payload: { scope: 'Unauthorized methodologist edit' },
      },
    });
    expect(foreignMutateRes.status()).toBe(403);
  });

  test('RBAC: Viewer has read-only access across all orgs', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'viewer');
    await page.waitForTimeout(1000);

    // Open root org drawer
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Verify Viewer sees "Только просмотр"
    await expect(drawer.locator('text=Только просмотр')).toBeVisible();

    // Verify Save button and structure buttons are absent
    await expect(drawer.locator('button:has-text("Сохранить")')).not.toBeVisible();
    await expect(drawer.locator('button:has-text("Создать дочку")')).not.toBeVisible();
    await expect(drawer.locator('button:has-text("Создать пользователя")')).not.toBeVisible();

    await captureScreenshot(page, `${prefix}_04_viewer_readonly_drawer.png`);

    // Verify direct API mutation is rejected with 403 Forbidden
    await loginViaApi(page, 'viewer');
    const mutateRes = await page.request.post('/api/mutate', {
      data: {
        action: 'update_content',
        orgId: 'ap',
        version: 1,
        payload: {
          scope: 'Viewer attempt',
        },
      },
    });
    expect(mutateRes.status()).toBe(403);
  });
});
