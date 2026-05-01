// Mobile-viewport gate spec — Sprint 2 retro rule #2.
//
// Gates every Sprint 2 deploy: 390x844 viewport, cc_tabsEnabled='true',
// navigate /dashboard, assert redirect to /dashboard/today + no pageerror
// + #root populated. Plus a no-loop test against /dashboard/today directly.
//
// Runs against prod when E2E_TARGET_PROD=1 (same pattern as smoke.spec.ts
// and tabs.spec.ts). Both tests use an identical beforeEach that injects
// cc_tabsEnabled='true' so the tabs router guard fires.

import { test, expect } from '@playwright/test';

const PROD = process.env.E2E_TARGET_PROD === '1';
const BASE = PROD ? 'https://cycling-coach.josem-reboredo.workers.dev' : '';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  // Inject the tabs flag before the page loads so the TanStack Router
  // beforeLoad guard can read it synchronously on the first navigation.
  await page.addInitScript(() => {
    localStorage.setItem('cc_tabsEnabled', 'true');
  });
});

test.describe('Mobile tabs — viewport 390×844', () => {
  test('Mobile viewport mounts /dashboard/today', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(`${BASE}/dashboard`);

    // beforeLoad redirect runs AFTER the JS bundle loads — wait for the URL
    // to settle at /dashboard/today rather than checking on domcontentloaded
    // (which fires before TanStack Router has a chance to redirect).
    await page.waitForURL(/\/dashboard\/today/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/dashboard\/today/);

    // At least one <header> element must be in the DOM.
    // v9.9.0 (#73): wait up to 5s — TopBar mounts after route resolution
    // which can lag on cold-start under WB/CI conditions.
    await page.locator('header').first().waitFor({ state: 'attached', timeout: 5000 });
    const headerCount = await page.locator('header').count();
    expect(headerCount).toBeGreaterThanOrEqual(1);

    // No JS pageerrors during boot.
    expect(pageErrors, `unexpected pageerrors:\n${pageErrors.join('\n')}`).toEqual([]);

    // Wait up to 3s for #root to have at least one child element.
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root');
        return root !== null && root.children.length >= 1;
      },
      { timeout: 3000 },
    );
    const rootChildren = await page.locator('#root > *').count();
    expect(rootChildren).toBeGreaterThanOrEqual(1);
  });

  test('No redirect loop on /dashboard/today', async ({ page }) => {
    // The v9.3.1 redirect-loop bug manifested as Tanstack's parent beforeLoad
    // re-firing on every nested-route nav, sending /dashboard/today back to
    // /dashboard/today repeatedly. Detection: navigate, count framenavigated
    // events for ~2s, assert ≤1 in-place navigation occurred (the initial
    // domcontentloaded one). A loop would generate many.
    let navCount = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navCount += 1;
    });

    await page.goto(`${BASE}/dashboard/today`);
    await page.waitForLoadState('domcontentloaded');

    // Give any pending async redirects 2s to fire if a loop exists.
    await page.waitForTimeout(2000);

    // URL must be settled at /dashboard/today.
    expect(page.url()).toMatch(/\/dashboard\/today$/);

    // No more than 2 mainframe navigations expected: the initial goto + at
    // most one TanStack-router-driven settle. A redirect loop would push
    // navCount well above 2 within 2s.
    expect(navCount, `unexpectedly many mainframe navigations (loop?): ${navCount}`).toBeLessThanOrEqual(2);
  });
});
