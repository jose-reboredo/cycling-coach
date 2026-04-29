// Feature flags backed by localStorage. Read once per render — these are
// static for the session unless the user toggles them in DevTools, in which
// case a page refresh applies the new value (good enough for kill-switch use).

const KEY_CLUBS = 'cc_clubsEnabled';

function read(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === 'true';
  } catch {
    return defaultValue;
  }
}

/** Default: true. Set localStorage.cc_clubsEnabled = 'false' to kill the
 * club UI surface (ContextSwitcher, ClubCreateCard, club-mode dashboard).
 * Used for the demo-night kill-switch + the F3 "ZERO regression when off"
 * guarantee. */
export function useClubsEnabled(): boolean {
  return read(KEY_CLUBS, true);
}
