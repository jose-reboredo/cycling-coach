// Sprint 11 — pure-helper tests for src/lib/polyline.js (encode/decode).
//
// The Worker-side polyline lib has zero dependencies and is round-trip
// safe by spec (Google Encoded Polyline Algorithm). The route-generation
// pipeline relies on `decodePolyline` for GPX serialization and overlap
// scoring; a regression here breaks downloads silently.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — JS module without types; fine for test usage.
import { decodePolyline, encodePolyline } from '../../../../../src/lib/polyline.js';

describe('lib/polyline encode/decode', () => {
  it('decodes the empty string to an empty array', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('decodes a non-string input safely', () => {
    // The JS module is untyped at the import site so passing null/undefined
    // is fine for the runtime-safety branch we're exercising here.
    expect(decodePolyline(null)).toEqual([]);
    expect(decodePolyline(undefined)).toEqual([]);
  });

  it('encodes [] to the empty string', () => {
    expect(encodePolyline([])).toBe('');
  });

  it('round-trips a single point at 5dp precision', () => {
    const original: Array<[number, number]> = [[38.5, -120.2]];
    const encoded = encodePolyline(original);
    const decoded = decodePolyline(encoded);
    expect(decoded.length).toBe(1);
    expect(decoded[0]![0]).toBeCloseTo(38.5, 4);
    expect(decoded[0]![1]).toBeCloseTo(-120.2, 4);
  });

  it('round-trips the canonical Google example sequence', () => {
    // Test fixture from the Google polyline algorithm reference page.
    const original: Array<[number, number]> = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    const decoded = decodePolyline(encodePolyline(original));
    expect(decoded.length).toBe(3);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]![0]).toBeCloseTo(original[i]![0], 4);
      expect(decoded[i]![1]).toBeCloseTo(original[i]![1], 4);
    }
  });

  it('matches the documented Google reference encoding for that sequence', () => {
    // Per the algorithm spec: the canonical encoding is `_p~iF~ps|U_ulLnnqC_mqNvxq`@`.
    const original: Array<[number, number]> = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    expect(encodePolyline(original)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('handles negative latitudes and longitudes (southern + western hemispheres)', () => {
    const original: Array<[number, number]> = [
      [-33.8688, 151.2093], // Sydney
      [-34.9285, 138.6007], // Adelaide
    ];
    const decoded = decodePolyline(encodePolyline(original));
    expect(decoded[0]![0]).toBeCloseTo(-33.8688, 3);
    expect(decoded[0]![1]).toBeCloseTo(151.2093, 3);
    expect(decoded[1]![0]).toBeCloseTo(-34.9285, 3);
    expect(decoded[1]![1]).toBeCloseTo(138.6007, 3);
  });
});
