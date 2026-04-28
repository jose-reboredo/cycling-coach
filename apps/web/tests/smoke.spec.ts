// Phase 0b — three critical-path smoke tests. Each runs at both
// mobile-375 and desktop-1280 (Playwright projects). Asserts the page
// boots, key landmarks render, and no console errors fire. As later
// phases touch surfaces, additional specs land alongside this file.

import { test, expect, type ConsoleMessage } from '@playwright/test';

/** Collects browser console errors during the test for post-assert checks. */
function collectConsoleErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

test.describe('Smoke — landing page (/)', () => {
  test('renders brand mark + Connect with Strava CTA, zero console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // BikeMark + brand text in TopBar
    await expect(page.getByText('Cycling Coach').first()).toBeVisible();

    // Primary CTA — "Connect with Strava" button anchored to the Strava OAuth flow
    const cta = page.getByRole('link', { name: /Connect with Strava/i }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /(strava|authorize)/i);

    // No JS errors / pageerrors during boot
    expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('Smoke — dashboard demo (/dashboard?demo=1)', () => {
  test('shows mock activities + AI Coach + BottomNav, zero console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/dashboard?demo=1');
    await page.waitForLoadState('networkidle');

    // Greeting renders with the mock first name "Marco" (greeting word varies by hour)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marco');

    // AI Coach card eyebrow
    await expect(page.getByText(/AI Coach\s*·\s*Claude/i).first()).toBeVisible();

    // BottomNav renders the four mobile tabs. On desktop-1280 the parent has
    // `display: none` (mobile-only nav), so we assert DOM attachment, not
    // visibility — both viewports must contain the labels in markup.
    for (const label of ['Today', 'Train', 'Rides', 'You']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeAttached();
    }

    expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('Smoke — whats-next (/whats-next)', () => {
  test('renders at least one roadmap item with a non-empty title', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/whats-next');
    await page.waitForLoadState('networkidle');

    // Roadmap items render as headings (h3 or h4) — assert at least one
    // exists with non-whitespace text content.
    const headings = page.getByRole('heading').filter({ hasNotText: /^\s*$/ });
    expect(await headings.count()).toBeGreaterThanOrEqual(1);

    expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('Smoke — ride detail expand (/dashboard?demo=1)', () => {
  test('clicking a ride row reveals its detail panel', async ({ page }) => {
    await page.goto('/dashboard?demo=1');
    await page.waitForLoadState('networkidle');

    // Dismiss the demo banner first — at mobile-375 it intercepts pointer
    // events on the previous-rides section.
    const dismissBanner = page.getByRole('button', { name: /^dismiss$/i });
    if (await dismissBanner.count() > 0) {
      await dismissBanner.first().click();
    }

    // The expand-button uses aria-label="Toggle detail for {ride name}".
    // The previous-rides section is far down the page on mobile — scroll into
    // view, then nudge up so the sticky TopBar doesn't overlap.
    const expandBtn = page.getByRole('button', { name: /toggle detail for/i }).first();
    await expandBtn.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await expect(expandBtn).toBeVisible();

    // aria-expanded flips synchronously on click — assert that first
    // (deterministic), then wait for the panel content to appear.
    await expandBtn.click();
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'true');

    // FallbackBody (demo mode) renders a "connect Strava to see splits" note.
    await expect(page.getByText(/connect Strava to see splits/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Smoke — UserMenu keyboard nav (/dashboard?demo=1)', () => {
  test('arrow keys move between menuitems, ESC closes + restores focus', async ({ page }) => {
    await page.goto('/dashboard?demo=1');
    await page.waitForLoadState('networkidle');

    // Trigger has aria-label="Account menu for ..."
    const trigger = page.getByRole('button', { name: /account menu for/i });
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Menu now visible; first menuitem should be focused
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect.poll(async () =>
      page.evaluate(() => document.activeElement?.getAttribute('role')),
    ).toBe('menuitem');

    // ArrowDown moves focus
    const firstFocusedText = await page.evaluate(() => document.activeElement?.textContent);
    await page.keyboard.press('ArrowDown');
    const secondFocusedText = await page.evaluate(() => document.activeElement?.textContent);
    expect(secondFocusedText).not.toBe(firstFocusedText);

    // ESC closes + focus restores to trigger
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect.poll(async () =>
      page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup')),
    ).toBe('menu');
  });
});

