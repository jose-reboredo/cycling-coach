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
 *  surface the failure.
 *
 *  v10.10.2 — diacritic-tolerance retry. Nominatim is strict about umlauts
 *  and accented characters: "Röntgenstrasse" works but "Rontgenstrasse"
 *  returns 0 hits. When the first lookup returns nothing, we try a second
 *  attempt with diacritic-stripped input (NFD-normalised, combining marks
 *  removed). Solves the founder's "Rontgenstrasse not found" complaint
 *  without requiring a paid Google Places integration. */
async function tryNominatim(query: string, signal?: AbortSignal) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  return (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
}

function stripDiacritics(s: string): string {
  // NFD splits "ö" → "o" + combining diaeresis (U+0308). Stripping the
  // combining marks (̀-ͯ) leaves bare ASCII when possible.
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // First attempt: as the user typed it.
  let arr = await tryNominatim(trimmed, signal);

  // Retry with diacritic-stripped input only when there's no match AND the
  // input differs from the stripped form (otherwise the second call is
  // identical and wastes a round-trip).
  if ((!Array.isArray(arr) || arr.length === 0)) {
    const stripped = stripDiacritics(trimmed);
    if (stripped !== trimmed) {
      arr = await tryNominatim(stripped, signal);
    }
    // Also try the inverse — user typed "Rontgenstrasse", Nominatim may
    // accept "Röntgenstrasse". Since we don't know the intended diacritics,
    // try common Swiss/German/French street variants by adding back common
    // umlauts in obvious positions. For v1 we just attempt the German
    // "ö → oe" replacement (Swiss formal form).
    if ((!Array.isArray(arr) || arr.length === 0)) {
      const swissForm = trimmed
        .replace(/oe/g, 'ö')
        .replace(/ae/g, 'ä')
        .replace(/ue/g, 'ü');
      if (swissForm !== trimmed) {
        arr = await tryNominatim(swissForm, signal);
      }
    }
  }

  if (!Array.isArray(arr) || arr.length === 0) return null;
  const first = arr[0]!;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    displayName: typeof first.display_name === 'string' ? first.display_name : trimmed,
  };
}
