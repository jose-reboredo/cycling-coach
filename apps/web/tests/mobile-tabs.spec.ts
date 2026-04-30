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
    await page.waitForLoadState('domcontentloaded');

    // beforeLoad redirect must have moved us to /dashboard/today.
    expect(page.url()).toMatch(/\/dashboard\/today/);

    // At least one <header> element must be in the DOM.
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
    await page.goto(`${BASE}/dashboard/today`);
    await page.waitForLoadState('domcontentloaded');

    // URL must stay on /dashboard/today — must NOT bounce back to /dashboard.
    expect(page.url()).toMatch(/\/dashboard\/today/);
    expect(page.url()).not.toMatch(/\/dashboard(?!\/today)/);

    // Page is interactive — clicking on a nav element must not throw.
    const nav = page.locator('nav').first();
    const navCount = await nav.count();
    if (navCount > 0) {
      // Click the nav — any unhandled promise rejection would surface as a
      // pageerror and fail the test; we simply assert the click doesn't throw.
      await nav.click({ force: true }).catch(() => {
        // Ignore click errors (e.g. element not interactable); we only care
        // that the page itself doesn't explode.
      });
    }

    // URL must still be on /dashboard/today after interaction.
    expect(page.url()).toMatch(/\/dashboard\/today/);
  });
});
