// Feature flags backed by localStorage. Read once per render — these are
// static for the session unless the user toggles them in DevTools, in which
// case a page refresh applies the new value (good enough for kill-switch use).

import { useEffect, useState } from 'react';

const KEY_CLUBS = 'cc_clubsEnabled';
const KEY_TABS = 'cc_tabsEnabled';
const MOBILE_QUERY = '(max-width: 1023px)';

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

/** Returns true when the dashboard should render the mobile 4-tab layout.
 * Default behaviour (v9.3.1): tabs ON for mobile (<1024px), tabs OFF for
 * desktop. localStorage override: 'true' forces tabs anywhere, 'false'
 * forces single-page dashboard anywhere — kill-switch in both directions.
 *
 * Updates live on viewport resize (rotate, dev-tools, etc.) so /dashboard
 * never gets stranded showing the wrong layout when the user changes
 * orientation mid-session. */
export function useTabsEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : computeTabsEnabled(),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setEnabled(computeTabsEnabled());
    update(); // sync initial value after hydration
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return enabled;
}

/** Pure read of the tab flag. Used by Tanstack Router's beforeLoad which
 * runs outside React. Mirrors the useTabsEnabled hook's logic. */
export function computeTabsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const override = window.localStorage.getItem(KEY_TABS);
    if (override === 'true') return true;
    if (override === 'false') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  } catch {
    return false;
  }
}
