// v10.13.0 (sprint-11) — Static-source contract test for the Sprint 11
// bug 1 fix: ORS-generated route centroid-anchor gate.
//
// Why static-source? The actual handler runs on Cloudflare Workers and
// hits external APIs (ORS). Spinning up a real worker harness in unit
// tests is overkill and the user explicitly forbade mocking external
// calls. Instead, we treat src/routes/routeGen.js as a text fixture
// and assert that the structural fix is present and wired into the
// request flow.
//
// Same pattern as worker-cache-contract.test.ts (v10.11.3 cache fix).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const repoRoot = resolve(__dirname, '../../../../..');
const routeGenSrc = readFileSync(resolve(repoRoot, 'src/routes/routeGen.js'), 'utf8');

describe('Bug 1: ORS-generated route centroid gate', () => {
  // The fix lives in src/routes/routeGen.js. We assert:
  //   1. The CENTROID_MAX_KM constant exists and is set to a tight value
  //      (≤ 2 km — founder's spec).
  //   2. routeCentroid + haversineKm helpers are defined.
  //   3. The gate is wired into the score+dedupe loop (i.e. the
  //      generation pipeline actually checks each candidate's centroid
  //      before adding it to `accepted`).

  it('CENTROID_MAX_KM constant exists and is ≤ 2 km', () => {
    const m = routeGenSrc.match(/const\s+CENTROID_MAX_KM\s*=\s*([\d.]+)/);
    expect(m, 'CENTROID_MAX_KM constant missing — Sprint 11 bug 1 regression').not.toBeNull();
    const km = parseFloat(m![1]!);
    expect(km).toBeGreaterThan(0);
    expect(km, 'Founder spec: route centroid must be within ~1-2 km of anchor').toBeLessThanOrEqual(2.0);
  });

  it('routeCentroid + haversineKm helpers are exported from routeGen.js', () => {
    expect(routeGenSrc).toMatch(/export\s+function\s+routeCentroid\b/);
    expect(routeGenSrc).toMatch(/export\s+function\s+haversineKm\b/);
  });

  it('the gate is invoked inside the score+dedupe loop', () => {
    // Find the loop body that walks `orsResults`. Inside it we expect
    // a centroid distance check that compares against CENTROID_MAX_KM
    // and `continue`s when over.
    const loopMatch = routeGenSrc.match(
      /for\s*\(\s*const\s+route\s+of\s+orsResults\s*\)\s*\{([\s\S]*?)\n\s\s\}/,
    );
    expect(loopMatch, 'Could not find the orsResults loop in routeGen.js').not.toBeNull();
    const body = loopMatch![1]!;
    expect(body, 'centroid gate not wired into the orsResults loop').toMatch(/routeCentroid\s*\(/);
    expect(body, 'centroid gate not compared to CENTROID_MAX_KM').toMatch(/CENTROID_MAX_KM/);
    expect(body, 'centroid gate must continue (drop) when threshold exceeded').toMatch(/continue/);
  });

  it('cache prefix is bumped past v4 to invalidate pre-gate entries', () => {
    // v10.10.1 was on routes:v4. The centroid-gate ship needs to bump
    // past v4 so users with cached far-from-anchor routes get fresh ones.
    const m = routeGenSrc.match(/CACHE_PREFIX\s*=\s*['"]routes:(v\d+):/);
    expect(m, 'CACHE_PREFIX missing or non-versioned').not.toBeNull();
    const v = parseInt(m![1]!.slice(1), 10);
    expect(v, 'CACHE_PREFIX must be > v4 (the pre-centroid-gate value)').toBeGreaterThanOrEqual(5);
  });
});
