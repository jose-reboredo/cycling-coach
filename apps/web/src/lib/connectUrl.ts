// Build the /authorize URL.
//
// In dev (Vite on :5173 proxying to Worker on :8787) the Worker can't tell
// what host the user is on, so we tell it explicitly via ?origin=. In
// production (Workers Static Assets — single origin) this is a no-op.
//
// The Worker only honors `?origin=` when it points at a localhost loopback,
// so it can't be abused as an open redirect on production.
export function connectUrl(extraParams?: Record<string, string>): string {
  const url = new URL('/authorize', window.location.origin);
  url.searchParams.set('origin', window.location.origin);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
  }
  return url.pathname + url.search;
}
