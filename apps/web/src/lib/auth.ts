// Strava token persistence — localStorage. Mirrors the Strangler Fig pattern
// from the existing Worker (D1 dual-write later).

const KEY = 'cc_tokens';

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
}

export function readTokens(): StravaTokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StravaTokens;
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTokens(t: StravaTokens) {
  localStorage.setItem(KEY, JSON.stringify(t));
}

export function clearTokens() {
  localStorage.removeItem(KEY);
}

/** True when the access token expires within the next 5 minutes. */
export function isExpiringSoon(t: StravaTokens, leewaySec = 300) {
  return t.expires_at - leewaySec < Date.now() / 1000;
}

export async function refreshTokens(t: StravaTokens): Promise<StravaTokens> {
  const res = await fetch('/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: t.refresh_token }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const data = (await res.json()) as StravaTokens;
  writeTokens(data);
  return data;
}

export async function ensureValidToken(): Promise<StravaTokens | null> {
  let tokens = readTokens();
  if (!tokens) return null;
  if (isExpiringSoon(tokens)) {
    try {
      tokens = await refreshTokens(tokens);
    } catch {
      clearTokens();
      return null;
    }
  }
  return tokens;
}
