import { test, expect } from '@playwright/test';
import { bypassGateWithCookies, loginAs, captureScreenshot, setupPageMonitors } from './helpers';

test.describe('05: Modals and Advanced Features', () => {
  test.beforeEach(async ({ page }) => {
    await bypassGateWithCookies(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Readiness dashboard: 3 tabs, search filter & RBAC protection', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Open dashboard from sidebar
    const dashboardBtn = page.locator('aside[aria-label="Панель инструментов"] button:has-text("Готовность и наполненность")');
    await expect(dashboardBtn).toBeVisible({ timeout: 10000 });
    await dashboardBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Verify modal opened
    const modal = page.locator('div.fixed.inset-0:has-text("Панель готовности ЕБЗ")');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_05_dashboard_tab_summary.png`);

    // Verify metrics in Tab 1 (Сводка)
    await expect(modal.locator('text=Всего органов')).toBeVisible();
    await expect(modal.locator('text=Средняя готовность базы')).toBeVisible();

    // 2. Switch to Tab 2: Ведомства и акиматы
    const tab2Btn = modal.locator('nav button:has-text("Ведомства и акиматы")');
    await tab2Btn.click({ force: true });
    await page.waitForTimeout(500);

    await expect(modal.locator('input[placeholder*="Найти ведомство"]')).toBeVisible();
    await captureScreenshot(page, `${prefix}_05_dashboard_tab_ministries.png`);

    // Filter table by typing "энерг"
    const searchFilter = modal.locator('input[placeholder*="Найти ведомство"]');
    await searchFilter.fill('энерг');
    await page.waitForTimeout(500);

    // 3. Switch to Tab 3: Конфликты компетенций
    const tab3Btn = modal.locator('nav button:has-text("Конфликты компетенций")');
    await tab3Btn.click({ force: true });
    await page.waitForTimeout(500);

    await expect(modal.locator('text=Проверка настроенных исключений')).toBeVisible();
    await captureScreenshot(page, `${prefix}_05_dashboard_tab_conflicts.png`);

    // 4. Close dashboard
    const closeBtn = modal.locator('footer button:has-text("Закрыть")');
    await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
    await expect(modal).not.toBeVisible();

    // 5. Verify Viewer does NOT have the Dashboard button
    await loginAs(page, 'viewer');
    await page.waitForTimeout(1000);
    await expect(page.locator('aside[aria-label="Панель инструментов"] button:has-text("Готовность и наполненность")')).not.toBeVisible();
  });

  test('AI Router (McpChatModal): prompt input, express routing & RBAC protection', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Open AI router modal
    const routerBtn = page.locator('header button[title^="Открыть ИИ-Маршрутизатор"]');
    await expect(routerBtn).toBeVisible({ timeout: 10000 });
    await routerBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const expressTabBtn = page.locator('div:has-text("ИИ-Маршрутизатор") button:has-text("Экспресс-роутер")');
    await expect(expressTabBtn).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_05_ai_router_opened.png`);

    // 2. Switch to Express tab
    await expressTabBtn.click({ force: true });
    await page.waitForTimeout(500);

    // Enter express prompt
    const promptInput = page.locator('textarea[placeholder*="Вставьте сюда произвольный текст"]').first();
    if (await promptInput.isVisible()) {
      await promptInput.fill('Жалоба на качество республиканской трассы Астана-Алматы, разбитая дорога');
      const routeBtn = page.locator('button:has-text("Определить ведомство")').first();
      await routeBtn.click({ force: true });
      await page.waitForTimeout(1000);

      await captureScreenshot(page, `${prefix}_05_ai_router_express_result.png`);
    }

    // 3. Close AI router modal
    const closeChatBtn = page.locator('button[title*="Закрыть окно"]').first();
    if (await closeChatBtn.isVisible()) {
      await closeChatBtn.click({ force: true });
    } else {
      await routerBtn.click({ force: true });
    }
    await page.waitForTimeout(500);

    // 4. Verify Viewer does NOT see AI Router button
    await loginAs(page, 'viewer');
    await page.waitForTimeout(1000);
    await expect(page.locator('header button[title^="Открыть ИИ-Маршрутизатор"]')).not.toBeVisible();
  });

  test('CreateOrgUserModal: open from drawer, inspect fields and role options', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // Open drawer
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click "Создать пользователя"
    const createUserBtn = drawer.locator('button:has-text("Создать пользователя")');
    await expect(createUserBtn).toBeVisible({ timeout: 5000 });
    await createUserBtn.click({ force: true });
    await page.waitForTimeout(500);

    const userModal = page.locator('section[aria-label="Создать пользователя организации"]');
    await expect(userModal).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_05_create_user_modal.png`);

    // Verify role select has both ORG_ADMIN and VIEWER options
    const roleSelect = userModal.locator('select');
    await expect(roleSelect).toBeVisible();
    await roleSelect.selectOption('VIEWER');
    await roleSelect.selectOption('ORG_ADMIN');

    // Close user modal
    const closeBtn = userModal.locator('button[aria-label="Закрыть"]');
    await closeBtn.click({ force: true });
    await page.waitForTimeout(500);
    await expect(userModal).not.toBeVisible();
  });

  test('Audit log viewer and question Excel template download', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Open drawer
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 2. Open Audit log modal
    const historyBtn = drawer.locator('button[title*="История изменений"]');
    await expect(historyBtn).toBeVisible();
    await historyBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const auditModal = page.locator('section[aria-label="История изменений"]');
    await expect(auditModal).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_05_audit_modal.png`);

    // Close audit modal
    const closeAuditBtn = auditModal.locator('header button').first();
    await closeAuditBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 3. Open Excel Question Import Modal and download template
    const importExcelBtn = drawer.locator('button:has-text("Импорт вопросов (Excel)")');
    if (await importExcelBtn.isVisible()) {
      await importExcelBtn.click({ force: true });
      await page.waitForTimeout(500);

      const importModal = page.locator('div.fixed.inset-0:has-text("Импорт вопросов")');
      await expect(importModal).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, `${prefix}_05_excel_import_modal.png`);

      // Trigger template download
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
      const downloadBtn = importModal.locator('button:has-text("Скачать шаблон")');
      await downloadBtn.click({ force: true });
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe('obrazec_tem_i_voprosov_ebz.xlsx');

      // Close import modal
      const closeImportBtn = importModal.locator('button').first();
      await closeImportBtn.click({ force: true });
    }
  });
});
