// Loop-route waypoint scaffolding.
// Given a centre coordinate and target distance, generate K candidate
// waypoint sequences (origin → wp1 → wp2 → ... → origin) that the routing
// engine can turn into real road-following loops. Deterministic: same
// (origin, distance, seed) produces identical waypoints — required for
// caching and reproducibility.
//
// Math:
//   - radius = target_km / (2π)        (scales perimeter to target_km)
//   - per-candidate jitter: angle offset (full rotation step + ±15° wobble)
//                           radius mult (±15%)
//                           waypoint count alternates 3 / 4
//   - waypoints placed on circle around origin via Haversine inverse
//     (good enough for city/region scale; not survey-grade)

const EARTH_R = 6371; // km

/**
 * Build K candidate waypoint sequences. Each is [[lat, lng], ...] where
 * the first and last entries are the origin (loop closure).
 *
 * @param {object} args
 * @param {number} args.lat
 * @param {number} args.lng
 * @param {number} args.distanceKm   Target ridden distance (real route will
 *                                   be slightly longer due to road network).
 * @param {number} args.candidateCount
 * @param {(min:number, max:number, salt:string) => number} args.rng
 *                                   Deterministic in [min, max).
 * @returns {Array<Array<[number, number]>>}
 */
export function generateLoopCandidates({ lat, lng, distanceKm, candidateCount, rng }) {
  const baseRadius = distanceKm / (2 * Math.PI);
  const candidates = [];
  for (let i = 0; i < candidateCount; i++) {
    const wpCount = i % 2 === 0 ? 3 : 4;
    // Angle offset: spread loops around the compass (i × 360/N), with
    // ±15° wobble per candidate so two routes don't have identical shapes.
    const baseAngle = (i * 360) / candidateCount;
    const angleOffset = baseAngle + rng(-15, 15, `angle-${i}`);
    // Radius jitter: ±15% so candidates have different overall scale.
    const radiusMult = 1 + rng(-0.15, 0.15, `radius-${i}`);
    const radius = baseRadius * radiusMult;
    const waypoints = [[lat, lng]];
    for (let w = 0; w < wpCount; w++) {
      const angleDeg = angleOffset + (360 / wpCount) * w;
      const [wlat, wlng] = pointAtBearing(lat, lng, radius, angleDeg);
      waypoints.push([wlat, wlng]);
    }
    waypoints.push([lat, lng]); // close the loop
    candidates.push(waypoints);
  }
  return candidates;
}

/**
 * Haversine inverse: starting at (lat, lng), travel `distanceKm` along
 * `bearingDeg` (0 = north, 90 = east). Returns the destination [lat, lng].
 */
function pointAtBearing(lat, lng, distanceKm, bearingDeg) {
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const θ = (bearingDeg * Math.PI) / 180;
  const δ = distanceKm / EARTH_R;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return [(φ2 * 180) / Math.PI, ((((λ2 * 180) / Math.PI) + 540) % 360) - 180];
}

/**
 * Deterministic RNG factory. `seedHex` is the SHA-256 hex of the request
 * payload; salt produces independent sub-streams per call site so radius
 * jitter doesn't correlate with angle jitter for the same candidate.
 */
export function makeRng(seedHex) {
  return function rng(min, max, salt) {
    // Mix seedHex + salt → uint32 → [0, 1)
    const mixed = `${seedHex}::${salt}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < mixed.length; i++) {
      h ^= mixed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const u = h / 0xffffffff;
    return min + u * (max - min);
  };
}
