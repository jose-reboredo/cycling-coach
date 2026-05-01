// Feature flags backed by localStorage. Read once per render — these are
// static for the session unless the user toggles them in DevTools, in which
// case a page refresh applies the new value (good enough for kill-switch use).

import { useEffect, useState } from 'react';

const KEY_CLUBS = 'cc_clubsEnabled';
const KEY_TABS = 'cc_tabsEnabled';

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

/** Returns true when the dashboard should render the tabs layout (TopTabs
 *  on desktop + BottomNav on mobile, with `<Outlet />` for child routes).
 *
 *  v9.12.8 — default flipped to `true` everywhere. The founder-lock 2026-05-01
 *  design rule says "desktop = top tabs always" but the implementation
 *  was still gated to `(max-width: 1023px)` from the v9.3.1 mobile-first
 *  rollout. Net effect on desktop: user landed on /dashboard/today, saw
 *  Today content but no nav (TabsLayout never mounted, so neither TopTabs
 *  nor `<Outlet />` were rendered). Now defaults to TabsLayout on every
 *  viewport; the legacy single-page `<Dashboard />` is reachable only via
 *  the kill-switch override `localStorage.cc_tabsEnabled = 'false'`. */
export function useTabsEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : computeTabsEnabled(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Re-read on storage change so a manual kill-switch flip applies
    // without a full reload (DevTools workflow).
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_TABS) setEnabled(computeTabsEnabled());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return enabled;
}

/** Pure read of the tab flag. Used by Tanstack Router's beforeLoad which
 *  runs outside React. v9.12.8 — defaults to `true` on every viewport. */
export function computeTabsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const override = window.localStorage.getItem(KEY_TABS);
    if (override === 'false') return false;
    return true;
  } catch {
    return true;
  }
}
