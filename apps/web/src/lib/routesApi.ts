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

// v10.5.4 — Saved Strava routes proxy (existing Worker endpoint
// /api/routes/saved, added in v9.3.0 #47). Lets the picker offer the
// user's already-saved Strava routes alongside freshly-generated ones,
// ranked by match to the session's target distance.

export interface SavedStravaRoute {
  id: number;
  name: string;
  distance_m: number;
  elevation_gain_m: number;
  surface: 'paved' | 'gravel' | 'unknown' | string;
  map_url: string | null;
  /** Direct link to view/start the route on Strava. Saved routes don't
   *  need a GPX download — Strava already has them. */
  strava_url: string | null;
}

export interface FetchSavedStravaRoutesInput {
  /** Target distance in km. Backend applies a ±20% band filter. Optional;
   *  omit to browse all saved routes regardless of distance. */
  distanceKm?: number;
  /** 'any' | 'paved' | 'gravel'. */
  surface?: string;
  /** 'flat' | 'rolling' | 'hilly' — m/km elevation bands. */
  difficulty?: string;
}

export async function fetchSavedStravaRoutes(input: FetchSavedStravaRoutesInput = {}): Promise<SavedStravaRoute[]> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const params = new URLSearchParams();
  if (input.distanceKm != null) params.set('distance', String(input.distanceKm));
  if (input.surface) params.set('surface', input.surface);
  if (input.difficulty) params.set('difficulty', input.difficulty);
  const qs = params.toString();
  const url = `/api/routes/saved${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `saved routes fetch failed (${res.status})`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const json = await res.json();
  return Array.isArray(json?.routes) ? json.routes as SavedStravaRoute[] : [];
}

// ---------------------------------------------------------------------------
// v10.6.0 — Ride with GPS as a third route source (after Strava saved and
// ORS-generated). User connects once via /authorize-rwgps → /callback-rwgps;
// the picker reads /api/rwgps/status to know whether to show "Connect" or
// fetch routes.
// ---------------------------------------------------------------------------

export interface RwgpsStatus {
  connected: boolean;
  rwgps_user_id: number | null;
  expires_at: number | null;
}

export interface RwgpsRoute {
  id: number;
  name: string;
  distance_m: number;
  elevation_gain_m: number;
  surface: 'paved' | 'gravel' | 'unknown' | string;
  rwgps_url: string;
}

export async function fetchRwgpsStatus(): Promise<RwgpsStatus> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/rwgps/status', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) {
    throw new Error(`rwgps status ${res.status}`);
  }
  return (await res.json()) as RwgpsStatus;
}

export async function disconnectRwgps(): Promise<void> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/rwgps/disconnect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) {
    throw new Error(`rwgps disconnect ${res.status}`);
  }
}

export interface FetchRwgpsRoutesInput {
  distanceKm?: number;
  difficulty?: string;
}

export async function fetchRwgpsRoutes(input: FetchRwgpsRoutesInput = {}): Promise<RwgpsRoute[]> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const params = new URLSearchParams();
  if (input.distanceKm != null) params.set('distance', String(input.distanceKm));
  if (input.difficulty) params.set('difficulty', input.difficulty);
  const qs = params.toString();
  const url = `/api/routes/rwgps-saved${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `rwgps routes ${res.status}`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  const json = await res.json();
  return Array.isArray(json?.routes) ? json.routes as RwgpsRoute[] : [];
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
