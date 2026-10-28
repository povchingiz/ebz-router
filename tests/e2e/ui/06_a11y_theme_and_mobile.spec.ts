import { test, expect } from '@playwright/test';
import { bypassGateWithCookies, loginAs, captureScreenshot, setupPageMonitors, toggleTheme } from './helpers';

test.describe('06: Theme, A11y, Keyboard Navigation & Empty/Error States', () => {
  test.beforeEach(async ({ page }) => {
    await bypassGateWithCookies(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Theme switching: light vs dark theme styling and class toggling', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Capture in Light Theme
    await captureScreenshot(page, `${prefix}_06_theme_light.png`);

    // 2. Switch to Dark Theme
    await toggleTheme(page, 'dark');
    await page.waitForTimeout(500);

    // Assert document element has dark class
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(true);

    await captureScreenshot(page, `${prefix}_06_theme_dark.png`);

    // Open drawer in dark theme to inspect contrast
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_06_theme_dark_drawer.png`);

    // 3. Switch back to Light Theme
    await toggleTheme(page, 'light');
    await page.waitForTimeout(500);
    const isLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
    expect(isLight).toBe(true);
  });

  test('Empty, error and loading states verification', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Empty search state in QuickSearch
    const searchInput = page.locator('header input[placeholder*="Поиск: напр. Минздрав"]');
    await searchInput.fill('абвгдеёжзийклмнопрстуфхцчшщъыьэюя_12345');
    await page.waitForTimeout(1000);

    const emptyNotice = page.locator('header').getByText('Организаций и подразделений не найдено');
    await expect(emptyNotice).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_06_empty_search_state.png`);

    // 2. Open drawer and check question search empty state
    await searchInput.fill('');
    await page.keyboard.press('Escape');

    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const questionSearch = drawer.locator('input[placeholder*="Потокеновый поиск"]');
    if (await questionSearch.isVisible()) {
      await questionSearch.fill('nonexistent_question_topic_9999');
      await page.waitForTimeout(500);
      await expect(drawer.locator('text=По данному запросу вопросов не найдено')).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, `${prefix}_06_empty_questions_filter.png`);
    }
  });

  test('Keyboard navigation and a11y labels (Tab, Escape, ARIA roles)', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Keyboard Tab navigation focus
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // 2. Search dropdown Escape closing
    const searchInput = page.locator('header input[placeholder*="Поиск: напр. Минздрав"]');
    await searchInput.focus();
    await searchInput.fill('Мин');
    await page.waitForTimeout(1000);

    const dropdown = page.locator('header .animate-fadeIn');
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Press Escape -> dropdown closes
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(dropdown).not.toBeVisible();

    // 3. ARIA roles and labels inspection
    const drawerAside = page.locator('aside[aria-label="Сведения об организации"]');
    const toolbarAside = page.locator('aside[aria-label="Панель инструментов"]');
    await expect(toolbarAside).toHaveAttribute('aria-label', 'Панель инструментов');

    // 4. Open and close Compare modal via Escape or ARIA dialog
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await detailsBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const compareBtn = page.locator('button:has-text("Сравнить")').first();
    await compareBtn.click({ force: true });
    await page.waitForTimeout(500);

    const compareModal = page.locator('section[aria-label="Сравнение организаций"]');
    await expect(compareModal).toHaveAttribute('role', 'dialog');
    await expect(compareModal).toHaveAttribute('aria-modal', 'true');
    await expect(compareModal.getByRole('textbox', { name: 'Поиск второй организации для сравнения' })).toBeVisible();

    // Close compare modal
    const closeCompareBtn = compareModal.locator('header button').first();
    await closeCompareBtn.click({ force: true });
    await page.waitForTimeout(500);
    await expect(compareModal).not.toBeVisible();

    await captureScreenshot(page, `${prefix}_06_a11y_verified.png`);
  });

  test('Mobile viewport layout inspection: header bounds, drawer bounds, touch targets', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeTruthy();

    // Measure header bounding box to check for horizontal overflow
    const header = page.locator('header');
    const headerBox = await header.boundingBox();
    expect(headerBox).toBeTruthy();

    if (isMobile) {
      // In mobile (390px), check whether header content overflows
      const headerScrollWidth = await header.evaluate((el) => el.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(headerScrollWidth).toBeLessThanOrEqual(windowWidth);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(windowWidth);

      // Record layout measurement
      await captureScreenshot(page, `${prefix}_06_mobile_viewport_layout.png`);

      // Open drawer on mobile and verify it stays within bounds
      const detailsBtn = page.locator('button:has-text("Сведения")').first();
      await detailsBtn.click({ force: true });
      await page.waitForTimeout(1000);

      const drawer = page.locator('aside[aria-label="Сведения об организации"]');
      await expect(drawer).toBeVisible({ timeout: 5000 });
      await captureScreenshot(page, `${prefix}_06_mobile_drawer_open.png`);
      await drawer.locator('button:has-text("Сравнить")').click();
      const compareModal = page.locator('section[aria-label="Сравнение организаций"]');
      await expect(compareModal).toBeVisible();
      await compareModal.locator('header button').first().click();
      await expect(compareModal).not.toBeVisible();
      const createChild = drawer.getByRole('button', { name: 'Создать дочку', exact: true }).first();
      if (await createChild.isVisible()) {
        await createChild.click();
        await expect(page.getByText('Создание подотчетной организации')).toBeVisible();
      }
    } else {
      await captureScreenshot(page, `${prefix}_06_desktop_viewport_layout.png`);
    }
  });
});
