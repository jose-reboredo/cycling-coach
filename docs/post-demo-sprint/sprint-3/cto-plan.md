# CTO Plan — Sprint 3
**Author:** CTO (Opus, single-doc synthesis — no BA/Architect dispatch this sprint, per founder cost-optimization directive)
**Date:** 2026-04-30
**Inputs:** GitHub issue bodies (`#38–#45`, `#15`, `#6`, `#8`, `#53`); `docs/retros/sprint-1.md`; `docs/post-demo-sprint/sprint-2/` for Sprint 2 retro context (none — Sprint 2 went clean)
**Product baseline:** v9.3.5 (live, validated by founder)

---

## Headline

Sprint 3 is **hardening + accessibility + clubs scoping** — no novel features. The 8 audit HIGHs (`#38–#45`) plus `#15` (security headers) cover backend stability, security hardening, and accessibility. `#53` (clubs expansion) is its own track, founder-gated on a scoping session. `#6` and `#8` are older HIGHs that need verification — likely stale post Sprint 1/2.

Why no BA/Architect: every issue body has its own user story + acceptance criteria + recommended fix already. Re-writing them as BA stories is paraphrase work; re-specifying as Architect plans is paraphrase squared. CTO-only synthesis is the right shape for hardening backlogs (~5% budget vs ~25% for full BA→Architect→CTO).

---

## §A. Risk + scope (theme-grouped)

| Phase | Theme | Issues | Effort | Risk | Why batched |
|---|---|---|---|---|---|
| **1** | Stability + correctness | `#38`, `#39`, `#40` | ~5h | LOW | Three small frontend bugs, no schema/API touch. Single mobile-tabs CI gate covers them all. |
| **2** | Security hardening | `#41`, `#42`, `#15` | ~10h | MED | Worker-side changes; method allowlist + rate-limit + headers. Touch the same `worker.js` pre-handler region — bundle for review economy. Each gets its own Vitest unit. |
| **3** | Accessibility + UI polish | `#43`, `#44`, `#45` | ~5h | LOW | CSS-only changes. Lighthouse mobile score should jump after this batch. |
| **4** | Clubs scoping + roster | `#53` | ~10h (1h founder + 9h impl) | UNKNOWN scope | Gated on founder scoping session. Roster slice (~8h) is the only known sub-task; full expansion size set during scoping. |

**Total:** ~30h (within ~40h budget). Phase 4's effort estimate firms up after the scoping call.

---

## §B. Decisions for founder

### B.1 ADR-S3.1 — 4-phase release plan (vs single bundled v9.5.0)

Per Sprint 1 retro rule #6 (one risk theme per release):

- **v9.5.0** — Phase 1 stability fixes
- **v9.5.1** — Phase 2 security hardening
- **v9.5.2** — Phase 3 accessibility + UI polish
- **v9.6.0** — Phase 4 clubs (after scoping; minor-version bump because it adds a feature surface)

Each release runs the mobile-tabs CI gate from Sprint 2 + smoke-what-changed targeted to its theme.

**Recommendation: yes, 4 phases.** Hardening + accessibility are independent — each ships when ready, no cross-phase dependencies.

### B.2 ADR-S3.2 — Verify-or-close `#6` and `#8` upfront

`#6` (suggested routes broken) was largely addressed by `#47` Phase 1+2 in v9.3.1 (Strava saved routes + AI discover endpoint). Need to verify whether the residual sub-points (route_briefs in coach output, score weights) are still relevant or superseded.

`#8` (retroactive TSS backfill) depends on FTP being set + schema v2 applied. Both shipped in v9.0.x. Likely stale — needs ~30min check.

**Recommendation: 1h housekeeping in Phase 1 to triage both. Either close-as-superseded or scope-down to the residual gap.** Keeps the "open priority:high" count honest.

### B.3 ADR-S3.3 — `#42` rate-limit scope

`#42` flags missing rate-limits on `/coach`, `/coach-ride`, `/api/clubs*`. Sprint 1 already shipped per-athlete rate-limits on `/coach` (20/min) and `/coach-ride` (60/min) via `checkRateLimit` helper. v9.3.1 added `/api/routes/discover` (10/h). **Remaining gap is `/api/clubs*` writes** (POST clubs, POST events, POST join).

**Recommendation: scope `#42` to clubs writes only, add 30/min rate-limit per athlete using the existing helper. ~1h work; the rest of `#42` is already shipped.**

### B.4 ADR-S3.4 — `#41` method allowlist strategy

Two options for the generic `/api/*` Strava proxy:

| Option | Behavior | Risk |
|---|---|---|
| **A. GET-only allowlist** | Only forward GET; reject everything else with 405. | Breaks any future write-path proxy use. Strava write scopes need POST anyway. |
| **B. Per-path allowlist** | GET, POST allowed; DELETE/PUT/PATCH blocked. Document the GET/POST surface. | Keeps door open for future writes; explicit deny on destructive verbs. |

**Recommendation: Option B.** Cycling-coach today only ever GETs from Strava. POST capability isn't actively used but has been in the past (token refresh hits a different endpoint). Blocking DELETE/PUT/PATCH closes the audit footgun without locking us out of legit POSTs later.

### B.5 ADR-S3.5 — Phase 4 clubs scoping pre-requisite

`#53`'s acceptance requires "Stakeholder provides a prioritised feature list before full implementation begins." That's a calendar-blocked founder commitment, not implementer work.

**Recommendation: book a 1h founder + implementer scoping session before Phase 4 starts. If the session doesn't happen by mid-Sprint, push Phase 4 to Sprint 4 — don't block Phases 1-3 on it.**

---

## §C. Sprint plan (compact)

### Phase 1 — Stability + correctness (v9.5.0, ~6h)

| Item | Effort | Notes |
|---|---|---|
| `#38` move `clearTokens()` to `useEffect` so Strict Mode double-render doesn't wipe valid tokens | 1.5h | useStravaData.ts |
| `#39` wrap `writeTokens`/`clearTokens` in try/catch (Safari private mode) | 0.5h | auth.ts |
| `#40` replace unchecked `as CoachError` casts with type-guard (`err instanceof CoachError`) | 1h | useAiReport.ts, useRideFeedback.ts. The `stravaExpired` flag from Sprint 2 only fires for our own throws — network TypeErrors still need the guard. |
| `#6` + `#8` triage (close-as-superseded or scope-down) | 1h | Document outcome in issue comments. |
| Mobile-tabs CI gate run + smoke (per Sprint 1 retro rule #2) + release-cut | 1.5h |

### Phase 2 — Security hardening (v9.5.1, ~10h)

| Item | Effort | Notes |
|---|---|---|
| `#41` allow GET+POST only on `/api/*` proxy; 405 on DELETE/PUT/PATCH | 1.5h | worker.js |
| `#42` per-athlete 30/min rate-limit on `/api/clubs*` POST endpoints (reuse `checkRateLimit`) | 1.5h | worker.js |
| `#15` `securityHeaders()` helper applied to all Worker responses (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | 4h | worker.js + assets `_headers` for static. CSP starts permissive, tighten later. |
| Vitest units for each (worker mock harness — see existing /coach test pattern) | 2h |
| Smoke + release-cut | 1h |

### Phase 3 — Accessibility + UI polish (v9.5.2, ~5h)

| Item | Effort | Notes |
|---|---|---|
| `#43` `:focus-visible` ring tokens added to `tokens.css`; applied to Button, BottomNav, inputs | 2h |
| `#44` `min-height: var(--hit-min)` on `.toggleBtn`, `.tab`, `.askBtn` | 0.5h |
| `#45` AppFooter mobile-first grid (1fr → 3 cols at 600px+) | 0.5h |
| Lighthouse mobile audit before/after (capture in CHANGELOG) | 1h |
| Smoke + release-cut | 1h |

### Phase 4 — Clubs scoping + roster (v9.6.0, ~10h, gated)

| Item | Effort | Owner |
|---|---|---|
| Founder scoping session — prioritised feature list, signed-off backlog at `docs/post-demo-sprint/club-features-backlog.md` | 1h founder + 1h impl notes | founder + implementer |
| Member roster page slice (list members, join date, role badge) | ~8h | implementer |
| Release-cut + deploy v9.6.0 | 1h |

---

## §D. Founder approval gate

Before Phase 1 starts, please confirm:

1. **ADR-S3.1** — 4-phase release plan as above. **[Recommended: yes]**
2. **ADR-S3.2** — `#6` and `#8` get a 1h triage in Phase 1 (close as superseded if appropriate). **[Recommended: yes]**
3. **ADR-S3.3** — `#42` scope reduced to `/api/clubs*` writes only (rest already shipped Sprint 1). **[Recommended: yes]**
4. **ADR-S3.4** — Method allowlist on `/api/*` is Option B (GET+POST only, deny DELETE/PUT/PATCH). **[Recommended: Option B]**
5. **ADR-S3.5** — Book the clubs scoping session. **What's a good time?** If not in Sprint 3 window, Phase 4 slips to Sprint 4 and Sprint 3 closes after Phase 3.

Sprint 3 effort: ~21h Phases 1-3 + ~10h Phase 4 = **~31h within ~40h budget**.

---

*End of CTO Plan.*
