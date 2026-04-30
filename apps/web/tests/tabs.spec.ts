// Tab redirect specs — part of #51 sub-task C.
//
// These tests target prod (E2E_TARGET_PROD=1) just like smoke.spec.ts; they
// only assert URL/navigation behaviour so no auth is required.
//
// Test #2 (flag ON → redirect) will pass once the v9.3.0 deploy lands the
// beforeLoad redirect logic (commit 4f87431) to prod. Both tests ship in
// the same release so they'll go green together.

import { test, expect } from '@playwright/test';

const PROD = process.env.E2E_TARGET_PROD === '1';
const BASE = PROD ? 'https://cycling-coach.josem-reboredo.workers.dev' : '';

test.describe('Tabs flag — /dashboard navigation behaviour', () => {
  test('flag OFF (default): /dashboard does not redirect to /dashboard/today', async ({ page }) => {
    // No localStorage manipulation — flag defaults to off.
    await page.goto(`${BASE}/dashboard`);

    // Allow the page to settle; a redirect would fire quickly in beforeLoad.
    await page.waitForLoadState('domcontentloaded');

    // URL must remain on /dashboard (possibly with query params) — not /dashboard/today.
    expect(page.url()).not.toMatch(/\/dashboard\/today/);
    expect(page.url()).toMatch(/\/dashboard/);
  });

  test('flag ON: /dashboard redirects to /dashboard/today', async ({ page }) => {
    // Inject the flag before the page loads so the TanStack Router beforeLoad
    // guard can read it synchronously on the first navigation.
    await page.addInitScript(() => {
      localStorage.setItem('cc_tabsEnabled', 'true');
    });

    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // beforeLoad redirect should have moved us to /dashboard/today.
    expect(page.url()).toMatch(/\/dashboard\/today/);
  });
});
