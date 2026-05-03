# Sprint 3 — Backlog Review (16 open issues, post-Sprint-3 Phase 2)
**Author:** Combined BA + Architect review (single-document format adopted for hardening backlogs)
**Date:** 2026-04-30
**Inputs:** GitHub issue bodies (#3, #5, #8, #10, #11, #12, #16, #31, #32, #43–#45, #49, #50, #52, #53), Sprint 1/2/3 ship state, planning docs
**Product baseline:** v9.5.1 (live)

---

## Headline summary

- **0 issues recommended for CLOSE** — the backlog is healthy after Sprints 1-3
- 12 issues KEEP_OPEN_AS_IS, slotted to a sprint
- 1 issue DEFERRED_INTENTIONAL (#8 — open by design)
- 2 issues SCOPE_DOWN (#10 split iOS-vs-offline; #12 narrow to audit + a11y delta)
- 1 issue NEEDS_FOUNDER_DECISION (#32 domain registration)

Total open: stays at 16 (no automatic closes applied). Three founder questions surfaced below.

---

## Per-issue assessments

### #53 — Clubs: expand features beyond MVP (member roster + scoped backlog)
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 3 Phase 4
- **Effort estimate:** M (roster slice ~8h) + 1h scoping session
- **BA note:** Roster page (member list, join date, role badge) is the minimum viable Phase 4 deliverable; full expansion backlog is gated on the founder scoping session per acceptance criteria.
- **Architect note:** No new schema migrations needed for roster-only slice — `club_members` table already exists from clubs MVP; query + UI work only.
- **Justification:** Phase 4 in cto-plan.md; gated on founder scoping call. Roster slice is the concrete implementation unit; full expansion remains XL/deferred.

---

### #52 — Expand Edit Profile into full My Account page
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 4
- **Effort estimate:** M (4–16h including API key encryption spike)
- **BA note:** Corresponds to FB-6 in 01-business-requirements.md; "You" tab (shipped Sprint 1 via #51) provides the host shell — this issue fills it with real content.
- **Architect note:** AC-4 (Anthropic key in D1 vs Workers Secrets) must be resolved via ADR before coding; SC-2/SC-3 schema migrations are prerequisites.
- **Justification:** Sprint 4 per post-demo planning; blocked on AC-4 ADR and schema migration.

---

### #50 — Link annual goal to weekly training plan
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 4
- **Effort estimate:** M (4–16h)
- **BA note:** Corresponds to FB-4; stakeholder asked explicitly whether goal and weekly plan are linked — this is the answer. Must be done before or alongside #49 (FB-3 depends on the persisted goal field).
- **Architect note:** SC-1 (`annual_goal_km` column) is the shared schema change with #49; do once. IR-5 (verify goal is currently UI-only) is a ~1h spike needed before estimation firms up.
- **Justification:** Sprint 4 per post-demo planning; implement before #49 (dependency order in both issue body and BR doc).

---

### #49 — Replace static YTD goal bar with AI-powered year-end forecast
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 4
- **Effort estimate:** M (4–16h; AI refinement path adds overhead)
- **BA note:** Corresponds to FB-3; replaces the hardcoded 8,000 km bar with a real pace-based projection — high-visibility motivational feature for the next demo.
- **Architect note:** AC-2 (goal must be in D1 for server-side model to read) means #50 must ship first. IR-3 (AI latency/token cost spike for the refinement path) should be timeboxed before full implementation.
- **Justification:** Sprint 4 per post-demo planning; hard dependency on #50 landing first.

---

### #45 — AppFooter 3-col grid crashes to ~111px columns at 375px
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 3 Phase 3
- **Effort estimate:** XS (~10 min, pure CSS)
- **BA note:** Broken footer at iPhone Mini viewport is a visible regression on the primary mobile target; fix is cosmetic but the impact is immediate for any mobile visitor.
- **Architect note:** Single CSS file change (`AppFooter.module.css`), mobile-first grid reflow; no JS, no schema, no risk of regression beyond the footer.
- **Justification:** Phase 3 in cto-plan.md; bundled with #43 and #44 as CSS-only a11y/UI batch.

---

### #44 — 3 interactive buttons below 44px WCAG touch target
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 3 Phase 3
- **Effort estimate:** XS (~30 min, all CSS)
- **BA note:** WCAG minimum touch target failure affects motor-control users and general mobile usability; three specific components called out with exact measurements.
- **Architect note:** Three CSS file changes (`VolumeChart`, `ClubDashboard`, `RideFeedback`); `--hit-min` design token may need to be defined in `tokens.css` if not already present.
- **Justification:** Phase 3 in cto-plan.md; CSS-only, ~30 min, no risk.

---

### #43 — Missing :focus-visible rings on Button, BottomNav, inputs
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 3 Phase 3
- **Effort estimate:** S (~1h, all CSS)
- **BA note:** Keyboard-only users cannot track focus — WCAG 1.4.11 failure on BottomNav (color-only indication) is the highest-severity sub-point; affects accessibility compliance posture for any enterprise/Merkle demo context.
- **Architect note:** CSS token addition to `tokens.css` + targeted per-component overrides; migrating `:focus` to `:focus-visible` on inputs is a UX polish side-effect, not a breaking change.
- **Justification:** Phase 3 in cto-plan.md; largest of the three a11y items but still CSS-only, low risk.

---

### #32 — Migrate Cadence Club to cadenceclub.cc canonical domain
- **Status:** STILL_NEEDED
- **Recommended action:** NEEDS_FOUNDER_DECISION
- **Sprint slot:** n/a (pending decision)
- **Effort estimate:** S (2–4h once domain is live; DNS + wrangler config + Strava OAuth update + source refs)
- **BA note:** Domain ownership and registrar action are founder-gated — nothing can proceed until `cadenceclub.cc` is registered and DNS is pointed at Cloudflare. The Strava OAuth single-domain constraint makes this a one-shot coordinated deploy.
- **Architect note:** The Strava "Authorization Callback Domain" allows only one value; the cutover requires updating the Strava app dashboard, `wrangler.jsonc` routes, and two source references simultaneously to avoid an OAuth outage window. Plan a maintenance window.
- **Justification:** Blocked on founder registering the domain; no implementer action until that happens.

---

### #31 — Rate-limit malformed-secret safeWarn to prevent log flooding
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** No sprint slot
- **Effort estimate:** S (2–4h when triggered; KV-backed dedup is the likely choice)
- **BA note:** Issue body explicitly says "defer until observability shows recurring warns from same IP" — trigger condition has not been met in production yet.
- **Architect note:** Implementation is straightforward (in-memory TTL map or KV counter); deferring is correct per the issue's own stated trigger. No dependency on any Sprint 3/4 work.
- **Justification:** Keep open as a backlog item with its own activation criterion; no sprint slot until the production signal appears.

---

### #16 — Lock down CORS on /coach + /coach-ride
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 5+
- **Effort estimate:** S (2–4h including OPTIONS preflight + test)
- **BA note:** Security improvement — prevents cross-site API key exfiltration via /coach endpoints. Not blocking current demo or Sprint 3/4 feature work.
- **Architect note:** The CORS fix touches the same Worker pre-handler region as #41/#42 (shipped in Sprint 3 Phase 2); scheduling after Phase 2 confirmed stable avoids merge conflicts. Origin allowlist must include the new `cadenceclub.cc` domain once #32 ships.
- **Justification:** Dependency on #32 domain migration for the allowlist to be complete; Sprint 5+ after that stabilises.

---

### #12 — Lighthouse mobile ≥ 90 across all public routes
- **Status:** STILL_NEEDED
- **Recommended action:** SCOPE_DOWN
- **Sprint slot:** Sprint 3 Phase 3
- **Effort estimate:** S (1–2h for baseline audit + Phase 3 delta; full remediation is M)
- **BA note:** The Phase 3 a11y fixes (#43–#45) will improve the Accessibility score immediately; the full performance/SEO pass (bundle splitting, font preload, image dimensions) is separate and heavier.
- **Architect note:** Capture a before/after Lighthouse run during Phase 3 (already in cto-plan.md §C Phase 3); treat that as the Phase 3 deliverable. Remaining sub-points (Motion bundle split, font preload, image width/height) are Sprint 5+ unless score is below 85.
- **Justification:** Phase 3 delivers the audit + a11y-driven score lift; full remediation deferred unless the post-Phase-3 score is still failing. Remove the "bundle/fonts/images" sub-points from Phase 3 scope and leave them as backlog sub-items.

---

### #11 — Persist training prefs to D1 (Strangler-Fig)
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 5+
- **Effort estimate:** S (3–5h; endpoint + hook + dual-write + migration)
- **BA note:** User prefs currently lost on new device; D1 persistence closes that gap. Not blocking any Sprint 3/4 demo feature — low urgency but real user pain.
- **Architect note:** Pattern identical to the activities/tokens dual-write (already shipped); Worker endpoint + React hook change; `training_prefs` table already exists in schema.sql per issue body. Straightforward implementation once Sprint 4 features settle the schema.
- **Justification:** No dependencies from Sprint 3/4 — safe to defer to Sprint 5+ without blocking anything.

---

### #10 — iOS home-screen install + offline PMC tile
- **Status:** STILL_NEEDED
- **Recommended action:** SCOPE_DOWN
- **Sprint slot:** Sprint 5+
- **Effort estimate:** M (6–10h for full offline PMC; iOS validation alone is XS)
- **BA note:** iOS install validation (sub-point 1) is a QA/documentation task (~1h) and can be done any sprint; offline PMC tile (sub-point 2) is a meaningful feature requiring IndexedDB caching layer — heavier and independently valuable.
- **Architect note:** Split the two sub-points: iOS validation (confirm standalone mode, document in CONTRIBUTING) is a quick win any sprint; offline PMC requires a service worker caching strategy for `/api/athlete` and `/api/athlete/activities` payloads that touches the existing service worker registration.
- **Justification:** Sub-point 1 (iOS validation) can be done cheaply alongside any release; sub-point 2 (offline PMC) is a standalone feature for Sprint 5+. Narrow issue to offline PMC only; iOS validation handled as a release checklist item.

---

### #8 — Retroactive TSS backfill from strava_raw_json
- **Status:** DEFERRED_INTENTIONAL
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** No sprint slot
- **Effort estimate:** S (2–3h once FTP is confirmed set)
- **BA note:** Issue has an existing status comment (11/11 nulls in D1); the block is data (FTP not yet set by the user), not code.
- **Architect note:** Schema v2 is applied; the Worker backfill endpoint pattern is documented. Execution is blocked on user setting FTP — once set, this is a one-shot admin operation per issue body (run-and-remove pattern).
- **Justification:** Open by design per provided ship state; leave alone until FTP is populated.

---

### #5 — Show distance + elevation numbers per bucket in Volume chart
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 4
- **Effort estimate:** S (3–5h; inline SVG labels + tooltip, no new library)
- **BA note:** Users want full numeric breakdown (km + m + ride count + TSS) per bar; the hover/tap tooltip requirement is the interaction-design unit that needs most attention for mobile tap accuracy.
- **Architect note:** Inline SVG + Motion approach (per issue body constraint) is consistent with existing Volume chart implementation; TSS per bucket requires aggregating the `daily_load` data that #8's backfill will populate — ordering matters if real TSS is desired.
- **Justification:** Sprint 4 after TSS backfill (#8) runs, so the tooltip TSS values are real; can ship with duration-proxy TSS if #8 hasn't run yet (clearly labelled per issue body pattern).

---

### #3 — Remove "Revoke access" from public footer
- **Status:** STILL_NEEDED
- **Recommended action:** KEEP_OPEN_AS_IS
- **Sprint slot:** Sprint 3 Phase 3
- **Effort estimate:** XS (~15 min; remove one footer link, optionally replace with /version)
- **BA note:** "Revoke access" in the marketing footer confuses anonymous visitors and exposes an auth-specific action to unauthenticated users; the fix is cosmetic and unambiguous.
- **Architect note:** Single component change (Landing/WhatsNext footer); the UserMenu already has the revoke link for authenticated users, so no auth flow is regressed. Slot alongside the Phase 3 CSS batch for one clean release.
- **Justification:** Phase 3 is CSS + polish work; this trivial cleanup fits naturally and avoids a dedicated release for a 15-minute change.

---

## Recommended close batch

| Issue | Close reason | state_reason |
|---|---|---|
| — | No issues meet the CLOSE threshold — all 16 are either still needed, deferred by design, or pending a founder decision. | — |

> Note: Issues #38, #39, #40, #6, #15, #41, #42, #33, #34, #14, #36, #37, #35, #46, #47, #48, #51 (Sprint 1–3 Phases 1–2) are already closed per the provided ship state and do not appear in this review.

---

## Open questions for founder

- **#32 domain migration:** Has `cadenceclub.cc` been registered? If yes, when is the Strava OAuth cutover window? If not, is this still the chosen canonical domain or has the name changed?
- **#12 Lighthouse remediation threshold:** After Phase 3 a11y fixes ship, if the Lighthouse mobile Performance score is between 85–89 (not quite ≥ 90), should we treat that as "close enough for Sprint 4 demo" or pull forward the bundle/font/image work into Sprint 4?
- **#10 offline PMC split:** Confirm splitting #10 into (a) iOS validation checklist item and (b) offline PMC feature. If yes, the issue body should be narrowed to offline PMC only — or two separate issues created.
