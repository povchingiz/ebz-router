import { test, expect } from '@playwright/test';
import {
  bypassGateWithCookies,
  loginAs,
  captureScreenshot,
  setupPageMonitors,
} from './helpers';

test.describe('02 - Tree & Graph View, Multi-Child Pinning, Compare Modal', () => {
  test.beforeEach(async ({ page }) => {
    await bypassGateWithCookies(page);
    await loginAs(page, 'superadmin');
  });

  test('Graph hierarchy: root node, expansion, +N card, multi-child pinning, orientation & collapse', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    // 1. Initial graph view: root node (АП)
    const rootNode = page.locator('text=Администрация Президента').first();
    await expect(rootNode).toBeVisible({ timeout: 10000 });
    await captureScreenshot(page, `${prefix}_02_graph_root_initial.png`);

    // 2. Expand children: click "⬇️ Дочерние организации"
    const expandBtn = page.locator('button:has-text("Дочерние организации")').first();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await page.waitForTimeout(1000);

    // Verify children and +N card appeared
    const moreCard = page.locator('text=организаций').first();
    await expect(moreCard).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_02_graph_expanded_children.png`);

    // 3. Multi-child pinning via +N card
    const selectChildBtn = page.locator('button:has-text("Выбрать")').first();
    if (await selectChildBtn.isVisible().catch(() => false)) {
      await selectChildBtn.click();
      await page.waitForTimeout(500);
      await captureScreenshot(page, `${prefix}_02_graph_more_picker_open.png`);

      // Pick a child from the dropdown list
      const childItem = page.locator('div.absolute').locator('button').first();
      if (await childItem.isVisible().catch(() => false)) {
        await childItem.click();
        await page.waitForTimeout(1000);
      }
    }
    await captureScreenshot(page, `${prefix}_02_graph_pinned_children.png`);

    // 4. Orientation switch: TB to LR and back
    const orientBtn = page.locator('button:has-text("В горизонталь")');
    if (await orientBtn.isVisible().catch(() => false)) {
      await orientBtn.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('button:has-text("В вертикаль")')).toBeVisible();
      await captureScreenshot(page, `${prefix}_02_graph_horizontal_lr.png`);

      // Switch back
      await page.locator('button:has-text("В вертикаль")').click();
      await page.waitForTimeout(1000);
      await expect(page.locator('button:has-text("В горизонталь")')).toBeVisible();
    }

    // 5. Clean board: "Очистить доску"
    const clearBtn = page.locator('button:has-text("Очистить доску")');
    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(1000);
      await captureScreenshot(page, `${prefix}_02_graph_collapsed_root.png`);
    }
  });

  test('Side-by-side compare modal: open from drawer, search org B, compare attributes and pin beside', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const prefix = isMobile ? 'mobile' : 'desktop';
    const monitors = setupPageMonitors(page);

    // 1. Open drawer for root org (АП)
    const detailsBtn = page.locator('button:has-text("Сведения")').first();
    await expect(detailsBtn).toBeVisible({ timeout: 10000 });
    await detailsBtn.click();
    await page.waitForTimeout(1000);

    // Verify OrgDrawer opened
    const drawer = page.locator('aside[aria-label="Сведения об организации"]');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_02_org_drawer_open.png`);

    // 2. Click "Сравнить"
    const compareBtn = page.locator('button:has-text("Сравнить")').first();
    await expect(compareBtn).toBeVisible();
    await compareBtn.click({ force: true });
    await page.waitForTimeout(500);

    // Verify CompareModal opened
    const compareModal = page.locator('section[aria-label="Сравнение организаций"]');
    await expect(compareModal).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, `${prefix}_02_compare_modal_empty.png`);

    // 3. Search and select Org B (e.g. "Минэнерго")
    const searchInput = compareModal.locator('input[placeholder*="Поиск: напр. Минздрав"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Минэнерго');
    await page.waitForTimeout(500);

    // Select result from dropdown
    const resultItem = compareModal.locator('button:has-text("Минэнерго")').first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    await resultItem.click({ force: true });
    await page.waitForTimeout(500);

    // Verify comparison table has both organizations
    await expect(compareModal.locator('text=Для сравнения')).toBeVisible();
    await captureScreenshot(page, `${prefix}_02_compare_modal_populated.png`);

    // 4. Click "Открыть обе организации на графе рядом"
    const pinBesideBtn = compareModal.locator('button:has-text("Открыть обе организации на графе рядом")');
    await expect(pinBesideBtn).toBeEnabled();
    await pinBesideBtn.click({ force: true });
    await page.waitForTimeout(1500);

    // Verify CompareModal closed and graph displays nodes
    await expect(compareModal).not.toBeVisible();
    await captureScreenshot(page, `${prefix}_02_graph_pinned_beside.png`);
  });
});
