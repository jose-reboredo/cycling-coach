// v10.13.0 (sprint-11) — Pure geo-math helpers used by the route picker
// to enforce anchor-proximity for both ORS-generated routes and Strava-
// saved routes.
//
// Why these live in the web package (not the worker):
//   - The Strava saved-routes ranker runs on the worker, but we also rank
//     candidates client-side after the worker filters them. Sharing the
//     helper avoids drift in the haversine formula.
//   - The worker has its own copy in src/lib/routeScoring.js (see
//     haversineKm there). Both compute the same Earth-radius constant
//     (6371 km) and use the same formula; a contract test asserts the
//     worker copy still exists.
//
// All functions here are pure — no side effects, no I/O — so they're
// covered by simple unit tests in __tests__/geoMath.test.ts.

/** Mean Earth radius in km (WGS84 spherical approximation). */
export const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two (lat, lng) points in km.
 * Uses the Haversine formula — accurate to ~0.5% at city scale, which
 * is more than enough for the 2 km / 50 km gates we apply here.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) * Math.sin(dφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) * Math.sin(dλ / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Centroid (arithmetic mean of lat / lng) of a list of points. Returns
 * null when the list is empty so callers don't have to special-case it.
 *
 * Note: arithmetic mean is correct enough for short loops (< 100 km
 * across) where the curvature of the Earth is negligible. For routes
 * spanning continents we'd switch to a 3D Cartesian centroid; here we
 * don't need that.
 */
export function centroid(
  points: Array<[number, number]>,
): { lat: number; lng: number } | null {
  if (!Array.isArray(points) || points.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  for (const [lat, lng] of points) {
    latSum += lat;
    lngSum += lng;
  }
  return {
    lat: latSum / points.length,
    lng: lngSum / points.length,
  };
}

/**
 * Reject items whose anchor distance exceeds `maxKm`. Caller provides a
 * function that extracts (lat, lng) from each item so this stays generic
 * across Strava saved routes, ORS generated routes, RWGPS routes, etc.
 *
 * Items returning null from `getCoord` are dropped (we can't rank what
 * we don't know). Callers that want lenient behavior should default the
 * coord to the anchor itself before calling this helper.
 */
export function filterWithinRadius<T>(
  items: T[],
  anchor: { lat: number; lng: number },
  maxKm: number,
  getCoord: (item: T) => { lat: number; lng: number } | null,
): T[] {
  return items.filter((item) => {
    const coord = getCoord(item);
    if (!coord) return false;
    const d = haversineKm(anchor.lat, anchor.lng, coord.lat, coord.lng);
    return d <= maxKm;
  });
}

/**
 * Decode the lat/lng of the first point of an encoded polyline (Google's
 * polyline algorithm — Strava and ORS both use it).
 *
 * Strava saved routes don't return start_lat/start_lng directly; the
 * `map.summary_polyline` field is the only geo signal in the
 * /athlete/routes payload. We only need the first point to anchor-rank
 * the route, so we decode just one pair instead of the whole geometry.
 *
 * Returns null on malformed input so callers can fall back to "unknown
 * coord = drop from list".
 */
export function decodeFirstPoint(polyline: string): { lat: number; lng: number } | null {
  if (typeof polyline !== 'string' || polyline.length === 0) return null;
  let index = 0;
  let lat = 0;
  let lng = 0;
  // Read latitude
  let result = 0;
  let shift = 0;
  let b: number;
  do {
    if (index >= polyline.length) return null;
    b = polyline.charCodeAt(index++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  lat += (result & 1) ? ~(result >> 1) : (result >> 1);
  // Read longitude
  result = 0;
  shift = 0;
  do {
    if (index >= polyline.length) return null;
    b = polyline.charCodeAt(index++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  lng += (result & 1) ? ~(result >> 1) : (result >> 1);
  return { lat: lat / 1e5, lng: lng / 1e5 };
}
