# Sprint 2 Business Requirements
**Source:** Sprint 1 retro (`docs/retros/sprint-1.md`) + Sprint 2 founder-locked scope
**BA:** Sonnet
**Date:** 2026-04-30

---

## Stories

### FB-R1 · /coach + /coach-ride auth gate breaks BYOK key flow [REGRESSION]

**User story**
As a **casual commuter (C)** or **solo rider (A)**, I want my "Generate plan" click to work after I have entered my Anthropic key, so that I am not blocked by an auth error that I cannot diagnose or resolve.

**Background**
v9.3.0 introduced `resolveAthleteId` (Strava bearer) as an auth gate on `/coach` and `/coach-ride` to close the open-Anthropic-proxy CRITICAL (#33). The gate is correct and must stay. The regression is in the frontend: `apps/web/src/lib/coachApi.ts:89` `postJson()` sends only `Content-Type` — it never sends `Authorization: Bearer <strava_token>`. Every call to `/coach` and `/coach-ride` therefore arrives without credentials and receives a 401.

**Acceptance criteria**
- `postJson()` in `coachApi.ts` reads the Strava access token via the same path used by `useStravaData` / `RoutesPicker` (i.e., through `ensureValidToken` — see IR-R1) and attaches `Authorization: Bearer <token>` to every request.
- The legacy `AiCoachCard` "Generate plan" button completes successfully when a valid Anthropic key is present and the user has an active Strava session.
- If the Strava session has expired (token refresh fails), the user sees a clear "Your Strava session has expired — reconnect Strava" message with a reconnect CTA. No generic "auth error" or raw 401 text.
- The bearer gate on `/coach` and `/coach-ride` is NOT removed or weakened (reverting it re-opens CRITICAL #33 — see AC-R1).
- No regression on existing Strava-authenticated flows (routes, rides, athlete).

**Priority:** P0 — user-facing blocker; affects every BYOK user attempting to generate a plan

**Dependencies:** None (frontend-only fix; no schema changes)

**Complexity:** S (2–4 h) — the fix is one function in `coachApi.ts`; the session-expired error path adds ~1 h

---

### FB-R2 · You-tab API key form lost the Anthropic-key instructions link [REGRESSION]

**User story**
As a **casual commuter (C)**, I want to see a direct link to get my Anthropic API key when setting up the app, so that I can complete the BYOK setup without having to search for instructions on an external site.

**Background**
The legacy `AiCoachCard.tsx:90` showed: *"Your key stays in this browser. [Get a key →](https://console.anthropic.com/settings/keys)"*. The new `dashboard.you.tsx:142-144` replaced that with: *"Bring your own Anthropic key to generate a weekly training plan. Each plan ≈ $0.02."* — the link and the privacy reassurance are absent. Persona C is non-technical and will not know where to obtain a key without this guidance.

**Acceptance criteria**
- The You-tab API key form, when no key is currently set, displays:
  - The "Get a key →" link pointing to `https://console.anthropic.com/settings/keys` (same wording as legacy).
  - The "Your key stays in this browser" reassurance line (same wording as legacy).
- The existing cost-per-plan copy ("Each plan ≈ $0.02") may be retained alongside the new lines.
- Once a key is saved, the link and reassurance line are hidden (key already in place — no need to repeat).
- No visual regression on the rest of the You-tab profile section.

**Priority:** P0 — UX gap that blocks Persona C from completing setup

**Dependencies:** None (frontend copy change; no schema or API changes)

**Complexity:** XS (<1 h) — copy and link addition only

---

### FB-3 / FB-4 / FB-6 — carry over from Sprint 1 BA doc

*See `docs/post-demo-sprint/01-business-requirements.md`. No story rewrite needed; the Sprint 1 BA doc covers acceptance criteria, dependencies, and complexity verbatim.*

Summary of carried stories for reference:
- **FB-3 (≡ #49)** — AI-powered year-end forecast; replaces static 8,000 km bar; depends on FB-4 goal data model.
- **FB-4 (≡ #50)** — Annual goal linked to weekly planning; precedes FB-3; reuses existing `goals` table (`goal_type='annual_km'`) per architect spec §B.1.
- **FB-6 (≡ #52)** — Expanded "You" tab profile page; Migration 0003 (`users.sex`, `users.country`) per architect spec §B.2 + §B-SQL; Anthropic key field writes to existing `localStorage` (no D1) per architect spec §B.3.

Sprint 2 dependency order: **FB-4 → FB-3 → FB-6** (goal model before forecast; profile page after forecast UI is stable).

---

## Implicit Requirements (regression-specific)

| ID | Description | Triggered by |
|---|---|---|
| IR-R1 | **Frontend Strava token read pattern** — `coachApi.ts` must read the Strava access token via `ensureValidToken`, the same helper used by `useStravaData` and `RoutesPicker`. Do not introduce a second token-retrieval path (e.g., raw `localStorage` read). Consistent token retrieval is required to ensure refresh logic fires correctly on expired tokens. | FB-R1 |
| IR-R2 | **Session-expired error UX pattern** — the "reconnect Strava" CTA introduced by FB-R1 should reuse the same reconnect flow as the existing `<ConnectScreen />` component (or the `connect-strava` CTA already present elsewhere in the dashboard). Do not build a second reconnect UI. | FB-R1 |

---

## Architecture-Conflict Flags

| Flag | Story | Conflict |
|---|---|---|
| AC-R1 | FB-R1 | Reverting #33's bearer gate on `/coach` + `/coach-ride` re-opens a CRITICAL open-Anthropic-proxy vulnerability. The CTO must approve the "fix in frontend (`postJson` sends bearer)" approach before the architect begins implementation. The gate must not be removed as a shortcut. |

---

## Schema-Change Flags

Migration 0003 (`users.sex`, `users.country`) carries from the Sprint 1 architect spec — see `docs/post-demo-sprint/03-architecture-changes.md` §B.2 and §B-SQL. It is triggered by FB-6 (#52).

No new schema changes for FB-R1 or FB-R2 — both regressions are frontend-only with no database touch.

| Migration | File | Triggered by | Status |
|---|---|---|---|
| 0003 | `migrations/0003_users_strava_profile.sql` | FB-6 (#52) | pending (carry from Sprint 1 arch spec) |
