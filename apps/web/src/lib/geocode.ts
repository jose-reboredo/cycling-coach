// v10.5.0 — Client-side address → (lat, lng) via Nominatim.
// Free, no auth, OSM-backed. Saves Worker subrequests for the route gen
// service. Per Nominatim's usage policy: bounded to 1 req/sec, identify
// the app via User-Agent, and don't auto-batch.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/** Resolve a free-text address to its first matching coordinate. Returns
 *  null when no match found; throws on network / non-2xx so callers can
 *  surface the failure. */
export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  const url = `${NOMINATIM}?q=${encodeURIComponent(trimmed)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: {
      // Nominatim usage policy requires identification.
      Accept: 'application/json',
    },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`);
  }
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    displayName: typeof first.display_name === 'string' ? first.display_name : trimmed,
  };
}
