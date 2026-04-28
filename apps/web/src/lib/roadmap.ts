// Roadmap surface — drives the /whats-next page. Mirrors the issue list in
// .github/ISSUES_v8.0.0.md so the public roadmap stays in sync.

export type Priority = 'high' | 'medium' | 'low';
export type Area =
  | 'dashboard'
  | 'design-system'
  | 'auth'
  | 'db'
  | 'backend'
  | 'ci'
  | 'pwa'
  | 'perf'
  | 'routes';
export type Status = 'in-progress' | 'open' | 'shipped';

export interface RoadmapItem {
  id: string;
  title: string;
  body: string;
  area: Area;
  priority: Priority;
  status: Status;
  /** semver target — when we'd like to ship this */
  target?: string;
}

export const ROADMAP: RoadmapItem[] = [
  {
    id: 'auth-replace',
    title: 'Real Strava data swap on the dashboard',
    body: 'Pull athlete + activities from /api/* via Tanstack Query when tokens are present, and derive every widget (PMC, streak, wins, volume, recents) from real data instead of seeded mock.',
    area: 'dashboard',
    priority: 'high',
    status: 'shipped',
    target: 'v8.0.1',
  },
  {
    id: 'logout',
    title: 'Disconnect Strava (logout)',
    body: 'Avatar-pill dropdown with Sync, Disconnect, and a link to revoke the OAuth grant at strava.com/settings/apps.',
    area: 'auth',
    priority: 'high',
    status: 'shipped',
    target: 'v8.1.0',
  },
  {
    id: 'goal-event-edit',
    title: 'Editable goal event',
    body: 'Inline editor on the dashboard event card — name, type, date, distance, elevation, location, priority. Persists to localStorage now, will sync to D1 once schema v2 is applied.',
    area: 'dashboard',
    priority: 'high',
    status: 'shipped',
    target: 'v8.1.0',
  },
  {
    id: 'ride-detail',
    title: 'Tap a ride for the full breakdown',
    body: 'Description, photos, polyline, kilometre splits, segment efforts with PRs, full stats grid. Lazy-fetched per ride and cached forever in Tanstack Query.',
    area: 'dashboard',
    priority: 'high',
    status: 'shipped',
    target: 'v8.1.0',
  },
  {
    id: 'whats-next',
    title: 'Public roadmap page',
    body: 'This page. Shows what we’re cooking, in what state, and at what target version.',
    area: 'design-system',
    priority: 'low',
    status: 'shipped',
    target: 'v8.1.0',
  },
  {
    id: 'schema-v2-apply',
    title: 'Apply D1 schema v2 to prod',
    body: 'Run migrations/0001_pmc_and_events.sql against the remote D1 to add FTP/TSS/IF columns + the daily_load PMC rollup table + event extensions on goals.',
    area: 'db',
    priority: 'high',
    status: 'open',
    target: 'v8.2.0',
  },
  {
    id: 'tss-backfill',
    title: 'Retroactive TSS backfill',
    body: 'Walk the activities table, extract average_watts from strava_raw_json, and compute TSS / NP / IF / primary zone for every existing ride once the user has set FTP.',
    area: 'backend',
    priority: 'high',
    status: 'open',
    target: 'v8.2.0',
  },
  {
    id: 'ftp-onboarding',
    title: 'FTP onboarding flow',
    body: 'First-run capture of FTP, weight, HR max. Re-openable from the user menu → Edit profile. Real TSS + zone math kicks in once saved.',
    area: 'dashboard',
    priority: 'high',
    status: 'shipped',
    target: 'v8.2.0',
  },
  {
    id: 'strava-7-zones',
    title: 'Extend zone model to Strava’s 7-zone scheme',
    body: 'Z7 = Neuromuscular Power (>150% FTP). --c-z7 token added, Zone type widened to 1..7, zone glow + workout stripe + zoneFor() rewritten.',
    area: 'design-system',
    priority: 'medium',
    status: 'shipped',
    target: 'v8.2.0',
  },
  {
    id: 'live-routes',
    title: 'Live Strava saved routes',
    body: 'Replace MOCK_ROUTES with the live response from /api/athlete/routes. Open-on-Strava action; empty state when the user has zero saved.',
    area: 'routes',
    priority: 'medium',
    status: 'open',
    target: 'v8.2.0',
  },
  {
    id: 'worker-prune',
    title: 'Prune dead HTML handlers from the Worker',
    body: 'landingPage / dashboardPage / privacyPage and their helpers were deleted. callbackPage + errorPage slimmed to ~80 lines. Worker bundle shrank from 3,375 → 683 lines (–80 %).',
    area: 'backend',
    priority: 'medium',
    status: 'shipped',
    target: 'v8.2.0',
  },
  {
    id: 'pwa-shell',
    title: 'PWA install + offline shell',
    body: 'Manifest with maskable icon, service worker that caches the SPA shell + assets and falls back offline. /api/* + /authorize + /callback always go to network.',
    area: 'pwa',
    priority: 'low',
    status: 'shipped',
    target: 'v8.2.0',
  },
  {
    id: 'ci-build-cmd',
    title: 'Update Cloudflare CI build command',
    body: 'Workers & Pages → cycling-coach → Settings → Builds → set build command to "npm run build:web" so push-to-main rebuilds the SPA.',
    area: 'ci',
    priority: 'high',
    status: 'open',
    target: 'v8.1.x',
  },
  {
    id: 'pwa-iOS-install',
    title: 'iOS home-screen install testing + offline-PMC',
    body: 'v8.2.0 ships the PWA shell (manifest + SW). Validate iOS install flow + render the last-cached PMC strip when offline so the dashboard isn\'t blank.',
    area: 'pwa',
    priority: 'low',
    status: 'open',
    target: 'v8.4.0',
  },
  {
    id: 'lighthouse-90',
    title: 'Lighthouse mobile ≥ 90',
    body: 'Audit, split Motion if it tips the score, preload Geist + Geist Mono first weights with display:swap on the rest.',
    area: 'perf',
    priority: 'medium',
    status: 'open',
    target: 'v8.3.0',
  },
  {
    id: 'training-prefs-d1',
    title: 'Persist training prefs to D1',
    body: 'Today surface_pref + start_address only live in localStorage. Strangler-Fig dual-write to the existing training_prefs table.',
    area: 'db',
    priority: 'low',
    status: 'open',
    target: 'v8.3.0',
  },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Mid priority',
  low: 'Low priority',
};

export const AREA_LABEL: Record<Area, string> = {
  dashboard: 'Dashboard',
  'design-system': 'Design system',
  auth: 'Auth',
  db: 'Database',
  backend: 'Backend',
  ci: 'CI/CD',
  pwa: 'PWA',
  perf: 'Performance',
  routes: 'Routes',
};
