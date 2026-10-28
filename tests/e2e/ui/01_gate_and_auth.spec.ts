import { test, expect } from '@playwright/test';
import {
  GATE_PASSWORD,
  USERS,
  setupPageMonitors,
  captureScreenshot,
  bypassGateWithCookies,
  loginAs,
} from './helpers';

test.describe('01 - Site Gate & Authentication', () => {
  test('Site Gate: lock screen, wrong password rejection, correct unlock, persistence', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    // 1. Clear cookies to see initial gate
    await page.context().clearCookies();
    await page.goto('/');

    // Verify Gate Screen is displayed
    const gateTitle = page.locator('text=Закрытый контур демонстрации');
    await expect(gateTitle).toBeVisible({ timeout: 5000 });
    await page.evaluate(() => localStorage.setItem('site_gate_pass', 'unlocked_2026'));
    await page.reload();
    await expect(gateTitle).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_01_gate_locked.png`);

    // 2. Submit wrong password
    const pwdInput = page.locator('input[type="password"]');
    await pwdInput.fill('wrong_password_123');
    await page.locator('button[type="submit"]').click();

    // Check error message
    const errorText = page.locator('text=Неверный пароль доступа к контуру');
    await expect(errorText).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_01_gate_wrong_password.png`);

    // 3. Submit correct password
    await pwdInput.fill(GATE_PASSWORD);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/gate') && r.status() === 200),
      page.locator('button[type="submit"]').click(),
    ]);

    // Verify main app loaded
    await expect(page.locator('text=Единая база знаний')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(page, `${prefix}_01_gate_unlocked_main.png`);

    // 4. Verify persistence on reload
    await page.reload();
    await expect(page.locator('text=Единая база знаний')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Закрытый контур демонстрации')).not.toBeVisible();

    // An expired signed cookie must return the UI to the gate despite stale localStorage.
    await page.context().clearCookies();
    await page.evaluate(() => fetch('/api/orgs'));
    await expect(gateTitle).toBeVisible({ timeout: 5000 });
  });

  test('Auth: Login as Superadmin, Methodologist, Viewer and Profile Switcher', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    await bypassGateWithCookies(page);

    // 1. Login as Superadmin
    await loginAs(page, 'superadmin');

    // Verify Superadmin indicator
    await expect(page.locator('header button[aria-label*="Супер-админ"]').first()).toBeVisible();
    await expect(page.locator('header button[title^="Открыть ИИ-Маршрутизатор"]')).toBeVisible();
    if (!isMobile) {
      await expect(page.locator('button:has-text("Готовность и наполненность")')).toBeVisible();
    }
    await captureScreenshot(page, `${prefix}_01_auth_superadmin_view.png`);

    // 2. Switch to Methodologist (admin_minenergo)
    await loginAs(page, 'methodologist');

    // Verify Methodologist badge
    await expect(page.locator('header button[aria-label*="Минэнерго РК"]').first()).toBeVisible();
    // Methodologist must NOT see AI Router button
    await expect(page.locator('header button[title^="Открыть ИИ-Маршрутизатор"]')).not.toBeVisible();
    // Methodologist must NOT see Readiness Dashboard button
    await expect(page.locator('button:has-text("Готовность и наполненность")')).not.toBeVisible();
    await captureScreenshot(page, `${prefix}_01_auth_methodologist_view.png`);

    // 3. Switch to Viewer (viewer)
    await loginAs(page, 'viewer');

    // Verify Viewer badge
    await expect(page.locator('header button[aria-label*="Только чтение"]').first()).toBeVisible();
    await expect(page.locator('header button[title^="Открыть ИИ-Маршрутизатор"]')).not.toBeVisible();
    await expect(page.locator('button:has-text("Готовность и наполненность")')).not.toBeVisible();
    await captureScreenshot(page, `${prefix}_01_auth_viewer_view.png`);

    // 4. Test Logout
    const profileBtn = page.locator('header button[aria-label*="Только чтение"]').first();
    await profileBtn.click({ force: true });
    const logoutBtn = page.locator('button:has-text("Выйти из учетной записи")');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Verify "Войти" button appears
    await expect(page.locator('header button:has-text("Войти")')).toBeVisible();
    await captureScreenshot(page, `${prefix}_01_auth_logged_out.png`);
  });
});
