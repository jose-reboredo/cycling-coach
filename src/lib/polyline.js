// Google Encoded Polyline Algorithm — encode/decode.
// https://developers.google.com/maps/documentation/utilities/polylinealgorithm
//
// Used by the route-generation service:
//   - encode: not used (ORS returns encoded polyline directly when we ask)
//   - decode: convert ORS polyline back into [lat, lng] pairs for GPX + scoring
//
// 5-decimal-place precision (factor 1e5) is the ORS default.

const FACTOR = 1e5;

/**
 * Decode an encoded polyline string into [[lat, lng], ...] pairs.
 * Used for GPX serialization (we need lat/lng pairs) and overlap scoring
 * (sample points to compare against other routes).
 */
export function decodePolyline(str) {
  if (!str || typeof str !== 'string') return [];
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let b;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push([lat / FACTOR, lng / FACTOR]);
  }
  return points;
}

/** Encode a list of [lat, lng] pairs back to a polyline string. Provided
 *  for symmetry / round-trip tests; not used in the request path. */
export function encodePolyline(points) {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const iLat = Math.round(lat * FACTOR);
    const iLng = Math.round(lng * FACTOR);
    result += encodeNumber(iLat - prevLat);
    result += encodeNumber(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }
  return result;
}

function encodeNumber(num) {
  let n = num < 0 ? ~(num << 1) : (num << 1);
  let result = '';
  while (n >= 0x20) {
    result += String.fromCharCode(((0x20 | (n & 0x1f)) + 63));
    n >>= 5;
  }
  result += String.fromCharCode(n + 63);
  return result;
}
