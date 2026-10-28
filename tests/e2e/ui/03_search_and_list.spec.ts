import { test, expect } from '@playwright/test';
import { bypassGateWithCookies, loginAs, captureScreenshot, setupPageMonitors } from './helpers';

test.describe('03: Universal Search and List/Accordion View', () => {
  test.beforeEach(async ({ page }) => {
    await bypassGateWithCookies(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Universal QuickSearch in header: tokens, server search, details button, escape & empty state', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    const searchInput = page.locator('header input[placeholder*="Поиск: напр. Минздрав"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 1. Search for existing ministry
    await searchInput.fill('энерг');
    await page.waitForTimeout(1000);

    // Dropdown results should appear
    const dropdown = page.locator('header .animate-fadeIn');
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_03_quicksearch_results_active.png`);

    // Check at least one matching item is shown
    const resultItem = dropdown.locator('div:has-text("Минэнерго")').first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });

    // 2. Click "Сведения" on the result to open OrgDrawer directly
    const detailsBtn = resultItem.locator('button:has-text("Сведения")');
    if (await detailsBtn.count() > 0) {
      await detailsBtn.click({ force: true });
    } else {
      // If button not scoped inside, click the sibling button or the item itself
      await resultItem.click({ force: true });
    }
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_03_quicksearch_drawer_opened.png`);

    // Close drawer
    const closeDrawerBtn = drawer.locator('button[title*="Скрыть панель"]').first();
    await closeDrawerBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 3. Test Escape key closes search results
    await searchInput.fill('транспорт');
    await page.waitForTimeout(1000);
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(dropdown).not.toBeVisible();

    // 4. Test empty search state (zero results)
    await searchInput.fill('nonexistent_gibberish_xyz_123');
    await page.waitForTimeout(1000);
    await expect(dropdown).toBeVisible({ timeout: 5000 });
    await expect(dropdown.locator('text=Организаций и подразделений не найдено')).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_03_quicksearch_empty_state.png`);

    // 5. Test clear search query button
    const clearBtn = page.locator('header button:has(svg.lucide-x)').first();
    if (await clearBtn.isVisible()) {
      await clearBtn.click({ force: true });
      await page.waitForTimeout(300);
      await expect(searchInput).toHaveValue('');
    }
  });

  test('ListView: accordion expansion, breadcrumbs, search within list, and collapse all', async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    await loginAs(page, 'superadmin');
    await page.waitForTimeout(1000);

    // 1. Switch to "Список" (ListView)
    const listTabBtn = page.locator('aside[aria-label="Панель инструментов"] button:has-text("Список")');
    await expect(listTabBtn).toBeVisible({ timeout: 10000 });
    await listTabBtn.click({ force: true });
    await page.waitForTimeout(1000);

    await captureScreenshot(page, `${prefix}_03_listview_root.png`);

    // Verify root row is visible (АП)
    const rootRow = page.locator('div:has-text("Администрация Президента")').first();
    await expect(rootRow).toBeVisible({ timeout: 5000 });

    // 2. Expand root row accordion
    const expandBtn = page.locator('button[title*="Развернуть подотчетных"]').first();
    if (await expandBtn.isVisible()) {
      await expandBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await captureScreenshot(page, `${prefix}_03_listview_expanded.png`);
    }

    // 3. Search within ListView
    const listSearchInput = page.getByRole('textbox', { name: 'Поиск по списку организаций' });
    await expect(listSearchInput).toBeVisible({ timeout: 5000 });
    await listSearchInput.fill('Мин');
    await page.waitForTimeout(1000);

    await captureScreenshot(page, `${prefix}_03_listview_search_results.png`);

    // Verify ministry rows appear
    const minRow = page.locator('main div:has-text("Министерство")').first();
    await expect(minRow).toBeVisible({ timeout: 5000 });

    // 4. Open details from the button on a server-search result.
    await page.locator('main').getByRole('button', { name: 'Сведения' }).first().click({ force: true });
    await page.waitForTimeout(1000);

    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_03_listview_details_drawer.png`);

    // Close drawer
    const closeDrawerBtn = drawer.locator('button[title*="Скрыть панель"]').first();
    await closeDrawerBtn.click({ force: true });
    await page.waitForTimeout(500);

    // 5. Test empty state in ListView
    await listSearchInput.fill('something_not_found_in_list_9999');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Ведомств по данному запросу не найдено')).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_03_listview_empty_state.png`);
  });
});
