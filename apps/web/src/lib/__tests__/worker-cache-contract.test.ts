// v10.11.2 — Cache-Control contract test for the Worker.
//
// Why this exists: between v10.10.x and v10.11.1 we shipped 6+ hotfixes
// trying to make calendar mutations stick. Every one was correct on the
// frontend (TanStack invalidations, refetchOnMount, mutation awaiting,
// SW cache versioning, view persistence) — and yet "edit doesn't
// register" / "cancel doesn't disappear" persisted.
//
// Root cause: three user-specific GET endpoints set
//   Cache-Control: private, max-age=300
// on the response. The browser obeys this and serves the response from
// disk cache for 5 minutes. TanStack's `invalidateQueries` fires a
// `fetch()`, but the browser intercepts and serves the stale cache
// before reaching the network. The whole frontend invalidation pipeline
// was correct; the network never returned fresh data.
//
// This test prevents the regression: any HTTP response on a user-
// specific endpoint MUST NOT cache via `max-age` (or `s-maxage`).
// Public read-only endpoints (e.g. /roadmap) are still allowed to cache.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Worker source — read from disk so the test fails on the literal source
// without booting the worker. Cheap regex audit; no module loading needed.
const workerPath = resolve(__dirname, '../../../../../src/worker.js');
const workerSource = readFileSync(workerPath, 'utf8');

// Endpoints that handle user-specific data and MUST NOT browser-cache.
// Shape: a substring of a path or a comment marker that anchors the
// preceding ~30 lines as "this is the X handler". The test scans the
// neighborhood of each anchor for a Cache-Control with max-age.
const USER_SCOPED_ANCHORS: Array<{ name: string; anchor: RegExp }> = [
  { name: '/api/clubs/:id/events?range', anchor: /club_id: clubId,\s+range:.*events,/s },
  { name: '/api/me/schedule', anchor: /club_events: events,\s+\/\/.*v9\.12\.0 rename/s },
  { name: '/api/me/sessions?range', anchor: /sessions: \(rows \|\| \[\]\)\.map\(mapSessionRow\)/s },
];

describe('Worker Cache-Control contract', () => {
  for (const { name, anchor } of USER_SCOPED_ANCHORS) {
    it(`${name} response must not have max-age (browser-cache stale data risk)`, () => {
      const match = workerSource.match(anchor);
      expect(match, `Could not find anchor for ${name}; test needs updating`).not.toBeNull();
      // Take 600 chars after the anchor — covers the typical Response
      // construction site including its headers block.
      const window = workerSource.slice(match!.index!, match!.index! + 600);
      // Must not contain max-age in this window.
      const hasMaxAge = /Cache-Control[\s\S]*?max-age=\d+/.test(window);
      expect(hasMaxAge, [
        `Found Cache-Control with max-age near ${name}.`,
        '',
        'User-specific data MUST NOT browser-cache. Use:',
        "  'Cache-Control': 'private, no-store'",
        '',
        'See v10.11.2 CHANGELOG for the rationale.',
        '',
        `Window:\n${window}`,
      ].join('\n')).toBe(false);
    });
  }

  // Sanity: confirm the public /roadmap endpoint still uses caching.
  // This exists so a future "remove all max-age everywhere" doesn't
  // accidentally break /roadmap which CAN be public-cached.
  it('/roadmap response IS allowed to cache (public, max-age=300)', () => {
    const matches = workerSource.match(/'Cache-Control':\s*'public,\s*max-age=300/g);
    expect(matches, 'Expected public roadmap cache header to remain').not.toBeNull();
  });
});
