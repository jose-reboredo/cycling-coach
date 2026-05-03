// Sprint 11 — pure-helper tests for src/lib/waypointGen.js.
// generateLoopCandidates is deterministic: same (origin, distance, seed)
// → identical waypoints. KV caching depends on it. makeRng is the seed
// source — both must round-trip cleanly.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — JS module
import { generateLoopCandidates, makeRng } from '../../../../../src/lib/waypointGen.js';

describe('lib/waypointGen makeRng', () => {
  it('returns the same value for the same (seed, salt, range)', () => {
    const rng = makeRng('abc123');
    const a = rng(0, 1, 'angle-0');
    const b = rng(0, 1, 'angle-0');
    expect(a).toBe(b);
  });

  it('returns values within [min, max)', () => {
    const rng = makeRng('seed');
    for (let i = 0; i < 20; i++) {
      const v = rng(-5, 5, `salt-${i}`);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(5);
    }
  });

  it('different salts produce different values for the same seed', () => {
    const rng = makeRng('same-seed');
    const a = rng(0, 100, 'salt-A');
    const b = rng(0, 100, 'salt-B');
    expect(a).not.toBe(b);
  });

  it('different seeds produce different values for the same salt', () => {
    const a = makeRng('seed-A')(0, 100, 'salt');
    const b = makeRng('seed-B')(0, 100, 'salt');
    expect(a).not.toBe(b);
  });
});

describe('lib/waypointGen generateLoopCandidates', () => {
  const baseArgs = {
    lat: 51.5074,
    lng: -0.1278,
    distanceKm: 30,
    candidateCount: 5,
    rng: makeRng('fixed-seed'),
  };

  it('produces the requested number of candidates', () => {
    const candidates = generateLoopCandidates(baseArgs);
    expect(candidates.length).toBe(5);
  });

  it('every candidate starts and ends at the origin (loop closure)', () => {
    const candidates = generateLoopCandidates(baseArgs);
    for (const wps of candidates) {
      expect(wps[0]).toEqual([baseArgs.lat, baseArgs.lng]);
      expect(wps[wps.length - 1]).toEqual([baseArgs.lat, baseArgs.lng]);
    }
  });

  it('alternates between 3-waypoint and 4-waypoint loops', () => {
    const candidates = generateLoopCandidates(baseArgs);
    // length = 1 (origin) + N waypoints + 1 (origin) = N + 2
    // i=0 → wpCount=3 → length 5; i=1 → wpCount=4 → length 6; etc.
    expect(candidates[0]!.length).toBe(5);
    expect(candidates[1]!.length).toBe(6);
    expect(candidates[2]!.length).toBe(5);
    expect(candidates[3]!.length).toBe(6);
  });

  it('is deterministic — same args produce identical output (cache invariant)', () => {
    const a = generateLoopCandidates({ ...baseArgs, rng: makeRng('seed-X') });
    const b = generateLoopCandidates({ ...baseArgs, rng: makeRng('seed-X') });
    expect(a).toEqual(b);
  });

  it('different rng seeds produce different waypoints', () => {
    const a = generateLoopCandidates({ ...baseArgs, rng: makeRng('seed-A') });
    const b = generateLoopCandidates({ ...baseArgs, rng: makeRng('seed-B') });
    expect(a).not.toEqual(b);
  });

  it('candidates 0 distinct from candidates 1 within a single batch', () => {
    // Without this, all candidates would be variations on the same loop.
    const candidates = generateLoopCandidates(baseArgs);
    expect(candidates[0]).not.toEqual(candidates[1]);
  });
});
