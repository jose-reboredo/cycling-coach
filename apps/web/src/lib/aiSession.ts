// v9.12.9 — best-effort parsing of the free-text AI session brief into
// the structured fields used by `planned_sessions`. Used when bridging
// an AI plan day onto the personal scheduler. The full original text is
// always preserved by callers as the description so the user can see
// what the coach actually wrote.

export interface ParsedAiSession {
  title: string;
  durationMin: number | null;
  zone: number | null;
  watts: number | null;
}

export function parseAiSession(text: string | undefined): ParsedAiSession {
  if (!text) {
    return { title: 'AI session', durationMin: null, zone: null, watts: null };
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

  // Duration: "1h 15m" / "1.5h" / "90 min".
  let durationMin: number | null = null;
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

  // Zone: explicit Z[1-7] first, else keyword fallback.
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

  // Target watts: "252 W" / "270W"; clamped to 50–2000.
  let watts: number | null = null;
  const wMatch = t.match(/(\d{2,4})\s*w(?:atts?)?\b/);
  if (wMatch && wMatch[1]) {
    const n = parseInt(wMatch[1], 10);
    if (n >= 50 && n <= 2000) watts = n;
  }

  return { title, durationMin, zone, watts };
}
