import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const GATE_PASSWORD = 'localastana1!';

export const USERS = {
  superadmin: {
    username: 'superadmin',
    password: 'admin8391',
    fullName: 'Супер-администратор (АП РК)',
    role: 'GLOBAL_ADMIN',
  },
  methodologist: {
    username: 'admin_minenergo',
    password: 'energo2026',
    fullName: 'Методолог Минэнерго РК (МЭ)',
    role: 'ORG_ADMIN',
    orgId: 'me',
  },
  viewer: {
    username: 'viewer',
    password: 'guest1048',
    fullName: 'Наблюдатель (Аналитик)',
    role: 'VIEWER',
  },
};

export interface ConsoleNetworkLogs {
  consoleErrors: string[];
  consoleWarnings: string[];
  failedRequests: { url: string; status?: number; errorText?: string }[];
}

export function setupPageMonitors(page: Page): ConsoleNetworkLogs {
  const logs: ConsoleNetworkLogs = {
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      logs.consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      logs.consoleWarnings.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    logs.consoleErrors.push(`[PageError] ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    logs.failedRequests.push({
      url: req.url(),
      errorText: req.failure()?.errorText || 'Unknown failure',
    });
  });

  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('/api/gate') && !res.url().includes('/api/auth/login')) {
      logs.failedRequests.push({
        url: res.url(),
        status: res.status(),
      });
    }
  });

  return logs;
}

export async function unlockSiteGate(page: Page, password = GATE_PASSWORD) {
  await page.goto('/');
  // Check if already unlocked
  const gateInput = page.locator('input[type="password"]');
  if (await gateInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    await gateInput.fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
  }
}

export async function bypassGateWithCookies(page: Page) {
  // Call gate API directly to obtain cryptographically signed cookie
  await page.request.post('/api/gate', {
    data: { password: GATE_PASSWORD },
  });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('site_gate_pass', 'unlocked_2026');
  });
  await page.waitForLoadState('networkidle');
}

export const USER_LABELS: Record<keyof typeof USERS, { menuText: string; badgeText: string }> = {
  superadmin: {
    menuText: 'Супер-админ (АП РК)',
    badgeText: 'Супер-админ',
  },
  methodologist: {
    menuText: 'Минэнерго РК (МЭ)',
    badgeText: 'Минэнерго РК',
  },
  viewer: {
    menuText: 'Наблюдатель (Чтение)',
    badgeText: 'Только чтение',
  },
};

export async function loginAs(page: Page, userKey: keyof typeof USERS) {
  const user = USERS[userKey];
  const labels = USER_LABELS[userKey];
  await bypassGateWithCookies(page);

  const loginBtn = page.locator('header button:has-text("Войти")');
  if (await loginBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await loginBtn.click({ force: true });
    const modal = page.locator('div.fixed:has-text("Авторизация в Е-Отиниш")');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.locator('input[type="text"]').fill(user.username);
    await modal.locator('input[type="password"]').fill(user.password);
    await modal.locator('form').evaluate((f: any) => f.requestSubmit());
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
  } else {
    // Open profile menu to switch
    const profileBtn = page.locator('header button[aria-label*=":"]').first();
    if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await profileBtn.click({ force: true });
      const targetItem = page
        .locator(`button:has-text("${labels.menuText}"), button:has-text("${user.username}")`)
        .first();
      await expect(targetItem).toBeVisible({ timeout: 3000 });
      await targetItem.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

export async function loginViaApi(page: Page, role: keyof typeof USERS) {
  const creds = USERS[role];
  const res = await page.request.post('/api/auth/login', {
    data: {
      username: creds.username,
      password: creds.password,
    },
  });
  return res;
}

export async function captureScreenshot(page: Page, filename: string) {
  const dir = path.resolve('/home/chingiz/Desktop/projectstier/ebz-router/reports/screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const fullPath = path.join(dir, filename);
  await page.screenshot({ path: fullPath, fullPage: false });
  return `reports/screenshots/${filename}`;
}

export async function toggleTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, theme);
}
