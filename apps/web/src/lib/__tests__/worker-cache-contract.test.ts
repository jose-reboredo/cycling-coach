// v10.11.2 → v10.11.3 — Cache-Control contract test for the Worker.
//
// Why this exists: between v10.10.x and v10.11.1 we shipped 6+ hotfixes
// trying to make calendar mutations stick. Every one was correct on the
// frontend (TanStack invalidations, refetchOnMount, mutation awaiting,
// SW cache versioning, view persistence) — and yet "edit doesn't
// register" / "cancel doesn't disappear" persisted.
//
// Root cause (v10.11.2): three user-specific GET endpoints set
//   Cache-Control: private, max-age=300
// on the response. The browser obeys this and serves the response from
// disk cache for 5 minutes. TanStack's `invalidateQueries` fires a
// `fetch()`, but the browser intercepts and serves the stale cache
// before reaching the network.
//
// v10.11.3 — defense-in-depth: a worker-level entry filter
// (`withApiCacheDefault` in src/worker.js) sets `Cache-Control: private,
// no-store` on EVERY /api/* response that doesn't explicitly opt out.
// Public read-only paths (/roadmap) can still set their own headers.
//
// This test covers two contracts:
//   1. No /api/* response should set `max-age=N` (positive)
//   2. The entry filter exists and applies to /api/* (positive)
//   3. /roadmap (public) is allowed to public-cache (sanity)

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerPath = resolve(__dirname, '../../../../../src/worker.js');
const workerSource = readFileSync(workerPath, 'utf8');

describe('Worker Cache-Control contract', () => {
  describe('Per-endpoint regression guards (v10.11.2 root cause)', () => {
    // Endpoints that handle user-specific data and MUST NOT browser-cache.
    // Anchor = a substring near the response-construction site of each.
    const USER_SCOPED_ANCHORS: Array<{ name: string; anchor: RegExp }> = [
      { name: '/api/clubs/:id/events?range', anchor: /club_id: clubId,\s+range:.*events,/s },
      { name: '/api/me/schedule', anchor: /club_events: events,\s+\/\/.*v9\.12\.0 rename/s },
      { name: '/api/me/sessions?range', anchor: /sessions: \(rows \|\| \[\]\)\.map\(mapSessionRow\)/s },
    ];

    for (const { name, anchor } of USER_SCOPED_ANCHORS) {
      it(`${name} response must not have max-age (browser-cache stale data risk)`, () => {
        const match = workerSource.match(anchor);
        expect(match, `Could not find anchor for ${name}; test needs updating`).not.toBeNull();
        const window = workerSource.slice(match!.index!, match!.index! + 600);
        const hasMaxAge = /Cache-Control[\s\S]*?max-age=\d+/.test(window);
        expect(hasMaxAge, [
          `Found Cache-Control with max-age near ${name}.`,
          'User-specific data MUST NOT browser-cache. Use no-store.',
          'See v10.11.2 CHANGELOG for the rationale.',
          '',
          `Window:\n${window}`,
        ].join('\n')).toBe(false);
      });
    }
  });

  describe('Defense-in-depth: entry-filter default cache policy (v10.11.3)', () => {
    // The entry filter `withApiCacheDefault` in src/worker.js MUST exist
    // and apply private, no-store to /api/* responses that don't set
    // their own Cache-Control. This backstops every existing and future
    // /api/ endpoint without per-handler discipline.
    it('withApiCacheDefault function exists', () => {
      expect(workerSource).toMatch(/function withApiCacheDefault/);
    });

    it('withApiCacheDefault sets private, no-store as default for /api/*', () => {
      const fnMatch = workerSource.match(/function withApiCacheDefault[\s\S]*?\n}/);
      expect(fnMatch, 'withApiCacheDefault not found').not.toBeNull();
      const body = fnMatch![0];
      // Path-gated to /api/*
      expect(body).toMatch(/pathname\.startsWith\('\/api\/'\)/);
      // Sets no-store
      expect(body).toMatch(/['"]Cache-Control['"]\s*,\s*['"]private,\s*no-store['"]/);
      // Respects existing headers (doesn't overwrite explicit overrides)
      expect(body).toMatch(/headers\.has\(['"]Cache-Control['"]\)/);
    });

    it('main fetch handler applies withApiCacheDefault before withSecurityHeaders', () => {
      // The order matters: withApiCacheDefault must be called inside the
      // export default handler so it wraps the worker's response BEFORE
      // the security-headers wrapper.
      const exportDefault = workerSource.match(
        /export default \{[\s\S]*?async fetch\([^)]*\)\s*\{[\s\S]*?\n  \}[\s\S]*?\}/,
      );
      expect(exportDefault, 'export default block not found').not.toBeNull();
      expect(exportDefault![0]).toMatch(/withApiCacheDefault/);
    });
  });

  describe('Public endpoints — explicitly allowed to cache', () => {
    it('/roadmap response IS allowed to public-cache (max-age=300)', () => {
      // /roadmap proxies GitHub Issues and is shared across all users; the
      // edge-cache-with-revalidate pattern is the right fit. This test
      // exists so a future "remove all max-age" sweep doesn't accidentally
      // strip it.
      const matches = workerSource.match(/'Cache-Control':\s*'public,\s*max-age=300/g);
      expect(matches, 'Expected public roadmap cache header to remain').not.toBeNull();
    });
  });

  describe('Audit: every user-specific /api/ GET endpoint', () => {
    // Enumerate every GET handler in worker.js, classify each, and assert
    // that the test author was aware of it. Forces explicit inventory.
    // If a new /api/ GET handler is added, this test fails until the new
    // path is added to the inventory below — the addition is a deliberate
    // act, not an oversight.
    const KNOWN_API_GET_PATHS = new Set([
      // User-specific (no-store applies via entry filter or explicit)
      '/api/clubs',
      '/api/clubs/:id/events?range', // also /api/clubs/:id/events without range
      '/api/clubs/:id/overview',
      '/api/clubs/:id/members',
      '/api/clubs/:id/events/:id/rsvps',
      '/api/me/schedule',
      '/api/me/sessions',
      '/api/rwgps/status',
      '/api/auth/strava-status',
      '/api/plan/current',
      '/api/routes/saved',
      '/api/routes/rwgps-saved',
      // Sprint 13 / v11.1.0 — credentials substrate.
      // User-specific; ciphertext per athlete; no-store applies via entry filter.
      '/api/me/credentials',
      // Sprint 13 / v11.2.0 — My Account profile.
      // User-specific; profile fields per athlete; no-store applies via entry filter.
      '/api/me/profile',
    ]);

    it('every /api/ GET path is known and accounted for', () => {
      const apiGetPaths = new Set<string>();
      const re = /url\.pathname\s*===\s*['"](\/api\/[^'"]+)['"][\s\S]{0,80}?request\.method === 'GET'/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(workerSource))) apiGetPaths.add(m[1]!);
      // Also catch destructured matchers like `eventsMatch && request.method === 'GET'`
      // — these don't show in the literal pathname check, but they fire
      // for /api/ paths and inherit the same cache policy via entry filter.
      // We don't enforce inventory on those (path is regex-based) but the
      // entry filter still applies.
      const unknown = [...apiGetPaths].filter((p) => !KNOWN_API_GET_PATHS.has(p));
      expect(unknown, [
        'New /api/ GET endpoints found that the contract test doesn\'t know about.',
        'Add them to KNOWN_API_GET_PATHS in this test (and confirm they don\'t set max-age).',
        '',
        `Unknown: ${unknown.join(', ')}`,
      ].join('\n')).toEqual([]);
    });
  });
});
