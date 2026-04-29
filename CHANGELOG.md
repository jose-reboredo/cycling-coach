# Changelog

All notable releases. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning [SemVer](https://semver.org/).

---

## [9.1.2] — 2026-04-30

**Club view restructure to Saturday Crew Wireframes IA + Coach AI for the captain.** Implements the information architecture from the design-bundle wireframes (`claude.ai/design` handoff: 5 low-fi artboards for the Saturday Crew detail page) and adds a captain-managed Anthropic API key for club-scoped Coach AI feedback per BA spec.

### Changed — ClubDashboard structure

Restructured per Saturday Crew Wireframes 01 (Overview tab):

- **Cover hero** — striped placeholder background, italic-em club name with trailing punctuation (`Saturday Morning Crew.`), metadata strip (`Est. <year> · N members · Private`) and role pill in the top-right.
- **Tabs row** — Overview / Schedule / Members / Metrics. Only Overview is implemented; the rest render a "Coming soon" placeholder (calendar, sortable roster, collective load chart per the wireframes — all wait on backend tables that don't exist yet). Tabs are keyboard-accessible buttons with brass underline on active.
- **Hero invite CTA** — promoted from a buried card to a wireframe-style two-column treatment: full-width URL on the left + brass `↗ Share Invite Link` button on the right. Annotation under the card matches the wireframe's `★ share is the primary feature` callout. Mobile stacks vertically.
- **Stat tiles** — re-labelled per wireframe: *Hours collective · Distance · Group rides · Members*. Values are `—` / `0` placeholders today; real numbers wait on the rides aggregate path.
- **Members list** — kept the existing avatar + name + joined date + role pill row. Eyebrow now reads `Members · 0N` (zero-padded count) per wireframe.
- **Circle note** — admin-only placeholder card explaining the future post mechanism. Signed `— Cadence · Circle Layer` per wireframe.
- **Coming next** — replaces the prior bullet list with the wireframe's accent-tinted left-rule list.

### Added — Coach AI for the captain

Per BA spec: *"as business analyst add Coach AI feedback into the club, for the moment the captain can add manually anthropic api key"*. Ships the key-entry UX so the captain can be onboarded ahead of the data-aggregate path.

- **`<ClubCoachCard />`** in ClubDashboard Overview tab. Three states:
  1. **Non-admin, no key set** — *"Captain has not yet set up Coach AI."* read-only.
  2. **Non-admin, key set** — *"The captain has connected an Anthropic API key. Coach AI feedback will surface here once the club-rides aggregate data path ships."* + a connected-status indicator.
  3. **Admin** — full management UI: connect (sk-ant-… password input), masked-preview when set (`sk-ant-…ABCD`), replace, disconnect. Same UX language as the existing personal AiCoachCard for consistency.
- **Storage**: `localStorage` under `cc_clubAiKey:${clubId}`. NOT synced to D1 — matches the existing personal-Anthropic-key pattern (also localStorage-only). Decision documented inline: adding a clubs.api_key column means migration + admin-only edit endpoint + server-side encryption story; we don't have that today for personal keys either, and matching keeps the security posture consistent.
- **Feedback rendering itself is deferred** — without aggregated club-rides data we can't usefully call `/coach` for the club. The card surfaces "feedback ships once a club-rides aggregate table exists in D1" so the captain understands the current state.

### Process

- Read the design bundle's README + chat transcript before implementing per the bundle's instructions ("read the chat transcripts first").
- Wireframes are LOW-FI (cream + black ink) — applied the **information architecture** to the existing PARS dark + molten orange palette (v9.1.1 revert), not the wireframe's literal colors.
- Schedule tab calendar + Members tab sortable roster + Mobile share-sheet flow (artboards 02, 03, 05 from the bundle) deferred to v9.2.x — they're all backend-blocked (rides table, RSVP store, share-sheet OS integration).

### Verified

- `npm run build:web` clean (vite + tsc -b)
- `E2E_TARGET_PROD=1 npm run test` → 13 passed / 1 skipped, zero regressions vs v9.1.1
- Both branches (no-club + club-mode) render correctly under the new IA

---

## [9.1.1] — 2026-04-30

**Palette revert.** Restores the molten orange `#ff4d00` accent + lime `#22c55e` success of v9.0.0 era. The brass `#b8956a` + forest green `#4a8e54` palette shipped in v9.1.0 is rolled back; brand rename to "Cadence Club" stays. Effectively the v9.0.0 visual identity wearing the v9.1.0 brand name.

### Reverted (vs v9.1.0)

- `--c-accent: #b8956a` → `#ff4d00` (molten orange returns)
- `--c-accent-deep: #9c7c56` → `#cc3e00`
- `--c-accent-soft / glow / light` → original molten-orange RGBA values
- `--c-success: #4a8e54` → `#22c55e` (lime returns)
- `--c-success-soft` → `rgba(34, 197, 94, 0.12)`
- `--c-success-deep` token removed (was Forest Green decoration only)
- `--sh-glow` → original molten-orange shadow values
- All hardcoded `rgba(184, 149, 106, …)` literals across components reverted to `rgba(255, 77, 0, …)` (Card, StreakHeatmap, Pill, Button, VolumeChart, LoadingScreen, Landing, RideDetail, ProgressRing, WhatsNext, OAuth callback HTML pages in worker.js)
- Tone= remaps reverted: PR pill (RideDetail) `success → accent`, achievement count `success → accent`, "Strengths" eyebrow (AiCoachCard) `success → accent`, "{n} PRs" pill (WinsTimeline) `success → accent`, Dashboard "Demo data" pill restored to `tone="success"` for the unified pill rendering
- ClubDashboard role pills restored to v9.1.0 logic: admin = accent, member = success
- Eyebrow component: `success` variant + CSS class removed (back to `'muted' | 'accent'`)

### Kept from v9.1.0 / v9.0.0

- Brand rename "Cycling Coach" → "Cadence Club" everywhere user-facing (TopBar, AppFooter, Landing copy, JoinClub, Privacy reframe, index.html title + meta, worker `/version` `service` field, OAuth callback HTML)
- TopBar version badge `v9`
- Landing Pill "For the performance-driven amateur · v9"
- "Today's workout" → "Today's session" copy substitution (Landing hero preview)
- OnboardingModal mobile-first padding fix at ≤600px
- v9.0.0 Clubs MVP + F4 invite-by-link infrastructure (POST /api/clubs/join/:code, /join/$code route, InviteLinkCard, useJoinClub hook)
- v8.6.0 Clubs MVP backend (POST /api/clubs, GET /api/clubs, GET /api/clubs/:id/members, resolveAthleteId, ContextSwitcher, ClubDashboard, AppContext)

### Why

Visual judgment call after reviewing v9.1.0 in prod: the warm-brass-on-dark aesthetic moved away from the original Strava-adjacent identity that defined the product's first releases. The molten orange `#ff4d00` is closer to the Strava brand color `#fc4c02` and signals "cycling-native" more clearly than brass. The Soho House cream-light theme prototype was abandoned mid-flight (never deployed) for similar reasons — the dark canvas + molten accent is the visual language users built mental models around through v8.x.

### Implementation

Single `git revert 07d9b49` (v9.1.0 step 1/5 — palette swap commit) cleanly reverses tokens.css, tokens.ts, the 5 tone= remaps, the Eyebrow `success` extension, and the hardcoded color sweeps in 9 component files + worker.js. Auto-merge handled the two files (Landing.tsx, worker.js) where subsequent commits (`233cc57` brand rename, `73e774b` release-cut) had touched the same regions.

### Verified

- `npm run build:web` clean (vite + tsc -b)
- `grep -rn "Cadence Club" apps/web/src` — brand name intact in all v9.1.0 sites
- `grep -rn "ff4d00" apps/web/src` — molten orange back in tokens

### Commit chain

- `6c5fafb` — `Revert "feat(theme): swap palette to Brass + Forest Green (v9.1.0 step 1/5)"`
- this commit — `chore(release): v9.1.1`

---

## [9.1.0] — 2026-04-30

**Brand swap to Cadence Club.** The accent palette pivots from molten orange to warm brass + forest green; the user-facing brand string flips from "Cycling Coach" to "Cadence Club"; the OnboardingModal gets a mobile-first padding fix. No new pages, no auth changes, no D1 migrations. Strava OAuth remains the only auth path. Implemented per `docs/superpowers/specs/2026-04-30-v9.1.0-brand-swap-spec.md` in 3 staged commits with AA-contrast verification before merge.

### Changed — design tokens

- `--c-accent: #ff4d00` → `#b8956a` (warm brass, 7.11:1 AA on canvas)
- `--c-accent-deep` → `#9c7c56` (5.12:1)
- `--c-accent-light` → `#d4b98c` (10.47:1, ≤14px text)
- `--c-success: #22c55e` → `#4a8e54` (forest green, 4.98:1; lifted from the brief's #2C5530 which fails AA at 2.31:1)
- New `--c-success-deep: #2c5530` for non-text decoration only (borders, left-rules)
- `--sh-glow` migrated to brass RGBA values
- All hardcoded `rgba(255, 77, 0, ...)` and `rgba(34, 197, 94, ...)` literals across components (Card, StreakHeatmap, Pill, Button, VolumeChart, LoadingScreen, WhatsNext, Landing) and the worker's OAuth callback HTML pages swept to brass / forest equivalents.

### Changed — semantics

The "Brass = active, Forest Green = completed" rule applied where prior tone= usage didn't match:
- `RideDetail` PR + achievement pills: `accent` → `success` (PRs are completed)
- `AiCoachCard` "Strengths" eyebrow: `accent` → `success` (positive past assessment) — required adding `success` to Eyebrow's `tone` prop type + a CSS class
- `WinsTimeline` "{n} PRs" pill: `accent` → `success`
- `Dashboard` Pill: `success` → no tone for "Demo data" (mode, not completion); kept Forest Green for "In sync" (completion)
- `ClubDashboard` role pills: admin = Brass; member = neutral (baseline state, not an achievement)

### Changed — brand string

User-facing "Cycling Coach" → "Cadence Club" in `TopBar`, `AppFooter`, `Landing` body copy, `JoinClub` invite landing, `Privacy` (with the "self-hosted hobby project" line reframed to "small product run by a single maintainer"), `index.html` `<title>` + meta tags, and the worker's `/version` `service` field, Confluence sync prompt, and OAuth callback HTML pages. TopBar version badge: `v8` → `v9`. Pill on Landing: `For the performance-driven amateur · v9`.

### Kept unchanged (intentionally)

- `wrangler.jsonc` Worker `name: "cycling-coach"` and D1 `database_name: "cycling-coach-db"` — renaming these = new prod URL + Strava OAuth callback re-registration. Tracked separately as **issue #32** (`Migrate Cadence Club to cadenceclub.cc canonical domain`).
- `package.json` / `apps/web/package.json` `name` fields — internal npm identifiers.
- `docs:sync` script URL — same domain as Worker config.
- CHANGELOG.md historical entries (v8.5.x and earlier) — no rewriting history.

### Mobile-first

`OnboardingModal` now tightens padding + border-radius at ≤600px to avoid crowding the screen edge on small phones. The other 3 components flagged by the spec audit (`GoalEventCard`, `RideFeedback`, `WinsTimeline`) reviewed but deferred to v9.2.0's comprehensive mobile-first pass — they adapt acceptably via existing `1fr` / `min-width: 0` rules at narrow viewports.

### Copy voice

Surgical: only "Today's workout" → "Today's session" in Landing.tsx. The rest of the spec's vocabulary substitution table (training plan, community, achievement, sign up, get faster) returned zero matches against current copy — the codebase was already close to the v2.0 voice.

### Verified

- AA contrast verified for every text-bearing token via Node script before commit
- Hardcoded color literal sweep returns zero `rgba(255,77,0)` / `rgba(34,197,94)` / `#ff4d00` / `#22c55e` outside `tokens.css` / `tokens.ts`
- `npm run build:web` clean (vite + tsc -b)
- 13 e2e tests + 1 skipped (zero regressions vs v9.0.0)

### Explicitly NOT in v9.1.0

- New pages (homepage 3-col, onboarding flow, settings, B2B placeholder) — **v9.2.0**
- Email/password auth via Better Auth — **excluded entirely**, not a future version
- Domain migration to `cadenceclub.cc` — **issue #32**
- Worker rename from `cycling-coach` to `cadence-club` — combined with #32
- Comprehensive mobile-first audit of all components — incremental in v9.2.0 alongside new pages
- Per-code expiry / regeneration of invite codes — v9.2.0+

---

## [9.0.0] — 2026-04-29

**Clubs MVP — F4 invite-by-link, shipped as v9.0.0 per Jose's call.** Fills the demo-blocking gap from v8.6.0 ("how does an admin add teammates?"). The `clubs` table already had `invite_code TEXT UNIQUE` populated on every create from F1; this release exposes it. Also marks the start of the Cadence Club product line — subsequent v9.x releases land the brand swap, redesigned pages, email/password auth, and B2B layer per the v2.0 redesign brief.

Mobile-first: the new `<InviteLinkCard />` and `/join/$code` page stack vertically by default and reflow to row layouts at ≥768px. All new touch targets meet 44px minimum. Existing v8.6.0 components remain at their v8.6.0 mobile fitness; comprehensive mobile-first audit lands in v9.1.0 brand-swap.

### Added

- **`POST /api/clubs/join/:code`** worker endpoint — Strava-auth required. Looks up the club by `invite_code`; on hit, INSERTs the caller as `member`. Idempotent (existing-member case returns the persisted role gracefully). Returns 404 for unknown codes (OWASP — consistent with the v8.6.0 membership-check pattern).
- **`/join/$code` route** (Tanstack file-based) — landing page that auto-resolves the invite. Three branches: not authed → "Connect with Strava" CTA (and stashes the code in `cc_pendingInvite` localStorage so future flows can resume); authed → POSTs to the join endpoint, calls `setClub()` in AppContext on success, redirects to `/dashboard` after a brief beat; error → "invite link not valid or expired" with a link to dashboard.
- **`<InviteLinkCard />` in ClubDashboard** — admin-only. Shows `${origin}/join/${invite_code}` in mono with a "Copy link" button (uses `navigator.clipboard.writeText` with a `window.prompt` fallback). Helper copy: "Anyone with this link who connects via Strava joins the club."
- **`useJoinClub()`** Tanstack mutation + `clubsApi.join(code)` method — same shape as the existing `useCreateClub()` pair, invalidates `['clubs','mine']` on success.

### Behavior

- Non-admins do NOT see the invite link — `<InviteLinkCard />` only renders when `role === 'admin'`. Members see the same Dashboard as v8.6.0 (members list, stats, roadmap card, hint).
- The first user to use a fresh invite link is added as `member` regardless of who created it. Founders / admins remain `admin` because they were inserted as such on club creation (F1).
- `cc_pendingInvite` is removed from localStorage on successful join; failed joins keep it (so a retry from the same browser still works).

### Verification

- `npm run build:web` clean (vite + tsc -b)
- `E2E_TARGET_PROD=1 npm run test` → expected to remain green; no test paths touch the new endpoint or route.
- Smoke probes against deployed v8.6.1: routing (`/api/clubs/join/anything` returns Worker JSON, not SPA), no-auth → 401, valid auth + invalid code → 404, valid auth + valid code → 200 + role-mapped response.

### Explicitly NOT in v9.0.0 (deferred to v9.x)

- Per-code expiry, regeneration, or use-count cap. The code is permanent in v9.0.0; v9.2.0 introduces a richer invitation model with TTLs.
- Email-based invitations (Resend not wired). Falls under v9.3.0 (auth + email).
- Brand-rename to "Cadence Club" — lands as v9.1.0 brand swap (palette: Brass `#B8956A` + Forest Green `#2C5530`, name + copy voice).
- Email/password authentication via Better Auth — v9.3.0.
- Homepage three-column value prop, onboarding flow, settings page, B2B placeholder — v9.2.0.

---

## [8.6.0] — 2026-04-29

**Clubs MVP — vertical slice for stakeholder demo.** Demonstrates the "amateur cycling club as unit of use" thesis with a working end-to-end flow against production D1: create club → see context switcher → flip into club view → see members list. No auth changes, no D1 migrations — uses the existing `clubs` + `club_members` tables.

### Added — Worker

- **`POST /api/clubs`** — creates a club, atomically inserts caller as `admin` member. INSERT…RETURNING + try/catch DELETE cleanup if the member-insert fails (`safeWarn('[clubs] member insert failed, cleaned up orphan club {id}')`). Validates name 1–100 chars, description ≤500.
- **`GET /api/clubs`** — lists clubs the caller belongs to. JOIN `clubs` + `club_members` filtered by caller's `athlete_id`.
- **`GET /api/clubs/:id/members`** — membership-gated. Returns 404 if caller isn't a member of the club (OWASP — don't leak existence). Single batch round-trip: `SELECT 1` membership check + `SELECT users JOIN club_members` member list.
- **`resolveAthleteId(request)` helper** — rounds-trips Strava `/athlete` once per club operation to validate the bearer token AND derive the canonical `athlete_id`. All failure modes (no auth, expired token, network error, malformed Strava response) return **401** with body `{"error":"authentication required"}` and `safeWarn` server-side. Never 500.
- All `/api/clubs*` responses carry the existing `corsHeaders` (success, 4xx, 5xx, OPTIONS preflight). Verified via OPTIONS smoke probe.
- Endpoints inserted **before** the generic `/api/*` Strava proxy fall-through. `/api/*` glob in `wrangler.jsonc → assets.run_worker_first` already covers the new paths — no wrangler.jsonc change needed.

### Added — Frontend

- **`<ContextSwitcher />` in TopBar** — compact pill showing current scope. Dropdown lists "My account" + each club from `useClubs()` + "Create new club". Selection updates AppContext + persists to `cc_activeContext`. Keyboard-accessible (arrow keys, ESC, click-outside, focus trap, focus restore) — same a11y pattern as the existing UserMenu. Compacts to dot+chevron-only at ≤640px to avoid TopBar overflow on mobile.
- **`<ClubCreateCard />`** — small CTA on Dashboard for users with zero clubs. Auto-hides once they have ≥1 (the ContextSwitcher's "Create new club" item takes over from there).
- **`<ClubCreateModal />`** — PARS-styled modal: name (1–100 chars, required) + description (≤500, optional). Submits via `useCreateClub()` mutation, invalidates the `['clubs','mine']` query on success. ESC dismiss, scroll lock, focus trap (matches OnboardingModal pattern).
- **`<ClubDashboard />`** — full club-mode dashboard body. Renders: club header (italic-em name + role pill + member count) → 3 placeholder stat tiles → members list (avatars + names + join dates) → "Coming next" accent-tinted roadmap card → switch-back hint. Replaces the entire individual layout when in club mode.
- **`AppContextProvider` + `useAppContext()`** in `lib/AppContext.tsx` — React Context exposing `{ scope: { mode, clubId, clubName, role }, setIndividual, setClub }`. Persisted to `cc_activeContext` localStorage with defensive parse on read. Mounted in `routes/__root.tsx` so every route can call the hook.
- **Tanstack Query hooks** in `hooks/useClubs.ts` — `useClubs()`, `useClubMembers(clubId)`, `useCreateClub()` with 5-min stale / 30-min gc, matching the existing `useStravaData` pattern.
- **`useClubsEnabled()` kill-switch** in `lib/featureFlags.ts` — reads `cc_clubsEnabled` from localStorage, defaults `true`. Gates ContextSwitcher, ClubCreateCard, AND the Dashboard club-mode branch. Setting to `'false'` and refreshing renders Dashboard exactly as v8.5.3 (CTO NOTE 5 — kill-switch regression hardening).

### Process

- Plan-first execution per CTO directive: 4-commit slice (F1 backend, F1 frontend, F2, F3) with CI green-gate between commits and full diff at each step before proceeding.
- All five CTO review notes addressed: (1) `resolveAthleteId` always 401 never 500, (2) corsHeaders on every error path, (3) routing verified pre-smoke, (4) atomic cleanup with safeWarn on orphan, (5) kill-switch hardened to override stale persisted scope.

### Verification

- All commits green in CI: `95adb35` (F1 backend), `561486a` (F1 frontend), `b66a94e` (F2), `60c46ce` (F3), and this release-cut.
- `E2E_TARGET_PROD=1 npm run test` — 13 passed, 1 skipped, **zero regressions** vs v8.5.3 across all 4 commits.
- Bundle inspection: ships both club markers (`Coming next`, `Personal training stats are hidden`) AND individual markers (`Today's workout`, `PMC`, `Volume`, `Streak`); runtime selects the branch.
- Backend smoke (7 probes against `wrangler dev --remote`): routing, no-auth 401 across all 3 endpoints, invalid-token cascade, OPTIONS preflight, `/api/athlete` proxy regression — all green.

### Explicitly NOT in v8.6.0 (deferred)

- **Better Auth, email verification, password reset** (F6/F7/F8) — Strava OAuth stays as-is.
- **Email invitations to clubs** (F4) — `club_invitations` table not created tonight.
- **BYOK hybrid routing in `/coach`** (F5) — clubs don't yet pay for the AI proxy.
- **Granular roles beyond `admin`/`member`** (F9) — coach / member separation comes later.
- **Cross-route club affordances** — only Dashboard branches on context today; Routes / What's-next remain in individual mode.

---

## [8.5.3] — 2026-04-29

UX hotfix on top of v8.5.2. The global site footer (brand block + Product / Trust / Powered-by columns + version + © line) was rendered only on the Landing page because its JSX lived inside `Landing.tsx`. Every other route — Dashboard, /whats-next, /privacy, etc. — shipped without it. Founder caught the regression visually post-deploy of v8.5.2.

### Fixed

- **Global footer now renders on every route.** Extracted the footer JSX + the `FootCol` subcomponent + the `.foot*` CSS rules out of `apps/web/src/pages/Landing.tsx` into a new shared component `apps/web/src/components/AppFooter/AppFooter.tsx` (+ `.module.css`). Mounted once in `apps/web/src/routes/__root.tsx` after `<Outlet />` so the Tanstack Router root layout renders it on all routes. Visual + content unchanged from v8.5.2 — pure structural relocation.
- **Single source of truth for the user-facing version string.** New `apps/web/src/lib/version.ts` exports `APP_VERSION` (`v8.5.3 · April 2026`). The footer reads from this constant instead of hardcoding the version on each release. Future bumps = one edit instead of one-per-page (de-risks the regression that allowed this hotfix).

### Process

- Lesson: the v8.5.2 release-cut commit bumped the version *string* in Landing.tsx without verifying the footer rendered elsewhere. Visual smoke on a single page passed; cross-route check would have caught it. Adding to release checklist: after every version bump, click through Landing → Dashboard → /whats-next → /privacy and confirm header + footer render on each.

---

## [8.5.2] — 2026-04-29

Phase 2 tail — closes the remaining Phase 2 security issues (#17, #18) plus a docs-integrity pass on the Confluence spec pages and a new per-page deploy-audit footer feature requested by the CTO during v8.5.1 sign-off.

### Added — Worker security

- **`/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>` path-secret source verification** (#17) — canonical webhook URL becomes the secret-suffixed path. Legacy `/webhook` and any `/webhook/<wrong-secret>` return **404** (OWASP — don't leak existence of the canonical path). Without `STRAVA_WEBHOOK_PATH_SECRET` set, entire `/webhook*` surface is dormant — by design, single-user mode today. Strava webhook re-registration deferred until multi-user API approval lands; ops runbook in `SECURITY.md`.
- **CTO-review hardening on top of #17** (commit `4476ad4`): the path-secret value is now **format-validated at request time** — must match `/^[0-9a-f]{32,}$/i` (32+ lowercase hex chars, what `openssl rand -hex 16+` produces). Whitespace, too-short, or non-hex values are rejected at runtime (entire `/webhook*` surface returns 404 + a `safeWarn` in Cloudflare logs flagging the misconfiguration). Additionally, when `verify_token` mismatches even though the path-secret was correct, the response is **404 (not 403)** — preserves opacity throughout the verification chain (a 403 would have leaked that the path-secret guess was right). Server-side `safeWarn` on mismatch logs the source IP for our own debugging (env-var drift between Worker + Strava registration).
- **`checkAdminRateLimit()` helper + KV rate-limit on `/admin/document-release`** (#18) — defense-in-depth on the highest-risk admin endpoint. 5 attempts/min/IP, returns 429 with `Retry-After` header on threshold. Uses `DOCS_KV` namespace (Free-plan-compatible). Threshold-hit attempts logged via `safeWarn()` with source IP for observability. Native Cloudflare rate-limit binding for `/api/*` and `/coach/*` remains deferred indefinitely (Workers Paid plan only — documented in SECURITY.md "Deferred / out of scope").

### Added — Documentation

- **Per-page deploy footer on Confluence spec pages** — every spec page now carries a footer at the bottom: `"Last touched by deploy vX.Y.Z on YYYY-MM-DD. Auto-managed — content lives in src/docs.js; regenerated by /admin/document-release on every npm run deploy."` Hash check on body only (KV `hash:<slug>`); footer overlaid on every deploy so the audit trail stays current even when body content is unchanged. Cost: 6 Confluence page writes per deploy (was zero on no-op deploys) — acceptable at weekly cadence.
- **Spec pages content sync** — surgical edits across Systems & Architecture, Technical Spec, and Security pages to reconcile v8.5.1 + v8.5.2 reality. Security page §3 (Secrets), §4 (CORS), §5 (Headers), §6 (XSS), §7 (Rate limiting), §8 (/admin auth), §9 (Webhook), §10 (Logging), §11 (Backlog table) all updated with shipped statuses, current milestones, and the new "no temp /admin/* for one-shot ops" rule. Systems & Architecture + Technical Spec CI sections rewritten to describe GitHub Actions accurately (Cloudflare Workers Builds intentionally not wired — closed issue #9 as superseded). API endpoints table shows `/webhook/<secret>` instead of legacy `/webhook`.

### Process

- **Pattern adopted**: when a release ships features that affect documentation, the docs.js spec pages must be synced in the same release, not as a separate after-the-fact commit. The README sweep rule (adopted v8.5.1) extends to spec pages now.

### Operator actions before activation

The shipped defences need Worker secrets to be load-bearing. None of these are blocking — webhook subscriptions don't exist today (single-user mode), so 503/404 responses to `/webhook*` don't impact any user:

```bash
# STRAVA_WEBHOOK_PATH_SECRET must match /^[0-9a-f]{32,}$/i. `openssl rand -hex 16` produces exactly 32 chars.
echo -n "$(openssl rand -hex 16)" | npx wrangler secret put STRAVA_WEBHOOK_PATH_SECRET
echo -n "$(openssl rand -hex 16)" | npx wrangler secret put STRAVA_VERIFY_TOKEN
```

Then, post multi-user Strava API approval:
```bash
# Replace <secret> with the value of STRAVA_WEBHOOK_PATH_SECRET above
curl -X POST "https://www.strava.com/api/v3/push_subscriptions" \
  -F client_id=<STRAVA_CLIENT_ID> \
  -F client_secret=<STRAVA_CLIENT_SECRET> \
  -F callback_url="https://cycling-coach.josem-reboredo.workers.dev/webhook/<secret>" \
  -F verify_token=<STRAVA_VERIFY_TOKEN>
```

### Verification

- `npm run build:web` clean.
- `E2E_TARGET_PROD=1 npm run test` 11 unit + 13 e2e green on prior commits.
- **Local `wrangler dev` smoke caught a real bug pre-release**: `/webhook/*` was missing from `wrangler.jsonc → assets.run_worker_first`, so the Worker was never invoked for `/webhook/<secret>` paths — requests fell through to static assets and returned the SPA's index.html. CTO asked "have you run smoke test and e2e validation?" before the release cut; running `wrangler dev` + curl probes locally surfaced the regression. Added `/webhook/*` to the list, all 9 smoke probes now pass: `/webhook` → 404 · `/webhook/anything` → 404 · `/webhook/<correct-secret>?hub.mode=subscribe&hub.verify_token=<verify>` → 200 with challenge · `/webhook/<wrong>` → 404 · `/admin/document-release` 5 rapid → 503 · 6th → 429. Lesson: every release must include `wrangler dev` smoke for any new endpoint or routing change, not just `npm run build` + CI.

### Housekeeping context (carried over from earlier today)

This release lands on top of a major issue-tracker housekeeping pass run via `curl + GITHUB_TOKEN` (no temp `/admin/*` endpoints — per the rule adopted this morning):

- **#7** (D1 migration) closed as shipped — verified applied to remote D1.
- **#9** (Cloudflare Workers Builds CI command) closed as superseded — we use GitHub Actions.
- **#28** (README hygiene) closed as shipped — covered by `257290c` + `fce03cf`.
- **9 issues reslotted to v8.6.0**: #2, #3, #4, #5, #6, #8, #10, #14, #15, #16.

Net: roadmap dropped from 17 open / 11 shipped → 14 open / 14 shipped. v8.3.0 + v8.4.0 milestones now empty (clean).

---

## [8.5.1] — 2026-04-29

Security hygiene batch — Phase 2 of the v8.5.0–v8.5.3 backlog burn (spec `cf3e786`). Closes 3 security chores from the original Phase 2 plan; the remaining 2 (#17 webhook path-secret, #18 KV rate-limit) reslot to v8.5.2.

### Added — Threat model + defences

- **Top-level `SECURITY.md`** (#22) — documents threat model (assets at risk, attack vectors considered, mitigations), shipped vs planned defences, deferred / out-of-scope items, deploy runbook for required Worker secrets, disclosure policy. Linked from README and CONTRIBUTING.

### Changed — Worker hardening

- **`STRAVA_VERIFY_TOKEN` fail-closed** (#19) — webhook GET handler no longer accepts a hardcoded fallback (`'cycling-coach-verify'`). Returns **503 Webhook verification not configured** when the Worker secret is missing. No change to behavior when secret is set. Operator action: `wrangler secret put STRAVA_VERIFY_TOKEN <random-32-hex>` before activating webhook subscriptions (single-user mode today, no impact). Audit finding from the v8.4.0 security batch.
- **`redactSensitive()` log helper + `safeLog/Warn/Error` wrappers** (#20) — defensive log redaction strips `api_key=`, `sk-ant-*`, `access_token=`, `refresh_token=` patterns before they hit Cloudflare's persistent log store. Applied to **5 of 12 high-risk `console.*` call sites**: webhook event log, D1 parse-error warn, three D1 error catches in `persistUserAndTokens` / `persistActivities` / `updateConnectionTokens`. Status / count logs (e.g. `[D1] Persisted N activities`) left as raw `console.log` because they don't interpolate untrusted data.

### Documentation

- **`docs(security): correct SECURITY.md to reflect actual shipped state`** (commit `257290c`) — replaced the original optimistic "Defences in place" section with an honest split: "Shipped defences" lists only what's currently on `main`; "Planned defences" lists what's in flight for v8.5.2. Web-spoofing wrong-path response code corrected from 403 → 404 per OWASP.
- **`docs(cleanup): sync README and SECURITY.md to actual shipped state`** (commit `fce03cf`) — fixes plan-vs-reality drift across both files: zones Z1-Z6 → Z1-Z7, lime glow → molten-orange glow, `npm run deploy` includes `docs:sync`, GitHub Actions described accurately (not Cloudflare Workers Builds), schema migration marked as applied 2026-04-29, FTP TODO removed (shipped v8.2.0), entire stale "Open issues / next up" section replaced with one-line `/whats-next` pointer. Issue `#15` (CSP) and `#16` (CORS) cited correctly. Issue `#14` (OAuth state CSRF) referenced and reslotted to v8.6.0 milestone.

### Deferred to v8.5.2

- **#17 Webhook path-secret** — `/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>` canonical URL with 404 fail-closed for legacy / wrong-secret paths.
- **#18 KV-based rate-limit on `/admin/document-release`** — 5 attempts/min/IP, defends against `ADMIN_SECRET` leak. Uses `DOCS_KV` namespace (Free-plan-compatible).

### Deferred indefinitely

- **Cloudflare-native rate-limit binding for `/api/*` and `/coach`** — requires Workers Paid plan, not on roadmap. Cost-runaway risk for `/coach` is mitigated only at the user side (BYOK Anthropic key safeguarded by the user). Documented in SECURITY.md "Deferred / out of scope".

### Process notes (durable rules adopted this release)

- **Scope-vs-ceremony exercise** is now mandatory before any release plan — light / medium / full ceremony picked based on scope, user approves.
- **Release-time README sweep** mandatory in every `chore(release)` commit — reconcile Open Issues, Routes, Components, Build, Schema sections with shipped state. To be filed into CONTRIBUTING.md after this release.
- **No temp `/admin/*` endpoints for one-shot ops** — prefer `curl + GITHUB_TOKEN` from `.deploy.env` or standalone scripts in `scripts/`. Two-deploy roundtrip pattern reserved only for ops that genuinely need Worker bindings.

### Verification

- `npm run build:web` clean (TS strict).
- `E2E_TARGET_PROD=1 npm run test` passes locally and in CI on `fce03cf`.
- Manual smoke deferred — this is a Worker-only release with no React UI changes.

---

## [8.5.0] — 2026-04-29

Polish release — Phase 1 of the v8.5.0–v8.5.3 backlog burn (spec `cf3e786`). Closes 5 v8.5.0 issues identified by the 2026-04-28 dashboard design audit. First release on the regression-test harness shipped in Phase 0.

### Added — Accessibility

- **`--c-accent-light: #ff7a3d` token** (`tokens.css` + `tokens.ts`) — AA-passing accent (~5.2:1 on canvas) for small-text usages flagged by audit H8. Applied to `Pill.accent` text (10px), `TopBar.brandBadge` (9px), `RoutesPicker.surfaceEm` (12px). PARS `--c-accent` (#ff4d00) stays the brand CTA color. Closes #25.
- **`useFocusTrap` shared hook** at `apps/web/src/hooks/useFocusTrap.ts` — extracted from `OnboardingModal.tsx` (commit `0e168a1`). Used by both `OnboardingModal` and `UserMenu`. Public API: `useFocusTrap<T>(active, { restore })` returns a `RefObject<T>`. Closes the inline-trap duplication called out in audit H3.
- **UserMenu keyboard navigation** (#27) — focus moves into the menu on open, `↑/↓` cycles between menuitems, `Home`/`End` jump to first/last, `ESC` closes and restores focus to the trigger. Closes #27.

### Changed — Performance

- **RideDetail expand drops `height: auto` animation** (#24) — opacity-only fade, GPU-composited, no layout pass per frame. Audit finding H6b. Animation duration trims 0.32s → 0.18s. Closes #24.

### Changed — Navigation

- **BottomNav active tab syncs to scroll position** (#26) — `IntersectionObserver` over the four section IDs (`#today`, `#train`, `#stats`, `#you`) with `rootMargin: -30% 0px -30% 0px` so a tab activates only when its section dominates the middle of the viewport. Click handler retained — tapping a tab still scrolls + sets active. New 1px `<div id="you" />` anchor at the end of `<main>` so the "You" tab has a real scroll target. Closes #26.

### Added — In-app updates

- **What's-new badge + modal** (#13) — Vite plugin reads repo-root `CHANGELOG.md` at build time, parses via `apps/web/src/lib/changelogParser.ts`, exposes through a `virtual:changelog` module. Components import the parsed entries synchronously. `WhatsNewBadge` in the TopBar trailing slot appears when `cc_lastSeenVersion` < the current release; clicking opens a modal with the latest 3 entries. Dismiss persists the seen version. Closes #13.

### Tests

- **11 Vitest unit tests** — 4 for `useFocusTrap`, 5 for `changelogParser`, 2 sentinel.
- **13 Playwright e2e tests** at mobile-375 + desktop-1280 — added coverage for ride-expand, UserMenu kbd nav, BottomNav scroll-sync, what's-new badge round-trip.

### Verification

- `npm run build:web` clean (TS strict).
- `E2E_TARGET_PROD=1 npm run test` passes locally and in GitHub Actions on every push to main.
- Manual smoke at 375 + 1280 px before the release cut.

---

## [8.4.1] — 2026-04-28

Hotfix: `/whats-next` showed a stale issue count in PWA mode.

### Fixed

- **Service worker `NEVER_CACHE` was missing `/roadmap`**, so the SW served the first-fetched roadmap response forever (cache-first strategy). After the v8.4.0 release filed audit deferrals #24–#27, users on the PWA still saw the old 21-open-issue count. Added `/roadmap` and `/admin/*` to `NEVER_CACHE` — these are dynamic data + admin endpoints that should never be cached client-side.
- **`CACHE` version pinned at `v8.2.0`**. The service worker's bust mechanism is "bump `CACHE` on every meaningful release"; v8.3.0 and v8.4.0 missed the bump. Set to `cycling-coach-v8.4.1`. The `activate` listener deletes any cache key not matching the current name, so old PWA caches evict on first reload.

Users on the PWA may need a hard refresh (or close + reopen the installed app) once to pick up the new SW; from there everything stays current.

---

## [8.4.0] — 2026-04-28

Dashboard design audit pass — first invocation of the `ui-ux-pro-max` skill (99 UX guidelines + 44 react-perf + 53 react-stack rules) against `/dashboard`. **22 findings**: 13 shipped this release, 4 filed as v8.5.0 issues, the rest already covered by existing issues.

The audit was scoped to two breakpoints (375 px / 1280 px) and the skill's eight priority categories (Accessibility CRITICAL → Charts LOW). PARS as a design language stays — the skill's sports-fitness preset (Vibrant + Block-based, Barlow Condensed, green CTA) was rejected as off-brand for the Marco persona; the rationale lives at the top of `apps/web/src/design/tokens.ts` so future passes don't regress it.

### Added — Accessibility

- **`<MotionConfig reducedMotion="user">`** wrapping the entire React tree in `main.tsx`. Every `motion.section` / `motion.div` literal `transition` prop now short-circuits under `prefers-reduced-motion` — Motion library's built-in handling, but it requires the wrapper to engage.
- **Global reduced-motion CSS catch** in `tokens.css` — sets `animation-duration: 1ms`, `animation-iteration-count: 1`, `transition-duration: 1ms` on `*` inside the `prefers-reduced-motion: reduce` block. Stops the hardcoded `1.6s ... infinite` pulses (Pill `.dot`, today-pulse on the AI Coach week plan, today-pulse on the dashboard week-day badge) regardless of how they're declared.
- **Skip-to-main link** as the first child of `<body>` (rendered from `__root.tsx`), styled in `reset.css`. Keyboard-only users land on a focusable "Skip to main content" pill that jumps over TopBar + UserMenu to the dashboard's `<main id="main">`.
- **OnboardingModal focus trap + restore** — Tab / Shift-Tab now wrap inside the dialog (queries focusable descendants on each keystroke); on close, focus returns to whichever element opened the modal (`document.activeElement` snapshot taken on open).
- **TopBar safe-area inset** — `padding-top: calc(var(--s-3) + env(safe-area-inset-top, 0))` so the sticky bar clears the iPhone notch / dynamic island.
- **VolumeChart `role="img"` + `aria-label`** with a generated description ("Volume — last 12 weeks: 1,247 km, 18,400 m elevation"). Screen readers now get a meaningful summary instead of a div soup.
- **Address input `aria-label="Start address"`** in RoutesPicker — placeholder is no longer the only accessible label.

### Changed — Touch targets

- **Eight ghost / mono-text buttons** bumped to `min-height: var(--hit-min)` (44 px) — the WCAG floor: `AiCoachCard.subtleBtn`, `GoalEventCard.{subtleBtn, dangerBtn}`, `OnboardingModal.skipBtn`, `RoutesPicker.{surfaceBtn, addressEdit, addressCancel, showAll}`, `Dashboard.demoBannerClose` (was 28 × 28 → now 44 × 44). Visual weight unchanged; a 44 px hit zone now wraps the small mono labels.

### Changed — Performance

- **VolumeChart bars: `height` → `transform: scaleY`**. Animating `height` forced layout each frame; the skill's react-performance.csv flags this directly as 'Animation: Transform Performance'. Bars now fill the column at full height and scale from `bottom center` — GPU-composited, no layout cost.

### Changed — Semantics

- **VolumeChart toggle:** `role="tablist"` / `role="tab"` dropped (no matching `tabpanel`s existed); replaced with `role="group"` + `aria-pressed` on the buttons. Functionally identical, ARIA semantics now complete.

### Changed — Polish

- **Time-of-day greeting** — `Morning / Afternoon / Evening / Late night` based on `getHours()`. The hero used to greet "Morning, Marco" at 9 PM.
- **`alert()` replaced with smooth-scroll** — the sample WorkoutCard's Start button used to pop a native dialog telling the user to generate their AI plan; it now smooth-scrolls to the AI Coach section (`#train`) instead.
- **Demo banner copy** — "Demo data only — append `?demo=0`..." replaced with "You're viewing sample data. Connect Strava to see your own rides." No URL syntax in user-facing copy.

### Added — Documentation

- **Audit design doc + report** committed at `docs/superpowers/specs/2026-04-28-dashboard-design-audit-design.md` and `2026-04-28-dashboard-design-audit.md`. Full methodology, surface-by-surface findings ranked by severity + effort, fix-vs-defer rationale.
- **PARS rationale block** at the top of `apps/web/src/design/tokens.ts` — explains why we keep Geist + molten orange + cockpit dark over the skill's sports-fitness preset.

### Added — Tooling

- **`scripts/file-v8.4.0-audit-issues.sh`** — idempotent shell script that mirrors `bootstrap-issues.sh` to file the four audit deferrals against the v8.4.0 milestone (will reslot into v8.5.0 when run after this release).

### Deferred to v8.5.0

- **H6b** — RideDetail expand: stop animating `height: auto`, switch to opacity-fade or a measured-height approach.
- **H8** — Accent `#ff4d00` fails WCAG AA contrast for ≤14 px text on canvas. Introduce `--c-accent-light` for small-text usage; PARS brand keeps `--c-accent` for CTAs.
- **M2** — BottomNav active tab should follow scroll position via `IntersectionObserver`, not stay on the last-clicked item.
- **M5** — UserMenu keyboard nav (↑/↓/Home/End) + focus management. Extracts `useFocusTrap` hook from OnboardingModal so it's shared.

### Verification

- `npm run build:web` — TS strict + Vite production build clean.
- Manual probe deferred to user (Claude can't render a browser): 375 px / 1280 px walk through the dashboard, keyboard tab through skip-link + modal focus trap, OS reduced-motion toggle.

---

## [8.3.0] — 2026-04-28

GitHub Issues become the source of truth for the public roadmap. The `/whats-next` page now reflects the live state of the issue tracker within five minutes of any change. Releases ship weekly, driven by milestone closures.

### Added

- **Worker `/roadmap` endpoint** — proxies `https://api.github.com/repos/<owner>/<repo>/issues`, normalises each issue (title, first paragraph of body, labels, milestone, state, assignees) into the same shape the React page expects. Edge-cached for 5 minutes via Cloudflare's Cache API. Optional `GITHUB_TOKEN` Worker secret for higher rate limits / private repos.
- **`useRoadmap` Tanstack Query hook** — wraps `/roadmap`, falls back to the static `lib/roadmap.ts` seed if the request fails or returns empty (so the page is never blank during the first GitHub bootstrap).
- **`/whats-next` page rewrite** — pulls live items, links each card to its GitHub issue, shows the issue number, surfaces a `Live · GitHub` vs `Fallback · seed` pill, a "Updated 3m ago" timestamp, and a Refresh button. Adds a "Open an issue on GitHub" CTA in the footer.
- **`scripts/bootstrap-issues.sh`** — idempotent shell script that uses `gh` to ensure the labels (`priority:*`, `area:*`, `type:*`, `status:in-progress`), milestones (`v8.3.0`, `v8.4.0`, `v8.5.0`), and the open-backlog issues exist. Re-running is safe.
- **`CONTRIBUTING.md`** — documents the GitHub-issues-driven workflow, label/milestone conventions, weekly release cadence, and local-dev pointers.

### Changed

- **`lib/roadmap.ts`** demoted from source-of-truth to fallback seed. Item type widened to accept GitHub-fed shape (numeric ids, optional `url`, `number`, `closed_at`, `updated_at`).
- **Vite proxy + `wrangler.jsonc`** updated to forward `/roadmap` to the Worker (added to `assets.run_worker_first`).

### Workflow

```
GitHub Issues  ─►  Worker /roadmap  ─►  /whats-next page
[label/milestone]   [5-min edge cache]   [Tanstack Query, 5-min stale]
```

To bootstrap your issue tracker:

```bash
brew install gh
gh auth login
./scripts/bootstrap-issues.sh
```

After that, every `gh issue create` (or web-UI add / close / milestone change) shows up on the public roadmap inside ~5 minutes.

---

## [8.2.0] — 2026-04-28

Issue-cleanup release. Audited the v8.0.0 follow-up list and shipped four of five remaining items in one go. The last (`[backfill]`) is deferred — it depends on the remote D1 schema migration, which requires your action.

### Added — first-run FTP onboarding

- **`useAthleteProfile`** hook backed by localStorage (`cc_athleteProfile` + `cc_onboardingDismissed`). Captures FTP, weight, HR max and exposes `needsOnboarding`, `isComplete`, `dismissOnboarding`.
- **`<OnboardingModal>`** — first time you reach `/dashboard` after auth, a modal asks for the three numbers. Live W/kg readout + classification ("cat-2 / strong amateur" etc.) as you type. Skip stores a dismissal flag; "Edit profile" in the user menu reopens it.
- **Real TSS + zone math** turns on once FTP is saved. The `useRides` hook now takes `ftp` and feeds it to `stravaToActivity`, which computes `npWatts / ftp` for IF and uses `zoneFor(npWatts, ftp)` instead of defaulting Z2.

### Added — Strava 7-zone power model

- **Z7 Neuromuscular Power** (>150 % FTP) added end-to-end:
  - `Zone` type widened to `1 | 2 | 3 | 4 | 5 | 6 | 7`.
  - `--c-z7: #6b21a8` token in `tokens.{ts,css}`.
  - `COGGAN_ZONES` re-bucketed: Z6 = anaerobic capacity (1.21–1.50 × FTP), Z7 = neuromuscular (>1.50 × FTP).
  - `ZonePill` + `WorkoutCard` + `StatTile` accept Z7. Glow + zone-stripe render purple-deep.

### Added — PWA shell

- **`apps/web/public/manifest.webmanifest`** — name, theme color, standalone display, three home-screen shortcuts (Today / Train / Previous rides).
- **`apps/web/public/icon.svg` + `icon-maskable.svg`** — molten-orange BikeMark on the canvas-deep tarmac.
- **`apps/web/public/sw.js`** — cache-first for static assets, network-first for navigation requests with offline fallback to the cached SPA shell. `/api/*`, `/authorize`, `/callback`, `/refresh`, `/coach*`, `/webhook`, `/version` are always passed through to the network (never cached).
- Service-worker registration in `main.tsx` is gated on `import.meta.env.PROD` so dev never tries to load `/sw.js`.

### Changed — Worker pruned

- Deleted **2,692 lines** of dead HTML from `src/worker.js`: `landingPage()`, `dashboardPage()`, `privacyPage()`, `SHARED_HEAD`, `SHARED_BG`, `BIKE_GLYPH`, `FAVICON_B64`. Workers Static Assets makes them unreachable; they were just bundle weight.
- `callbackPage()` slimmed to ~50 lines (PWA branch + standard browser branch). `errorPage()` slimmed to ~15 lines. Both inline minimal CSS using the PARS palette.
- The fetch handler's `/`, `/dashboard`, `/privacy` routes were also removed — those are SPA-served. Worker now goes from 3,375 → **683 lines** (-80 %).

### Changed — UserMenu

- New "Edit profile" entry surfacing the FTP/weight/HR-max modal again post-onboarding.

### Deferred to v8.3.0

- `[backfill]` Retroactive TSS computation from existing `activities.strava_raw_json`. Depends on `migrations/0001_pmc_and_events.sql` being applied to the remote D1 (`wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql --remote` — your call).
- `[live-routes]` Replace `MOCK_ROUTES` with `/api/athlete/routes` response.
- `[ci-build-cmd]` Update Cloudflare Workers Builds command to `npm run build:web`.

---

## [8.1.0] — 2026-04-28

Five tracked feature requests, shipped in one release.

### Added

- **Editable goal event** — `useGoalEvent` hook + `<GoalEventCard>` component. The dashboard event card now has an Edit affordance that flips it into an inline form: name, type (Gran Fondo / Race / TT / Crit / Volume / Tour / Other), date, distance, elevation, location, priority (A / B / C). Persists to localStorage; will sync to D1 once schema v2 is applied (the `goals` table already has `event_name`, `event_type`, `target_date` columns).
- **Disconnect Strava menu** — avatar pill is now a popover trigger (`<UserMenu>`). Three actions: *Sync now* (invalidates Tanstack Query cache), *Revoke at Strava ↗* (opens `strava.com/settings/apps` so users can fully drop the OAuth grant), *Disconnect Strava* (clears local tokens + redirects to `/`). Backed by ESC + click-outside to dismiss.
- **Ride detail on tap** — clicking any row in Recents expands an inline detail panel that lazy-fetches `/api/activities/{id}` via Tanstack Query (cached forever). Surfaces description, primary photo, decoded route polyline rendered as inline SVG, full stats grid (distance / time / elevation / avg + max HR / avg + max + NP watts / kJ), best efforts (PRs by distance), segment efforts with achievements, kilometre splits with elevation deltas, and an "Open on Strava ↗" link. Demo mode renders a stat-only fallback.
- **What's next page** at `/whats-next` — public roadmap sourced from `lib/roadmap.ts` (mirrors `.github/ISSUES_v8.0.0.md`). Three sections (In progress / Open / Shipped) with priority + status pills, area tag, target version. Linked from the landing footer.
- **`useActivityDetail`** — Tanstack Query hook with `staleTime: Infinity` (ride data never changes after upload) + 30-min GC.
- **`lib/polyline.ts`** — Google polyline decoder + a `polylineToSvg()` helper that projects to a viewBox preserving aspect ratio.

### Changed

- **Bottom nav** — "Stats" tab renamed to **"Rides"** to match its content (recent ride list, not aggregate analytics).
- **Recents heading** updated from "Recents" to "**Previous rides**" with copy that points users at both the tap-to-expand detail and the AI coach verdict.
- **`MOCK_EVENT`** is now a default seed only; the live source is the `useGoalEvent` hook backed by localStorage.
- **`stravaApi`** gained `activityDetail(id)` + the `StravaActivityDetail` / `StravaSplit` / `StravaBestEffort` / `StravaSegmentEffort` / `StravaPhoto` types.

### Files

```
apps/web/src/
├── components/
│   ├── GoalEventCard/       (new — editable event card)
│   ├── RideDetail/          (new — lazy-loaded expansion panel)
│   └── UserMenu/            (new — avatar popover)
├── hooks/
│   ├── useActivityDetail.ts (new)
│   └── useGoalEvent.ts      (new)
├── lib/
│   ├── polyline.ts          (new)
│   └── roadmap.ts           (new)
├── pages/
│   └── WhatsNext.tsx + .module.css  (new)
└── routes/
    └── whats-next.tsx       (new)
```

---

## [8.0.1] — 2026-04-28 — Hotfix

Critical fix: the v8.0.0 dashboard was rendering Marco-Bianchi seed mock data **regardless of authentication state** — even after a successful Strava OAuth round-trip. v8.0.1 wires the real-data swap and hardens the auth gate.

### Fixed

- **Dashboard auth gate** — `/dashboard` with no Strava tokens now renders a dedicated `ConnectScreen` instead of mock data. Mock data only ever shows in dev (`import.meta.env.DEV`) or when the URL carries `?demo=1`.
- **Real-data swap** — when tokens exist, `Dashboard` fetches the user's athlete profile (`/api/athlete`) and last 200 activities (`/api/athlete/activities`) via Tanstack Query through the Worker proxy, converts them to the internal shape (`stravaConvert.ts`), and derives every widget (PMC, streak, wins, volume, recents, AI coach context) from real data.
- **Loading screen** — first-time syncs show a centered spinner with copy ("Syncing your rides…") instead of a flash of mock content.
- **Token refresh on 401** — `useStravaData` clears tokens when Strava returns `not_authenticated`, falling through to the ConnectScreen.

### Added

- `ConnectScreen` page — full editorial connect prompt with primary CTA, fact row, and `?demo=1` discovery hint.
- `LoadingScreen` page — centered spinner + status copy, used during initial fetch.
- `lib/stravaConvert.ts` — Strava activity → internal `MockActivity` mapper. Computes real TSS / primary zone when FTP is known; falls back to a duration-based proxy (≈70 TSS/h) marked clearly in the UI.
- `lib/pmc.ts → computePmcDelta()` — PMC + 7-day delta from any activity list (was hard-wired to mock).
- `useStravaData` / `useAthlete` / `useActivities` / `useRides` Tanstack Query hooks.
- Dashboard `↻` and `⏻` buttons in TopBar wire to `queryClient.invalidateQueries` and `clearTokens` respectively (sync + disconnect).
- Profile photo support — Strava `athlete.profile` URL renders in the user pill; falls back to initials.

### Changed

- All widgets now compute their data from a single `activities` array passed into `<DashboardView>`. The fork between mock + real lives in one place (`<DashboardInner>`).
- Greeting copy now reads form state from PMC ("Form is fresh / productive / fatigued / overreached") instead of hardcoded mock text.
- Year-to-date km computed from real activities filtered to current year. Yearly goal target still mocked (8,000 km) until goals UI ships.
- "TSS proxy" disclosure rendered under quick stats when FTP is unset, so the user knows the PMC numbers are an estimate.

### Known limitations

- **Strava app callback domain** — if you set callback domain to `localhost` during dev testing in v8.0.0, OAuth fails in prod with "redirect_uri mismatch". Reset to your production domain at <https://www.strava.com/settings/api> (one-time fix on Strava's side; not in this repo).
- **Goal event** still mocked (Etape du Tour). Real events table TBD — see `[goal-events]` in the issues file.
- **FTP onboarding** — the dashboard now correctly shows "—" for FTP/W·kg and the duration-based TSS proxy when FTP is unknown. The first-run flow capturing FTP is open as `[ftp-onboarding]`.

---

## [8.0.0] — 2026-04-28

**The PARS redesign.** Full architectural reset: the dashboard moves to a React/Vite SPA layered on top of the existing Worker via Cloudflare Workers Static Assets. Single deploy, single URL, no CORS. The aesthetic flips from the prior light editorial theme to **Performance Dark** — near-black canvas, molten-orange accent, Geist + Geist Mono, instrument-panel data density. Designed for **Marco** — the performance-driven amateur cyclist (Zürich, FTP-aware, training 8–12 h/week).

### Added — frontend

- **React 19 + Vite + TypeScript strict** SPA at `apps/web`. Tanstack Router (file-based, type-safe), Tanstack Query, Motion, CSS Modules, Biome.
- **Design system v1** — single source of truth in `apps/web/src/design/tokens.{ts,css}`. Tokens for color (canvas, surface, text, accent, Coggan zones Z1–Z6, status), spacing (4 px base), radius, shadows, motion durations + easings, type scale, z-index, breakpoints.
- **Twelve base components**: `Button`, `Card`, `Container`, `Eyebrow`, `Pill`, `BikeMark`, `BottomNav` (mobile authed nav), `GrainOverlay`, `PmcStrip`, `ProgressRing`, `StatTile`, `TopBar`, `WorkoutCard`, `ZonePill`.
- **Landing** route — hero ("Train like the metrics matter"), instrument-cluster preview (live PMC + workout + ring), credentials band, FOR / NOT FOR honesty list, 3 feature spreads, BYOK pricing, final CTA, editorial footer.
- **Privacy** route — editorial sections, success/warn callout boxes, mono code spans.
- **Dashboard** route — see "Dashboard sections" below.

### Added — dashboard sections

1. **Hero fold** — italic greeting, PMC strip (CTL · ATL · TSB with 7-day deltas), 4 quick stats, goal-event countdown, yearly km goal ring with projected year-end.
2. **Today's workout** — uses the AI-generated plan when available, falls back to a sample WorkoutCard.
3. **Streak heatmap** — 12 weeks × 7 days, 5 intensity buckets, current/best/total numbers, today cell pulses.
4. **Wins timeline** — last 90 days of PRs surfaced as a feed.
5. **Volume chart** — distance + elevation bars, weekly/monthly toggle, 12-bucket window, totals header.
6. **AI Coach** — three states: BYOK setup → sessions/week picker (1–7 with hint copy) + Generate → full plan render (summary, strengths, areas to improve, 7-day plan with today highlight, motivation, regenerate).
7. **Routes for today** — saved routes scored against today's plan + surface preference (Tarmac/Gravel/Any) + start address. Match % per row, top-3 default with "Show all".
8. **Recents** — 8 most recent rides with inline "Get coach verdict" panel calling `/coach-ride`.

### Added — backend / infra

- **Workers Static Assets** in `wrangler.jsonc` (replaces the legacy CF Pages flow). Single Worker serves SPA + API. `run_worker_first` lists OAuth + API + AI + webhook paths.
- **`migrations/0001_pmc_and_events.sql`** — schema v2 adds `users.ftp_w / weight_kg / hr_max`, `activities.tss / np_w / if_pct / duration_s / primary_zone`, new `daily_load` PMC rollup table, event-extension columns on `goals`. *(Migration ready; not auto-applied. Apply with `wrangler d1 execute`.)*
- **`/authorize` + `/callback` honor `?origin=`** so OAuth redirect_uri returns to the user's actual host (works in Vite dev at :5173 even though Worker runs at :8787). Origin is base64-JSON-encoded into Strava's `state` param to survive the round-trip. Strict allowlist: only localhost loopbacks accepted.
- **Concurrent dev** — `npm run dev:all` boots Worker + Vite together via `concurrently`. Vite proxies `/api`, `/authorize`, `/callback`, `/refresh`, `/coach`, `/coach-ride`, `/version`, `/webhook` to the Worker.

### Changed

- **Type stack**: Geist (UI) + Geist Mono (numerals). Two families. Inter is gone.
- **Color**: dark canvas + molten orange `#ff4d00`. Strava brand orange `#fc4c02` retained but reserved for Strava-specific UI (sync indicators, attribution).
- **Build & deploy**: root `package.json` adds `dev:web`, `dev:worker`, `dev:all`, `build:web`, `build`, `deploy` scripts. Single `npm run deploy` builds the SPA then `wrangler deploy`s the Worker with assets attached.

### Restored from v7 (after the initial redesign dropped them)

- AI weekly plan generator (sessions-per-week picker, full plan render).
- Per-ride AI feedback (verdict + concrete next-time suggestion).
- Streak heatmap.
- Wins timeline.
- Volume chart.
- Saved routes picker with surface + start-address preferences.
- All preferences keyed under `cc_*` localStorage to maintain compatibility with the legacy Worker's keys.

### Persona-driven design decisions

- **Mono for every numeral** — like a Garmin Edge / Wahoo BOLT screen.
- **No emoji as visual currency** — replaced with crafted SVG glyphs (BikeMark, ★, ◆).
- **Square-ish radii** (max 16 px) — instrument-coded, not bubble-shaped.
- **Italic flourishes only on emphasis words** — italic = brand inflection, not body copy.
- **Topographic SVG behind the landing hero** — Ordnance Survey / cycling-map atmosphere.
- **`prefers-reduced-motion` zeroes every duration** in CSS — single guard, never per-component.

### Known limitations / next up

- Dashboard renders **seeded Marco-Bianchi mock data** by default. The real-data swap (live `/api/athlete` + `/api/athlete/activities` via Tanstack Query) is wired in `lib/api.ts` and `lib/auth.ts` but not yet hot-swapped at the page level. Apply schema v2 migration first, then flip the toggle.
- TSS backfill from existing `strava_raw_json` — schema columns added, backfill script not yet written.
- Strava 7-zone power model — currently using Coggan's 6 (Z1–Z6). Z7 token + ingestion pending. See `lib/zones.ts`.
- The legacy `landingPage()` / `dashboardPage()` / `privacyPage()` functions in `src/worker.js` are unreachable under Workers Static Assets but still bundled. Pruning them is a follow-up.
- Cloudflare Pages app's previous CI build command may still be `wrangler deploy` only — update Workers & Pages → cycling-coach → Settings → Builds → Build command to `npm run build:web` for full CI/CD.

---

## [7.0.3] — 2026-04-26

Final pre-redesign release. Editorial-light theme with Instrument Serif numerals, Strava orange accent, single-column 780 px dashboard. Featured: streak heatmap, wins timeline, AI weekly plan, per-ride coach verdicts, training prefs, routes picker, yearly goal ring, distance/elevation charts, ride detail expansion. Strangler-Fig D1 dual-write in progress (sub-phase 2.2a).

## [7.0.0]–[7.0.2] — earlier in April 2026

Iterations on the v7 editorial theme — heatmap colors, hero typography, footer rhythm, surface-preference flow, route scoring algorithm.
