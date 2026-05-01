// v10.5.0 — Client for the route-generation Worker endpoint added in
// v10.4.0. Bearer-auth via the session token (matches clubsApi pattern).

import { ensureValidToken } from './auth';

export type CyclingType = 'road' | 'gravel' | 'mtb';
export type ElevationPreference = 'low' | 'medium' | 'high';

export interface GenerateRoutesInput {
  lat: number;
  lng: number;
  distance_km: number;
  cycling_type: CyclingType;
  elevation_preference: ElevationPreference;
}

export interface GeneratedRoute {
  id: string;
  distance_km: number;
  elevation_gain_m: number;
  surface_type: 'asphalt' | 'gravel' | 'unpaved' | string;
  polyline: string;
  gpx: string;
  score: number;
  score_breakdown: {
    distance_match: number;
    elevation_match: number;
    surface_match: number;
    overlap_penalty: number;
  };
}

export async function generateRoutes(input: GenerateRoutesInput): Promise<GeneratedRoute[]> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/routes/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `route generation failed (${res.status})`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await res.json()) as GeneratedRoute[];
}

/** v10.5.0 — Trigger a browser download of a GPX string as a .gpx file.
 *  Used by the route picker's "Start in Strava" handoff: download the
 *  GPX, open Strava routes upload page, user drag-drops to upload. */
export function downloadGpx(filename: string, gpx: string): void {
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.gpx') ? filename : `${filename}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the click has time to register.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
