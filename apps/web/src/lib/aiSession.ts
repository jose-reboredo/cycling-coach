// v9.12.9 — best-effort parsing of the free-text AI session brief into
// the structured fields used by `planned_sessions`. Used when bridging
// an AI plan day onto the personal scheduler. The full original text is
// always preserved by callers as the description so the user can see
// what the coach actually wrote.
//
// v10.2.0 — when explicit duration isn't in the brief but a distance is
// (e.g. "85 km easy ride"), estimate duration from distance × zone-derived
// average pace. Cycling realistic paces by zone:
//   Z1 recovery     ~20 km/h   Z2 endurance ~25 km/h   Z3 tempo     ~28 km/h
//   Z4 threshold    ~30 km/h   Z5 VO2 max   ~30 km/h   Z6 anaerobic ~28 km/h
//   Z7 neuromuscular~25 km/h   default      ~25 km/h
// This catches the "long ride" case where the AI says distance not minutes.

export interface ParsedAiSession {
  title: string;
  durationMin: number | null;
  zone: number | null;
  watts: number | null;
  /** v10.2.0 — distance extracted from text (km). Surfaced so the prefill
   *  modal can show "Estimated from 85 km × 25 km/h" tooltip. null when
   *  no distance found in the brief. */
  distanceKm: number | null;
  /** v10.2.0 — true when durationMin was estimated from distance × pace
   *  (vs explicitly extracted from "1h 15m" / "90 min" text). UI uses this
   *  to label the field as "estimated" so users know to verify. */
  durationEstimated: boolean;
}

/** Average cycling speed (km/h) for distance → duration estimation, by Coggan zone. */
function paceForZone(zone: number | null): number {
  switch (zone) {
    case 1: return 20;
    case 2: return 25;
    case 3: return 28;
    case 4: return 30;
    case 5: return 30;
    case 6: return 28;
    case 7: return 25;
    default: return 25;
  }
}

export function parseAiSession(text: string | undefined): ParsedAiSession {
  if (!text) {
    return {
      title: 'AI session',
      durationMin: null,
      zone: null,
      watts: null,
      distanceKm: null,
      durationEstimated: false,
    };
  }
  const t = text.toLowerCase();

  // Title: first sentence (split on .!?\n), trimmed, capped at 200 chars.
  const firstLine = (text.split(/[.!?\n]/)[0] ?? text).trim();
  const title =
    firstLine.length > 0 && firstLine.length <= 200
      ? firstLine
      : text.length <= 200
        ? text
        : `${text.slice(0, 197)}…`;

  // Zone: explicit Z[1-7] first, else keyword fallback. Resolved early so
  // distance → duration estimation can use it for pace selection.
  let zone: number | null = null;
  const zMatch = t.match(/\bz([1-7])\b/);
  if (zMatch && zMatch[1]) zone = parseInt(zMatch[1], 10);
  else if (/recovery|easy|conversational|spin/.test(t)) zone = 1;
  else if (/endurance|aerobic\s+base|\bbase\b/.test(t)) zone = 2;
  else if (/tempo/.test(t)) zone = 3;
  else if (/threshold|sweet[-\s]?spot|sweetspot/.test(t)) zone = 4;
  else if (/vo2|interval/.test(t)) zone = 5;
  else if (/anaerobic/.test(t)) zone = 6;
  else if (/sprint|neuromuscular/.test(t)) zone = 7;

  // Distance: "85 km" / "120km".
  let distanceKm: number | null = null;
  const kmMatch = t.match(/(\d{1,3})\s*km\b/);
  if (kmMatch && kmMatch[1]) {
    const km = parseInt(kmMatch[1], 10);
    if (km > 0 && km < 500) distanceKm = km;
  }

  // Duration: "1h 15m" / "1.5h" / "90 min" — explicit pattern first.
  let durationMin: number | null = null;
  let durationEstimated = false;
  const hMatch = t.match(/(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*m)?/);
  if (hMatch && hMatch[1]) {
    const h = parseFloat(hMatch[1]);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    durationMin = Math.round(h * 60 + m);
  } else {
    const minMatch = t.match(/(\d{2,3})\s*min/);
    if (minMatch && minMatch[1]) durationMin = parseInt(minMatch[1], 10);
  }
  if (durationMin != null && (durationMin < 0 || durationMin > 600)) {
    durationMin = null;
  }

  // v10.2.0 — fallback: estimate duration from distance × zone pace when
  // explicit duration wasn't in the brief. This catches "85 km easy" type
  // briefs that previously fell through to the 60-min default.
  // v10.3.0 — round estimates to nearest 30 min (cycling-canon 0.5h
  // increments). Founder feedback: 0.583333h is not user-friendly.
  // Literal "1h 15m" briefs preserve their original precision.
  if (durationMin == null && distanceKm != null) {
    const pace = paceForZone(zone);
    const raw = (distanceKm / pace) * 60;
    const rounded = Math.round(raw / 30) * 30;
    if (rounded > 0 && rounded <= 600) {
      durationMin = rounded;
      durationEstimated = true;
    }
  }

  // Target watts: "252 W" / "270W"; clamped to 50–2000.
  let watts: number | null = null;
  const wMatch = t.match(/(\d{2,4})\s*w(?:atts?)?\b/);
  if (wMatch && wMatch[1]) {
    const n = parseInt(wMatch[1], 10);
    if (n >= 50 && n <= 2000) watts = n;
  }

  return { title, durationMin, zone, watts, distanceKm, durationEstimated };
}
