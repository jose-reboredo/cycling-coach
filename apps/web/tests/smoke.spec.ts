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

    // BikeMark + brand text in TopBar (renamed Cycling Coach → Cadence Club in v9.1.0)
    await expect(page.getByText('Cadence Club').first()).toBeVisible();

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

    // Greeting renders with the mock first name "Marco" (greeting word varies by hour).
    // v9.9.0 (#73): the greeting moved from h1 to h2 in the dashboard.today
    // sub-route refactor; h1 now contains the page-shell title ("Today").
    // Check that "Marco" appears anywhere in heading-text rather than pinning
    // to a specific level.
    await expect(page.getByRole('heading').filter({ hasText: /Marco/i }).first()).toBeVisible();

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
    // v9.9.0 (#73): wait up to 10s for the button to appear before scrolling
    // (page is mock-data-heavy and can take time to settle on cold-start).
    const expandBtn = page.getByRole('button', { name: /toggle detail for/i }).first();
    await expandBtn.waitFor({ state: 'attached', timeout: 10000 });
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

test.describe('Smoke — BottomNav scroll sync (/dashboard?demo=1)', () => {
  // Only runs at mobile-375 (BottomNav is display: none at ≥1024px).
  test.skip(
    ({ viewport }) => Boolean(viewport && viewport.width >= 1024),
    'BottomNav hidden on desktop',
  );

  test('scrolling to a section activates its BottomNav tab', async ({ page }) => {
    await page.goto('/dashboard?demo=1');
    await page.waitForLoadState('networkidle');

    // Initial state — Today tab active.
    // v9.9.0 (#73): wait for hash-anchor BottomNav to render (only present
    // when cc_tabsEnabled=false, which is the default for this test).
    const todayTab = page.locator('a[href="#today"]');
    await todayTab.waitFor({ state: 'attached', timeout: 5000 });
    await expect(todayTab).toHaveAttribute('aria-current', 'page');

    // Scroll the train (AI Coach) section into the middle of the viewport.
    await page.locator('#train').scrollIntoViewIfNeeded();
    // Give IntersectionObserver a moment to fire + state to flush.
    await page.waitForTimeout(800);

    const trainTab = page.locator('a[href="#train"]');
    await expect(trainTab).toHaveAttribute('aria-current', 'page');
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

/* ============================================================
 * Club endpoint auth gates (issue #35 — closes test-coverage gap
 * for v9.0.0 invite-by-link + v9.1.3 events. Tests the unauth
 * branches; full membership-gated round-trip needs a live Strava
 * token and is out of scope for the e2e harness today.)
 * ============================================================ */
test.describe('Smoke — club API auth gates', () => {
  // Use the deployed prod URL when E2E_TARGET_PROD=1 (the same env var
  // that gates the /whats-next probe earlier in this file). Locally
  // these would hit vite preview which doesn't proxy /api, so they're
  // skipped without the env var.
  const PROD = process.env.E2E_TARGET_PROD === '1';
  const BASE = PROD ? 'https://cycling-coach.josem-reboredo.workers.dev' : '';

  test.skip(!PROD, 'requires E2E_TARGET_PROD=1 to hit deployed API');

  test('GET /api/clubs without auth → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clubs`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'authentication required' });
  });

  test('POST /api/clubs without auth → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/clubs`, {
      data: { name: 'auth-gate test', description: 'should not create' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/clubs/:id/events without auth → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clubs/1/events`);
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'authentication required' });
  });

  test('POST /api/clubs/:id/events without auth → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/clubs/1/events`, {
      data: { title: 'auth-gate test', event_date: '2030-01-01' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/clubs/:id/members without auth → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clubs/1/members`);
    expect(res.status()).toBe(401);
  });

  test('POST /api/clubs/join/:code without auth → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/clubs/join/anycode`, { data: {} });
    expect(res.status()).toBe(401);
  });

  test('CORS preflight on /api/clubs → 200 + Access-Control-Allow-Origin', async ({ request }) => {
    const res = await request.fetch(`${BASE}/api/clubs`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['access-control-allow-origin']).toBeTruthy();
  });
});

/* ============================================================
 * Worker /version endpoint sanity (closes a smaller gap — no
 * existing test verifies the deployed worker version is queryable).
 * Cheap canary: caught a v8.x deploy where /version returned the
 * wrong build_date during the v8.5.2 cycle.
 * ============================================================ */
test.describe('Smoke — /version endpoint', () => {
  const PROD = process.env.E2E_TARGET_PROD === '1';
  const BASE = PROD ? 'https://cycling-coach.josem-reboredo.workers.dev' : '';

  test.skip(!PROD, 'requires E2E_TARGET_PROD=1');

  test('returns service + version + build_date', async ({ request }) => {
    const res = await request.get(`${BASE}/version`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      service: expect.any(String),
      version: expect.stringMatching(/^v\d+\.\d+\.\d+$/),
      build_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      status: 'ok',
    });
  });
});

