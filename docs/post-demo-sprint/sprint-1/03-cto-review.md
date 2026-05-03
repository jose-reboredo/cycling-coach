# CTO Review — Sprint 1
**Author:** CTO Review
**Date:** 2026-04-30
**Inputs:** `01-business-requirements.md`, `ux-design-specs.md`, `02-architecture-changes.md`
**Issues addressed:** #47–#53 (BA-filed) + carry-over security backlog #33, #34, #38–#45
**Product baseline:** v9.2.5

---

## §A. Risk Assessment

| Change / Feature | Issue | Technical | Dependency | Timeline | Notes |
|---|---|---|---|---|---|
| Mobile 4-tab refactor | #51 | **MEDIUM** | LOW | **MEDIUM** | Dashboard.tsx is 700 lines split across 4 route files + layout shell. Blast radius covers every existing dashboard test. Recommend kill-switch flag (`cc_tabsEnabled`) like the v9.0.0 clubs rollout. Ship behind flag, flip at the demo. |
| Route Phase 1 (Strava saved routes) | #47 | LOW | LOW | LOW | Existing `/api/*` Strava proxy is the data source — same auth, same rate-limit envelope. Worker-side filter is pure JS. ~6h. |
| Route Phase 2 (Claude narrative briefs) | #47 | MEDIUM | LOW | MEDIUM | New endpoint, Anthropic Haiku call, KV rate-limit. Per-call cost ~$0.001-0.003. Spike scope only this sprint cycle — full implementation slips if scope creeps. |
| YTD AI forecast | #49 | LOW | **MEDIUM** | LOW | Webhook hook already exists (#17, v8.5.2). KV namespace exists (DOCS_KV). System-paid Haiku ~$0.001 per athlete per sync. Dependency: needs the goal data model from #50 to surface "on track for goal" — but graceful fallback when no goal set. |
| Goal ↔ Plan integration | #50 | MEDIUM | LOW | MEDIUM | Existing `goals` table covers the data; risk is in the WEEKLY-PLAN GENERATION prompt — Claude prompt template needs Base/Build/Peak/Taper phase logic. Prompt-engineering risk + cost-per-regeneration risk. Mitigation: cap regenerate-plan to 5/day/athlete. |
| Profile expansion (You tab) | #52 | LOW | LOW | LOW | Mostly UI work — existing Strava sync extension is 4h, You tab content from UX §E is ~6h. No D1 schema risk after migration 0003. |
| Clubs expansion | #53 | **UNKNOWN** | **HIGH** (scoping session) | UNKNOWN | Cannot estimate without a stakeholder scoping pass. The roster-slice (~8h) is the only sub-task with a real number. Everything else is "TBD". |
| Migration 0003 (`users.sex`, `country`) | — | LOW | LOW | LOW | Non-breaking ADD COLUMN. NULL default. Backfill happens on next sign-in via extended `persistUserAndTokens`. |
| Migration 0004 (`training_prefs.*`) | — | LOW | LOW | LOW | Same shape as 0003 — non-breaking, NULL default. UI falls back to per-persona defaults when NULL. |
| Security #33 `/coach` zero-auth | #33 | LOW | LOW | LOW | ~1h fix per the existing audit issue body. Adds `resolveAthleteId` gate to two endpoints. |
| Security #34 X-Forwarded-Host | #34 | LOW | LOW | LOW | ~30min — strip the header, allowlist origins. |
| Security HIGH batch (#38–#45) | — | LOW each | LOW | MEDIUM combined | 8 issues, each <2h. Run as a single dedicated sprint slot to avoid context-switching overhead. |

---

## §B. Priority Override

Two adjustments to the BA's priority list:

### B.1 Fold #48 into #51 (do not ship as separate issue)

The BA marked **#48 (Dashboard clarity, P1)** as a separate story. **It's effectively subsumed by #51 (Mobile tabs restructure, P0).** Once the 4-tab structure ships with proper labels per UX §A, the "every section has a visible heading" + "KPI cards have one-line labels" + "no more than one tap to navigate" criteria are naturally satisfied. Filing #48 as separate work creates a fake second sprint item.

**Decision:** close #48 with a comment redirecting to #51. The acceptance criteria from #48 become acceptance criteria for #51. Saves a half-sprint of duplicate effort.

### B.2 Sequence #50 before #49 (BA had them as parallel P1)

The BA marked both as P1 with #49→#50 ordering ("FB-3 forecast, FB-4 goal"). **Architectural reality is the reverse**: the forecast's "on track for goal" line (UX §B) requires the goal data model, which #50 establishes (`goals` table with `goal_type='annual_km'`). Doing #49 first means shipping a forecast without the goal-coupling, then re-shipping when #50 lands.

**Decision:** sequence #50 → #49 within Sprint 2. The BA can update the issue dependency on #50.

### B.3 Security CRITICALs #33 + #34 lift into Sprint 1, not Sprint 3

The overnight audit's Sprint 3 plan grouped #33 + #34 with the HIGH-severity items (#38–#45). **Re-evaluating with multi-user clubs live:** #33 (`/coach` zero-auth → open Anthropic proxy) is a real exposure. Combined cost to fix is ~1.5h. Folding into Sprint 1 closes the only remaining post-audit CRITICALs without meaningful timeline impact.

**Decision:** #33 + #34 ship in Sprint 1 alongside the demo-blocker features. The HIGH batch (#38–#45) stays in Sprint 3 as planned.

---

## §C. Sprint Plan (3 weeks, ~40h each)

### Sprint 1 — Week 1: Demo-blockers + remaining security CRITICALs

**Goal:** mobile tabs working, route recommendation fixed, last 2 CRITICALs closed.

| Item | Issue | Effort | Owner |
|---|---|---|---|
| `/coach` + `/coach-ride` auth gate | #33 | 1h | implementer |
| Strip X-Forwarded-Host | #34 | 0.5h | implementer |
| Mobile 4-tab refactor (nested Tanstack routes + layout shell) | #51 (and #48 folded in) | 16-24h | implementer |
| Route Phase 1 — Strava saved routes + filter UI | #47 | 6h | implementer |
| Migration 0004 + training_prefs filter persistence | (architect §B.4) | 3h | implementer |
| Smoke + e2e test updates for tab routes | — | 3h | implementer |
| Release-cut + deploy v9.3.0 | — | 1h | implementer |

**Definition of Done:** v9.3.0 deployed; mobile shows 4 tabs; route picker works for Madrid (no hardcoded Zurich); CRITICALs #33 + #34 closed; Sprint 3 audit backlog reduced to HIGH-severity only; #48 closed.

**Total estimated: ~30-38h (within 40h budget; 2-10h buffer).**

### Sprint 2 — Week 2: Goal model + forecast + profile expansion

**Goal:** annual goal first-class; forecast replaces static bar; full You tab content.

| Item | Issue | Effort | Owner |
|---|---|---|---|
| Goal-plan integration (`goal_type='annual_km'` support, weekly plan phase logic, plan summary card) | #50 | 12h | implementer |
| YTD forecast (webhook hook + Haiku call + KV cache + GET /api/forecast + frontend ring) | #49 | 10h | implementer |
| Profile expansion (You tab content per UX §E, Strava sync extension to write `sex`/`country`) | #52 | 10h | implementer |
| Migration 0003 + persistUserAndTokens extension | (architect §B.2) | 4h | implementer |
| Test additions (forecast endpoint, goal annual type) | — | 2h | implementer |
| Release-cut + deploy v9.4.0 | — | 1h | implementer |

**Definition of Done:** v9.4.0 deployed; goal drives weekly plan with phase labels; forecast card replaces static "8000 km" bar; You tab shows the 7 sections from UX §E.

**Total estimated: ~39h (right at budget — no buffer).**

### Sprint 3 — Week 3: Clubs expansion + Phase 2 route spike + security HIGH batch

**Goal:** clubs roster live, route discovery proof-of-concept, audit HIGHs cleared.

| Item | Issue | Effort | Owner |
|---|---|---|---|
| Founder scoping session for clubs expansion | #53 | 1h founder + 1h implementer (note-taking + issue refile) | founder + implementer |
| Clubs member roster slice (UI in club Dashboard, no schema change) | #53 (subset) | 8h | implementer |
| Route Phase 2 spike — `POST /api/routes/discover` with Claude narrative briefs + KV rate-limit | #47 (Phase 2) | 10h | implementer |
| Security HIGH batch: #38, #39, #40, #41, #42, #43, #44, #45 | 8 issues | ~12h combined | implementer |
| Release-cut + deploy v9.5.0 | — | 1h | implementer |

**Definition of Done:** v9.5.0 deployed; clubs members visible to all; "Discover routes" CTA works for at least one persona; 8 HIGH-severity audit items closed; remaining open issues are #31 (low), #32 (low), and any new findings.

**Total estimated: ~33h + 1h founder time. Under budget — leaves 6h buffer for clubs scoping outcome to expand the roster work if the scoping session warrants.**

---

## §D. Architecture Decision Records

### ADR-1 — Route data source: hybrid Strava saved → Claude narrative → Komoot partnership

**Decision:** Phase 1 ships Strava saved routes (the user's own); Phase 2 spikes a Claude-generated narrative brief endpoint for users with no saved routes; Phase 3 deferred until a Komoot partnership is approved.

**Context:** The original product appeared to assume Strava had route recommendations. It doesn't. The 5 candidate sources differ on real-GPX availability, surface metadata, and partnership-gating (Architect §A details). The fastest path to a working product is to use what we already have access to (Strava saved routes) and degrade gracefully via Claude narratives when the saved-routes set is empty. OSM/Overpass would solve everything but costs 30-40h to build a custom ranking layer — out of scope this cycle.

**Consequences:** Users with saved routes get a real fix immediately (~6h work). Users with no saved routes see narrative briefs only — honest about the limitation, with a deeplink to plan-the-GPX in Komoot/RideWithGPS externally. UI shape stays constant across phases so a Phase 3 swap doesn't require a redesign.

**Alternatives rejected:** Komoot direct (partnership-gated, can't ship now); RideWithGPS direct (same gating); OSM/Overpass (build cost too high); Claude-only generated routes (UX dead end — non-real GPX); Strava-only without Phase 2 (empty experience for new users).

---

### ADR-2 — Mobile tab architecture: nested Tanstack routes (not client-side state)

**Decision:** Add 4 nested routes under `/dashboard` (`today`, `train`, `rides`, `you`), with a shared layout shell rendering bottom tab bar on mobile and existing sidebar on desktop. `/dashboard` redirects to `/dashboard/today` via `beforeLoad`.

**Context:** Two architecturally valid options for the 4-tab UX (Architect §D). Nested routes preserve browser back/forward, deep-linkability, per-tab loading state, and auto-code-splitting. Client-side state is cheaper to ship but breaks back/forward and deep-links — and the UX spec explicitly framed tabs as "pages, not sections."

**Consequences:** Refactor cost ~16-24h (highest single Sprint 1 item). Preserves `?demo=1` flow with router param propagation. Adds `cc_tabsEnabled` flag for kill-switch (matches v9.0.0 clubs pattern). Existing e2e tests at `/dashboard?demo=1` need URL updates in the same PR. Each tab gets its own data fetch and loading state — better UX, slightly more code.

**Alternatives rejected:** Client-side tab state (no browser back, no deep-links); separate top-level routes outside `/dashboard` (breaks information hierarchy); rendering all 4 sections on mobile and CSS-hiding inactive ones (defeats the whole "no scroll" intent of #51).

---

### ADR-3 — AI forecast: webhook-driven Haiku, KV-cached, system-paid

**Decision:** Forecast computed in the Worker on Strava webhook events. Linear projection always; Haiku-refined when ≥56 days of data. Result cached in `DOCS_KV` under `forecast:${athlete_id}` with 7-day TTL. Frontend reads via `GET /api/forecast`. System-paid (no BYOK for this specific call).

**Context:** UX §B requires a 1-2 sentence narrative forecast that updates with new rides. Anthropic Haiku at ~300 token context costs ~$0.001 per call — at <100 users, total monthly cost is <$5. BYOK for this would add friction for Persona C ("casual commuter") who may never set up an Anthropic key. The weekly-plan generator (`/coach`) stays BYOK because it's a much larger context (~$0.05 per call with Sonnet).

**Consequences:** Two-tier Anthropic cost model: forecast = system-paid Haiku, weekly plan = BYOK Sonnet. Webhook hook already exists (v8.5.2 #17), reusing it. KV namespace already exists (DOCS_KV). No new secret. Forecast endpoint returns 404 with a clear "not yet computed" code when no KV entry; UI falls back to client-side linear projection. If Anthropic 5xx, falls back to linear with `ai_refined: false` in the response so UI can show a subtle indicator.

**Alternatives rejected:** Pure client-side (can't do AI refinement without exposing a key); BYOK end-to-end (friction for Persona C); per-page-load Anthropic calls (cost would be 30-100× higher and adds dashboard latency); separate KV namespace (unnecessary — `forecast:` prefix is enough).

---

## §E. Open Questions for Founder

**Block Sprint 1 start (must answer first):**

1. **Sprint 1 scope confirm** — fold #48 into #51 (per §B.1) and lift #33+#34 from Sprint 3 into Sprint 1 (per §B.3)? Yes/no.

**Block Sprint 2 start (must answer before Sprint 2):**

2. **Goal type for Persona C** (from UX §F.1) — annual-km goal supported alongside named-event goals, or named-event only? Architect §B.1 assumes annual-km is supported (`goal_type='annual_km'`). Confirm.

3. **Anthropic key fallback** (from UX §F.3) — system-paid Haiku for the forecast (per ADR-3) is the recommended call. Confirm the dual-tier model: forecast = system-paid; plan generator = BYOK.

4. **Migration 0003 backfill strategy** (from Architect open Qs) — one-shot wrangler-d1-execute backfill of `sex` + `country` for the existing user (Jose), or wait for the next sign-in to natural-backfill? Cheap either way; defaulting to "wait for next sign-in" unless flagged.

**Block Sprint 3 start:**

5. **Clubs expansion scoping** (from BA FB-7 + UX §F.2) — willing to commit ~1h to a clubs scoping session before Sprint 3 starts? Without it, the roster slice is the only ship-able sub-task.

6. **Komoot partnership** (from Architect open Qs) — willing to apply to Komoot's commercial program? Affects Phase 3 of ADR-1; not needed for Sprint 1-3 but blocks long-term route quality.

**Lower priority:**

7. **Club shared goal** (from UX §F.2) — collective goals for clubs in a future sprint, or never? Affects v9.5+ clubs roadmap, not this cycle.

---

## §F. Security Backlog Integration

The 2026-04-30 overnight audit produced 10 CRITICALs and 28 HIGHs. State as of v9.2.5:

| Severity | Total at audit | Closed | Remaining open | Path to zero |
|---|---|---|---|---|
| CRITICAL | 10 | 8 (#1, #6, #7, #8, #14, #35, #36, #37) | 2 (#33, #34) | **Sprint 1 (per §B.3)** |
| HIGH | 28 | 0 (all carryforward) | 28 | Sprint 3 batch + remainder bleeding into Sprint 4+ |

**Sprint 1 closes both remaining CRITICALs** — see ADR-3 in the audit's recommended priority order (closing CRITICALs before adding meaningful new feature surface). 1.5h cumulative cost.

**Sprint 3 takes 8 of the 28 HIGHs** — the audit's enumerated HIGH list (#38–#45). The unenumerated 20 HIGHs (the ones lost when an earlier audit run's `/tmp/` write was blocked) need a follow-up itemization pass. Recommended: dispatch a 30-minute audit-recovery pass in week 4 — cheap and unblocks visibility on the full HIGH backlog.

**Security audit cadence going forward:** every release-cut commit should include a check that no NEW CRITICALs landed (smoke against the audit's checklist). Sprint reviews should reference the audit's open count. Monthly: run a fresh security audit pass to catch new drift.

**Why security cannot be indefinitely deferred:** every shipped feature adds attack surface. Clubs MVP (#46-related work) added 4 endpoints, 1 route, 2 hooks. Without the v9.2.0 OAuth + /refresh hardening, multi-user clubs would have been exploitable via the documented CSRF vector (#14). The audit was the right call at the right time. Sprint 3's HIGH batch maintains that hygiene.

---

## §G. Total effort + go/no-go gate

**Total estimated effort across 3 sprints:** ~110-115h implementer + ~2h founder time (clubs scoping). Slightly under 40h × 3 = 120h budget. Buffer goes to: clubs scoping outcome expansion (Sprint 3), or rolling forward into Sprint 4 if any sprint slips.

**Go/no-go gate before Sprint 1 kickoff:**
- Founder answers questions §E.1–E.4 (4 yes/no items).
- Issue #48 closed with redirect to #51.
- This document committed to `docs/post-demo-sprint/`.
- Implementer (Claude or human) acknowledges the sprint plan.

**Out of scope of this planning cycle:** the v9.2.0 deferred items (Better Auth, email/password, Resend wiring, the wider Cadence Club brand pivot per the v2.0 redesign brief). Those remain backlog and will need their own planning cycle when prioritized.

---

## §H. Founder Decisions Log (2026-04-30)

All 7 questions from §E answered. Decisions locked.

| # | Question | Answer | Action taken |
|---|---|---|---|
| 1a | Fold #48 into #51? | **YES** | #48 closed with redirect comment to #51 |
| 1b | Lift #33 + #34 into Sprint 1? | **YES** | Added to Sprint 1 table; **must run BEFORE feature work** ("fix first, build second") |
| 2 | Annual-km goal for Persona C? | **YES** | Architect §B.1 ships as designed (`goal_type='annual_km'` in existing `goals` table) |
| 3 | Dual-tier Anthropic (system Haiku + BYOK Sonnet)? | **YES** | Cost model section added to SECURITY.md |
| 4 | Migration 0003 backfill strategy? | **B (natural)** | No one-shot script; persistUserAndTokens writes new columns on next sign-in |
| 5 | Clubs scoping session before Sprint 3? | **YES** | Calendar placeholder — exact date depends on Sprint 2 pace |
| 6 | Komoot partnership? | **NOT NOW** | Revisit after Sprint 3 stabilises route recommendation architecture |
| 7 | Club shared goals? | **YES future** | Schema doesn't block (existing `club_goals.goal_type`); no implementation until v9.5+ |

### Sprint 1 implementation order (founder directive: "Fix first, build second")

1. #33 `/coach` + `/coach-ride` auth gate (~1h)
2. #34 X-Forwarded-Host strip (~30min)
3. #51 Mobile 4-tab refactor (16-24h, with #48 folded in)
4. #47 Route Phase 1 — Strava saved routes (~6h)
5. Migration 0004 + filter persistence (~3h)
6. Smoke + e2e test updates (~3h)
7. Release-cut v9.3.0 (~1h)

The §C Sprint 1 table above is reordered to reflect this; the totals and DoD are unchanged.

*End of CTO Review.*
