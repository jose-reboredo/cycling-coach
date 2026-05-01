// Route scoring — how well a candidate matches the user's request.
//
// Final score = w_d × distance_match
//             + w_e × elevation_match
//             + w_s × surface_match
//             − w_o × overlap_penalty
//
// Defaults (founder-approved v10.4.0):
//   w_d = 0.40   distance_match has the largest weight — wrong distance = wrong session
//   w_s = 0.30   surface_match  — gravel rider doesn't want a road loop and vice-versa
//   w_e = 0.20   elevation_match — preference matters but bands are wide
//   w_o = 0.10   overlap_penalty — discourages near-duplicate alternatives

const WEIGHTS = { distance: 0.40, elevation: 0.20, surface: 0.30, overlap: 0.10 };

// Elevation preference → m/km band centre.
const ELEVATION_BAND = {
  low: { centre: 5, half: 12 },     // 0-15  m/km   ≈ Zürich lakeshore
  medium: { centre: 22, half: 12 }, // 15-30 m/km   ≈ rolling
  high: { centre: 50, half: 25 },   // 30+   m/km   ≈ alpine
};

// Cycling type → preferred surface bucket(s).
const SURFACE_PREF = {
  road: ['asphalt'],
  gravel: ['gravel', 'unpaved'],
  mtb: ['unpaved', 'gravel'],
};

/**
 * Score a single candidate route.
 * @param {object} args
 * @param {Object} args.route             ORSRoute (from orsAdapter)
 * @param {number} args.targetDistanceKm
 * @param {string} args.cyclingType       'road' | 'gravel' | 'mtb'
 * @param {string} args.elevationPref     'low' | 'medium' | 'high'
 * @param {Array<Array<[number, number]>>} args.priorPoints
 *                                        Decoded geometries of already-accepted
 *                                        routes (for overlap penalty).
 * @returns {{ score: number, breakdown: object } | null}
 *         Returns null if hard validation fails (out-of-distance-band etc.).
 */
export function scoreCandidate({
  route,
  targetDistanceKm,
  cyclingType,
  elevationPref,
  priorPoints,
  decodedPoints,
}) {
  const actualKm = route.distanceM / 1000;

  // v10.5.3 — distance gate loosened from ±10% to ±20%. Even with a 25%
  // scaffold undershoot, road-network variance can push routes past 10%
  // off-target. The score still rewards exact matches and falls to 0 at
  // the ±20% edge so picky users get the closest first.
  if (actualKm < targetDistanceKm * 0.8 || actualKm > targetDistanceKm * 1.2) {
    return null;
  }

  // distance_match: 1 when exact, drops linearly to 0 at the ±20% edge.
  const distanceDelta = Math.abs(actualKm - targetDistanceKm) / targetDistanceKm;
  const distanceMatch = Math.max(0, 1 - distanceDelta * 5);

  // elevation_match: bell shape around band centre.
  const elevPerKm = actualKm > 0 ? route.ascentM / actualKm : 0;
  const band = ELEVATION_BAND[elevationPref] || ELEVATION_BAND.medium;
  const elevDelta = Math.abs(elevPerKm - band.centre);
  const elevationMatch = Math.max(0, 1 - elevDelta / Math.max(band.half, 1));

  // surface_match: % of route distance matching preferred surface(s).
  const prefBuckets = SURFACE_PREF[cyclingType] || SURFACE_PREF.road;
  const totalSurface = (route.surfaceMix.asphalt || 0)
    + (route.surfaceMix.gravel || 0)
    + (route.surfaceMix.unpaved || 0);
  let preferredSum = 0;
  for (const bucket of prefBuckets) preferredSum += route.surfaceMix[bucket] || 0;
  const surfaceMatch = totalSurface > 0 ? preferredSum / totalSurface : 0;

  // overlap_penalty: max overlap with any prior accepted route.
  let overlapPenalty = 0;
  for (const prior of priorPoints) {
    const o = overlapFraction(decodedPoints, prior);
    if (o > overlapPenalty) overlapPenalty = o;
  }
  // Hard reject if any prior overlaps >70%.
  if (overlapPenalty > 0.7) return null;

  const score = (
    WEIGHTS.distance * distanceMatch
    + WEIGHTS.elevation * elevationMatch
    + WEIGHTS.surface * surfaceMatch
    - WEIGHTS.overlap * overlapPenalty
  );

  return {
    score: Number(score.toFixed(4)),
    breakdown: {
      distance_match: Number(distanceMatch.toFixed(3)),
      elevation_match: Number(elevationMatch.toFixed(3)),
      surface_match: Number(surfaceMatch.toFixed(3)),
      overlap_penalty: Number(overlapPenalty.toFixed(3)),
    },
  };
}

/**
 * Overlap = fraction of `a` whose points fall within ~200m of any point in `b`.
 * Approximation: bucket b's points into a coarse geohash grid (≈500m cells)
 * and check membership. Good enough for "are these the same loop?" checks
 * at city scale; we don't need centimetre precision.
 */
function overlapFraction(a, b) {
  if (!a.length || !b.length) return 0;
  const grid = new Set();
  for (const [lat, lng] of b) {
    grid.add(cellKey(lat, lng));
    grid.add(cellKey(lat + 0.001, lng));
    grid.add(cellKey(lat - 0.001, lng));
    grid.add(cellKey(lat, lng + 0.001));
    grid.add(cellKey(lat, lng - 0.001));
  }
  let hits = 0;
  for (const [lat, lng] of a) {
    if (grid.has(cellKey(lat, lng))) hits++;
  }
  return hits / a.length;
}

function cellKey(lat, lng) {
  // ~0.001 deg ≈ 111 m at equator, ~80 m at high latitudes. Round to 3 dp.
  const la = Math.round(lat * 1000) / 1000;
  const ln = Math.round(lng * 1000) / 1000;
  return `${la},${ln}`;
}
