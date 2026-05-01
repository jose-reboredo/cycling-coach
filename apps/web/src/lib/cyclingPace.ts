// Cycling-realistic average speeds by Coggan zone, used to:
//   - estimate session duration from distance (parseAiSession in v10.2.0)
//   - estimate session distance from duration (route picker in v10.5.0)
// Lifted out of aiSession.ts so both directions share one source of truth.

export function paceForZone(zone: number | null | undefined): number {
  switch (zone) {
    case 1: return 20; // Recovery
    case 2: return 25; // Endurance
    case 3: return 28; // Tempo
    case 4: return 30; // Threshold
    case 5: return 30; // VO2
    case 6: return 28; // Anaerobic
    case 7: return 25; // Neuromuscular
    default: return 25;
  }
}

/** v10.5.0 — Distance estimate (km) for a session's route picker. Reads
 *  the planned duration in minutes and zone, returns a target distance the
 *  route generator should aim for. Rounded to integer km — ORS doesn't
 *  need sub-km precision. Returns null when duration is missing or zero. */
export function estimateDistanceKm(durationMin: number | null | undefined, zone: number | null | undefined): number | null {
  if (durationMin == null || !Number.isFinite(durationMin) || durationMin <= 0) return null;
  const km = (durationMin / 60) * paceForZone(zone);
  return Math.round(km);
}
