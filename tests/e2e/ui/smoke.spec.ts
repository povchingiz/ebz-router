import { test, expect } from '@playwright/test';

test('smoke - check site gate', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ЕБЗ Роутер/);
});
