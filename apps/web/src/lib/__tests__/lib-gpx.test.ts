// Sprint 11 — pure-helper tests for src/lib/gpxSerializer.js.
// Strava/RWGPS/Komoot all consume the output. XML escaping is the highest-
// risk branch (a stray `&` in a track name silently invalidates the file).

import { describe, it, expect } from 'vitest';
// @ts-expect-error — JS module
import { buildGpx } from '../../../../../src/lib/gpxSerializer.js';

describe('lib/gpxSerializer', () => {
  it('produces a syntactically minimal GPX 1.1 document', () => {
    const gpx = buildGpx({ name: 'Test', points: [[51.5, -0.1]] });
    expect(gpx).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('<trkseg>');
    expect(gpx).toContain('</gpx>');
  });

  it('escapes special XML characters in the track name', () => {
    const gpx = buildGpx({
      name: 'Loop & climb <fast> "test\'s"',
      points: [[51.5, -0.1]],
    });
    expect(gpx).toContain('Loop &amp; climb &lt;fast&gt; &quot;test&apos;s&quot;');
    // And does NOT contain the raw special characters in the name slot.
    expect(gpx).not.toContain('Loop & climb <fast>');
  });

  it('serializes lat/lng to 6 decimal places (≈11cm precision)', () => {
    const gpx = buildGpx({ name: 'precision', points: [[51.5074, -0.1278]] });
    expect(gpx).toMatch(/lat="51\.507400"/);
    expect(gpx).toMatch(/lon="-0\.127800"/);
  });

  it('omits <ele> when no elevations array is provided', () => {
    const gpx = buildGpx({ name: 'no-ele', points: [[1, 2]] });
    expect(gpx).not.toContain('<ele>');
    expect(gpx).toContain('<trkpt lat="1.000000" lon="2.000000"/>');
  });

  it('emits <ele> when elevations match points length', () => {
    const gpx = buildGpx({
      name: 'with-ele',
      points: [[1, 2], [3, 4]],
      elevations: [10, 20],
    });
    expect(gpx).toContain('<ele>10.0</ele>');
    expect(gpx).toContain('<ele>20.0</ele>');
  });

  it('skips <ele> when elevations length mismatches (defensive)', () => {
    const gpx = buildGpx({
      name: 'mismatch',
      points: [[1, 2], [3, 4]],
      elevations: [10],
    });
    expect(gpx).not.toContain('<ele>');
  });

  it('handles empty point list (produces empty <trkseg>)', () => {
    const gpx = buildGpx({ name: 'empty', points: [] });
    expect(gpx).toContain('<trkseg></trkseg>');
  });

  it('writes "0.0" elevation when elevation is non-finite (NaN/null)', () => {
    const gpx = buildGpx({
      name: 'nan-ele',
      points: [[1, 2]],
      elevations: [NaN],
    });
    expect(gpx).toContain('<ele>0.0</ele>');
  });
});
