// Sprint 11 — pure-helper tests for src/lib/routeScoring.js.
// Scoring is the single biggest determinant of route-picker UX quality —
// off-by-one in the distance band, surface-bucket typo, or overlap math
// regression all show up to the user as "the picker shows wrong routes."

import { describe, it, expect } from 'vitest';
// @ts-expect-error — JS module
import { scoreCandidate } from '../../../../../src/lib/routeScoring.js';

// Fabricate a minimal ORS-shape route for scoring. Tests don't go through
// the adapter — that's the point of unit tests.
function makeRoute(overrides: Record<string, unknown> = {}) {
  return {
    distanceM: 30000,
    ascentM: 300,
    surfaceMix: { asphalt: 1.0, gravel: 0, unpaved: 0 },
    polyline: 'mock',
    elevations: [],
    dominantSurface: 'asphalt',
    ...overrides,
  };
}

describe('lib/routeScoring scoreCandidate', () => {
  it('returns null when actualKm is below 80% of target (distance gate)', () => {
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 23000 }), // 23km vs target 30 = 76%
      targetDistanceKm: 30,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(result).toBeNull();
  });

  it('returns null when actualKm is above 120% of target (distance gate)', () => {
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 40000 }), // 40km vs target 30 = 133%
      targetDistanceKm: 30,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(result).toBeNull();
  });

  it('returns a score breakdown when distance is at the target', () => {
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 30000, ascentM: 660 }), // 22 m/km — bang on medium centre
      targetDistanceKm: 30,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(result).not.toBeNull();
    expect(result.breakdown.distance_match).toBe(1);
    expect(result.breakdown.surface_match).toBe(1); // 100% asphalt for road
    expect(result.score).toBeGreaterThan(0.85); // ~0.9 with all matches
  });

  it('penalises surface mismatch for gravel rider on 100% asphalt route', () => {
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 30000, surfaceMix: { asphalt: 1.0, gravel: 0, unpaved: 0 } }),
      targetDistanceKm: 30,
      cyclingType: 'gravel',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(result).not.toBeNull();
    expect(result.breakdown.surface_match).toBe(0); // gravel rider, road route
  });

  it('rewards mtb rider on a mostly-unpaved route', () => {
    const result = scoreCandidate({
      route: makeRoute({
        distanceM: 30000,
        surfaceMix: { asphalt: 0.1, gravel: 0.4, unpaved: 0.5 },
      }),
      targetDistanceKm: 30,
      cyclingType: 'mtb',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(result.breakdown.surface_match).toBeCloseTo(0.9, 2); // (0.4 + 0.5) / 1.0
  });

  it('hard-rejects routes that overlap >70% with a prior accepted route', () => {
    // Construct a `prior` and `decodedPoints` that sit on the same coarse
    // grid so >70% overlap.
    const points: Array<[number, number]> = [];
    for (let i = 0; i < 100; i++) points.push([51.5 + i * 0.0001, -0.1]);
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 30000 }),
      targetDistanceKm: 30,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [points],
      decodedPoints: points,
      origin: null,
    });
    expect(result).toBeNull();
  });

  it('rejects routes whose farthest point exceeds 45% of target distance from origin (proximity gate)', () => {
    // Origin: 0,0. Target 50 km. Farthest allowed = 22.5 km.
    // 1° latitude ≈ 111 km. So 0.3° ≈ 33 km > 22.5.
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 50000 }),
      targetDistanceKm: 50,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0], [0.3, 0]],
      origin: [0, 0],
    });
    expect(result).toBeNull();
  });

  it('accepts routes where the farthest point is within the proximity gate', () => {
    // 50km target, allowed 22.5km. 0.1° ≈ 11.1km — well within.
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 50000 }),
      targetDistanceKm: 50,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0], [0.1, 0]],
      origin: [0, 0],
    });
    expect(result).not.toBeNull();
  });

  it('elevation_match peaks at the band centre for the chosen preference', () => {
    // medium = 22 m/km. A 30km route w/ ascent 22*30=660 m hits the centre.
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 30000, ascentM: 660 }),
      targetDistanceKm: 30,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(result.breakdown.elevation_match).toBe(1);
  });

  it('score breakdown contains exactly the documented keys', () => {
    const result = scoreCandidate({
      route: makeRoute({ distanceM: 30000, ascentM: 660 }),
      targetDistanceKm: 30,
      cyclingType: 'road',
      elevationPref: 'medium',
      priorPoints: [],
      decodedPoints: [[0, 0]],
      origin: null,
    });
    expect(Object.keys(result.breakdown).sort()).toEqual([
      'distance_match',
      'elevation_match',
      'overlap_penalty',
      'surface_match',
    ]);
  });
});
