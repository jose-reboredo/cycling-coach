// v10.13.0 (sprint-11) — unit tests for the pure geo-math helpers
// powering the centroid-anchor and Strava-relevance fixes.

import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  centroid,
  filterWithinRadius,
  decodeFirstPoint,
  EARTH_RADIUS_KM,
} from '../geoMath';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(47.3769, 8.5417, 47.3769, 8.5417)).toBe(0);
  });

  it('matches the known Zurich → Bern distance (~95 km, ±2%)', () => {
    // Zurich Hbf (47.3779, 8.5403) to Bern Hbf (46.9481, 7.4474)
    const d = haversineKm(47.3779, 8.5403, 46.9481, 7.4474);
    // Real-world great-circle distance is ~94.5 km; allow 2% slack.
    expect(d).toBeGreaterThan(92.6);
    expect(d).toBeLessThan(96.4);
  });

  it('matches Zurich → Positano at ~900 km (the Path-of-Gods bug case)', () => {
    // Zurich (47.3769, 8.5417) → Positano (40.6280, 14.4844)
    // Used to verify the 50 km radius gate would reject this route.
    const d = haversineKm(47.3769, 8.5417, 40.6280, 14.4844);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1000);
  });

  it('is symmetric', () => {
    const a = haversineKm(47.3769, 8.5417, 46.9481, 7.4474);
    const b = haversineKm(46.9481, 7.4474, 47.3769, 8.5417);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });

  it('handles antipodal-ish points without NaN', () => {
    // Roughly antipodal — result should be near π × R = 20015 km.
    const d = haversineKm(0, 0, 0, 179.9);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(EARTH_RADIUS_KM * 3);
  });
});

describe('centroid', () => {
  it('returns null for empty input', () => {
    expect(centroid([])).toBeNull();
  });

  it('returns the only point for single-element input', () => {
    expect(centroid([[47.3769, 8.5417]])).toEqual({ lat: 47.3769, lng: 8.5417 });
  });

  it('computes the arithmetic mean for multi-point input', () => {
    const c = centroid([
      [47.0, 8.0],
      [48.0, 9.0],
      [47.5, 8.5],
    ]);
    expect(c?.lat).toBeCloseTo(47.5, 5);
    expect(c?.lng).toBeCloseTo(8.5, 5);
  });

  it('handles a perfect Zurich loop centred on the anchor', () => {
    // Four points around Zurich Hbf — centroid should be back at Hbf.
    const hbf: [number, number] = [47.3779, 8.5403];
    const offset = 0.01;
    const c = centroid([
      [hbf[0] + offset, hbf[1]],
      [hbf[0] - offset, hbf[1]],
      [hbf[0], hbf[1] + offset],
      [hbf[0], hbf[1] - offset],
    ]);
    expect(c?.lat).toBeCloseTo(hbf[0], 5);
    expect(c?.lng).toBeCloseTo(hbf[1], 5);
  });
});

describe('filterWithinRadius', () => {
  const zurich = { lat: 47.3769, lng: 8.5417 };
  const bern = { lat: 46.9481, lng: 7.4474 }; // ~95 km away
  const positano = { lat: 40.6280, lng: 14.4844 }; // ~900 km away

  type R = { id: string; coord: { lat: number; lng: number } | null };

  const items: R[] = [
    { id: 'zurich-loop', coord: zurich },
    { id: 'bern-loop', coord: bern },
    { id: 'positano-hike', coord: positano },
    { id: 'unknown-route', coord: null },
  ];

  it('keeps routes within radius (50 km drops Bern)', () => {
    const result = filterWithinRadius(items, zurich, 50, (r) => r.coord);
    expect(result.map((r) => r.id)).toEqual(['zurich-loop']);
  });

  it('100 km radius keeps Zurich + Bern but drops Positano', () => {
    const result = filterWithinRadius(items, zurich, 100, (r) => r.coord);
    expect(result.map((r) => r.id)).toEqual(['zurich-loop', 'bern-loop']);
  });

  it('drops items with null coord (we don\'t rank what we don\'t know)', () => {
    const result = filterWithinRadius(items, zurich, 10000, (r) => r.coord);
    expect(result.map((r) => r.id)).toEqual(['zurich-loop', 'bern-loop', 'positano-hike']);
  });

  it('2 km radius keeps only routes truly anchored at Zurich', () => {
    // The bug 1 case — when the user typed "Zurich", a route with
    // centroid 5 km away would be dropped.
    const close = { id: 'true-zurich', coord: { lat: 47.380, lng: 8.545 } };
    const drift = { id: 'drifted', coord: { lat: 47.42, lng: 8.60 } };
    const result = filterWithinRadius([close, drift], zurich, 2.0, (r) => r.coord);
    expect(result.map((r) => r.id)).toEqual(['true-zurich']);
  });
});

describe('decodeFirstPoint', () => {
  it('returns null for empty / non-string input', () => {
    expect(decodeFirstPoint('')).toBeNull();
    // @ts-expect-error — testing runtime guard against bad input
    expect(decodeFirstPoint(null)).toBeNull();
    // @ts-expect-error — testing runtime guard against bad input
    expect(decodeFirstPoint(undefined)).toBeNull();
  });

  it('decodes a known polyline starting at (38.5, -120.2)', () => {
    // Canonical Google polyline-spec example: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
    // First decoded pair = (38.5, -120.2).
    const p = decodeFirstPoint('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(p).not.toBeNull();
    expect(p!.lat).toBeCloseTo(38.5, 5);
    expect(p!.lng).toBeCloseTo(-120.2, 5);
  });

  it('returns null on malformed input (truncated mid-byte)', () => {
    // Single character — not enough to read a full lat varint.
    expect(decodeFirstPoint('A')).toBeNull();
  });
});

describe('combined: anchor-rank Strava saved routes', () => {
  // Integration test for the bug 2 fix: filter the Strava feed by
  // anchor + 50 km radius using the helpers in concert.
  it('filters Path-of-Gods (Positano) when anchor is Zurich', () => {
    const zurich = { lat: 47.3769, lng: 8.5417 };
    const stravaFeed = [
      { id: 1, name: 'Albis Loop', poly: { lat: 47.32, lng: 8.50 } },
      { id: 2, name: 'Üetliberg', poly: { lat: 47.35, lng: 8.49 } },
      { id: 3, name: 'Path of Gods', poly: { lat: 40.6280, lng: 14.4844 } },
    ];
    const filtered = filterWithinRadius(stravaFeed, zurich, 50, (r) => r.poly);
    expect(filtered.map((r) => r.name)).toEqual(['Albis Loop', 'Üetliberg']);
  });
});
