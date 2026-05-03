// v10.13.0 (sprint-11) — Static-source contract test for the Sprint 11
// bug 2 fix: Strava saved-routes type filter + anchor-relevance gate.
//
// Why static-source? The handler proxies Strava's /athlete/routes
// endpoint and the user explicitly forbade mocking real Strava calls.
// Instead, we treat src/worker.js as a text fixture and assert that the
// structural fixes are present in the /api/routes/saved handler.
//
// Same pattern as worker-cache-contract.test.ts (v10.11.3 cache fix)
// and worker-route-bug1-contract.test.ts (Sprint 11 bug 1 sibling).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const repoRoot = resolve(__dirname, '../../../../..');
const workerSrc = readFileSync(resolve(repoRoot, 'src/worker.js'), 'utf8');

describe('Bug 2: Strava saved-routes type filter + anchor relevance', () => {
  // The fix lives in src/worker.js inside the /api/routes/saved handler.
  // We assert:
  //   1. The mapped/filtered pipeline drops routes whose Strava `type`
  //      is not 1 (Ride). type 2 = Run/Hike — that's how Path of Gods
  //      sneaks in.
  //   2. The handler reads optional lat/lng query params for anchor
  //      ranking, and the radius constant is sane (defensible).

  // Locate the handler so subsequent assertions stay scoped.
  const handlerMatch = workerSrc.match(
    /url\.pathname === '\/api\/routes\/saved'[\s\S]*?\n\s\s\s\s\}\s*\n/,
  );

  it('the /api/routes/saved handler block is locatable', () => {
    expect(handlerMatch, '/api/routes/saved handler block not found').not.toBeNull();
  });

  it('drops routes with type !== 1 (hikes / runs)', () => {
    // Look for an explicit type filter referencing Strava's `type`
    // field. We accept either:
    //   - direct compare: `r.type === 1` / `route.type !== 1`
    //   - normalized internal field: `_type !== 1` / `_type === 1`
    //     (the implementation maps Strava's r.type → r._type during the
    //     mapping pass so the public response shape stays clean).
    // What matters is that the handler reads Strava's `type` AND has a
    // gate against the value 1 (= Ride) somewhere downstream.
    const block = handlerMatch![0];
    const readsStravaType = /\br\.type\b|\broute\.type\b/.test(block);
    const gatesOnRide = /(?:_type|type)\s*(?:!==|===)\s*1\b/.test(block);
    expect(
      readsStravaType,
      'Sprint 11 bug 2 regression — handler must read Strava\'s `r.type` field',
    ).toBe(true);
    expect(
      gatesOnRide,
      'Sprint 11 bug 2 regression — handler must gate routes against type === 1 (Ride)',
    ).toBe(true);
  });

  it('reads lat/lng from query params for anchor-relevance ranking', () => {
    const block = handlerMatch![0];
    // Either ?lat= and ?lng=, or ?anchor_lat / ?anchor_lng — both
    // accepted; just require both halves of the anchor are read.
    const hasLat = /url\.searchParams\.get\(['"](anchor_)?lat['"]\)/.test(block);
    const hasLng = /url\.searchParams\.get\(['"](anchor_)?l(ng|on)['"]\)/.test(block);
    expect(
      hasLat && hasLng,
      'Sprint 11 bug 2 — handler should accept lat/lng query params for anchor ranking',
    ).toBe(true);
  });

  it('uses a defensible radius (≥ 25 km, ≤ 200 km) for the anchor gate', () => {
    const block = handlerMatch![0];
    // Look for STRAVA_ANCHOR_RADIUS_KM constant near the handler.
    // Strava saved routes don't always carry tight anchors so the
    // radius should be loose enough to keep regional routes (50 km
    // is the documented number).
    const m = block.match(/STRAVA_ANCHOR_RADIUS_KM\s*=\s*(\d+(?:\.\d+)?)/);
    expect(m, 'STRAVA_ANCHOR_RADIUS_KM constant missing').not.toBeNull();
    const km = parseFloat(m![1]!);
    expect(km).toBeGreaterThanOrEqual(25);
    expect(km).toBeLessThanOrEqual(200);
  });
});
