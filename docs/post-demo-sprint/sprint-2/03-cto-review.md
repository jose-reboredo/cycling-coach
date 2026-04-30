# CTO Review — Sprint 2
**Author:** CTO Review (Opus, judgment-heavy synthesis)
**Date:** 2026-04-30
**Inputs:** `sprint-2/01-business-requirements.md`, `sprint-2/02-architecture-changes.md`, `docs/retros/sprint-1.md`, `docs/post-demo-sprint/03-architecture-changes.md` (Sprint 1 carry-forward specs)
**Issues addressed:** FB-R1, FB-R2 (regressions) + #50, #49, #52 (Sprint 1 carry-forward features)
**Product baseline:** v9.3.4 (currently live)

---

## §A. Risk Assessment

| Item | Issue | Technical | Dependency | Timeline | Notes |
|---|---|---|---|---|---|
| FB-R1 — `postJson()` Strava bearer fix | regression | **LOW** | LOW | LOW | One function in `coachApi.ts`, mirrors existing `invalidKey` error-branch pattern with parallel `stravaExpired`. Architect spec §A is concrete. ~3h. |
| FB-R2 — You-tab "Get a key →" link restore | regression | LOW | LOW | LOW | Copy + 4 lines CSS. ~1h. |
| #50 — annual goal data model + planning | feature | LOW | LOW | LOW | Reuses existing `goals` table, single new endpoint (`PUT /api/goals/annual`). Sprint 1 arch §C.6 fully spec'd. |
| #49 — AI year-end forecast | feature | LOW-MED | **MED** | MED | Depends on #50's data model. System-paid Haiku via `SYSTEM_ANTHROPIC_KEY` (already set in v9.3.1 for `/api/routes/discover`). KV cache pattern reuses `DOCS_KV` infra. ~12h. |
| #52 — You-tab profile expansion | feature | MED | LOW | MED | Migration 0003 (additive, NULL defaults). Legacy-parity audit required pre-merge per Sprint 1 retro rule #1 — FB-R2 was exactly the kind of silent component-migration drop that audit catches. ~18h. |
| Total | — | — | — | — | **~42h** within ~40h budget; 2h overrun acceptable, trim by deferring polish if needed. |

---

## §B. Decision points (founder approval required)

### B.1 ADR-S2.1 — Keep #33 bearer gate; fix in frontend (recommended)

**The user proposed**: revert #33's `/coach` + `/coach-ride` bearer gate to unblock the BYOK flow.

**Recommendation: do NOT revert. Fix in frontend instead.**

| Option | Cost | Re-introduces |
|---|---|---|
| **A. Revert #33** (remove bearer gate) | 0h | CRITICAL open-Anthropic-proxy. Anyone on the internet can POST a leaked `api_key` to `/coach` and burn the owning user's Claude credits. Audit-flagged 2026-04-30. |
| **B. Frontend fix** (postJson sends bearer) — recommended | ~3h | Nothing. Bearer gate stays; the actual UX bug (frontend never sent the bearer) gets fixed. |

The "auth error" the user is seeing is **not** caused by the gate being too strict — it's caused by `coachApi.ts` never having sent credentials at all. v9.3.0 added the gate but the frontend code path that reaches `/coach` was never updated to attach the Strava bearer. Option B fixes the actual bug.

**Founder approval needed**: confirm Option B (frontend fix, gate stays). If you still want Option A, we'd be choosing UX over a CRITICAL — I'll respect the call but want it on record.

### B.2 ADR-S2.2 — Carry Sprint 1 specs verbatim for #49/#50/#52

The Sprint 1 architect doc (`03-architecture-changes.md`) already specifies #49/#50/#52 fully (§B.1, §B.2, §C.1, §C.4, §C.5, §C.6, §B-SQL). The Sprint 2 architect doc (`02-architecture-changes.md`) references these by section without re-writing. **No re-spec.**

Saves ~4h of duplicate specification work. Minor risk: if a Sprint 1 spec assumption no longer holds, we'd discover it during implementation. Mitigation: spec each feature is reviewed against current code before implementation begins (~30min per feature).

**Founder approval needed**: confirm carry-forward (no re-spec).

### B.3 ADR-S2.3 — Apply Sprint 1 retro rules from day one

The persistent memory now contains 3 process rules from Sprint 1's hotfix cascade:

1. **Pre-deploy verification** — legacy-parity audit + smoke-what-changed
2. **`git log -20` before any destructive op** — hard rule
3. **Pre-coding scope alignment** — user walkthrough for spec-driven UI; phase-shifts ship as separate releases

Sprint 2 work plan applies all three:

- Before merging #52 (You-tab expansion): legacy-parity audit comparing `Dashboard.tsx`'s profile-edit flow against the new You-tab. **Architect already added this callout in §C.4 of `02-architecture-changes.md`.**
- Mobile-viewport Playwright spec (carry-over backlog from Sprint 1 retro improvement #2) lands as the FIRST commit of Sprint 2 — gates every Sprint 2 deploy.
- Each release = one risk theme (per retro rule #6). Regressions in v9.3.5; #50+#49 in v9.4.0; #52 in v9.4.1. Three deploys, three smoke surfaces.

**Founder approval needed**: confirm 3-deploy phasing (vs single bundled v9.4.0 with everything).

---

## §C. Sprint Plan (3 phases, ~42h total)

### Phase 1 — Regression hotfix (v9.3.5)

**Goal:** unblock BYOK users immediately. Restore Persona C's path to an Anthropic key. Two regressions, both frontend-only, ~5h.

| Item | Issue | Effort | Owner |
|---|---|---|---|
| **(prereq)** Mobile-viewport Playwright spec — `tests/mobile-tabs.spec.ts` per Sprint 1 retro | — | 1h | implementer |
| FB-R1 — `postJson` bearer + `CoachError.stravaExpired` + caller branches + Vitest unit | regression | 3h | implementer |
| FB-R2 — You-tab hint copy + link + 4 lines CSS | regression | 1h | implementer |
| Release-cut + deploy v9.3.5 | — | 0.5h | implementer |

**Definition of Done:** v9.3.5 deployed; clicking "Generate plan" with valid Anthropic key + valid Strava session returns a plan (not a 401); You-tab API key form (when no key set) shows the "Get a key →" link to console.anthropic.com; mobile-viewport spec passes against prod.

**Estimated:** ~5.5h.

### Phase 2 — Annual goal + AI forecast (v9.4.0)

**Goal:** annual goal first-class; year-end forecast replaces static 8000 km bar.

| Item | Issue | Effort | Owner |
|---|---|---|---|
| `PUT /api/goals/annual` per Sprint 1 arch §C.6 + frontend goal-set UI | #50 | 8h | implementer |
| `GET /api/forecast` per Sprint 1 arch §C.1 + Haiku call + KV cache + frontend ring | #49 | 12h | implementer |
| Tests (forecast endpoint, goal annual type) | — | 2h | implementer |
| Release-cut + deploy v9.4.0 | — | 0.5h | implementer |

**Definition of Done:** v9.4.0 deployed; goal drives weekly plan with phase labels (Base/Build/Peak/Taper); forecast card replaces static "8000 km" bar; mobile-viewport spec stays green.

**Estimated:** ~22.5h.

### Phase 3 — You-tab profile expansion (v9.4.1)

**Goal:** complete BYOK personalization; full profile fields for Persona A.

| Item | Issue | Effort | Owner |
|---|---|---|---|
| **Legacy-parity audit** — diff Dashboard.tsx profile-edit flow vs You-tab content; document gaps | — | 1h | implementer |
| Migration 0003 (`users.sex`, `users.country`) + schema.sql + db/README.md sync; apply to remote D1 | — | 1.5h | implementer |
| You-tab profile fields — name, DoB, gender, city/country (per Sprint 1 arch §B.2 + §C.4) | #52 | 14h | implementer |
| Tests (profile field roundtrip, validation) | — | 1.5h | implementer |
| Release-cut + deploy v9.4.1 | — | 0.5h | implementer |

**Definition of Done:** v9.4.1 deployed; You tab shows the 7 profile sections from Sprint 1 UX §E; Migration 0003 columns visible in remote D1 via `PRAGMA table_info`; legacy parity audit passed.

**Estimated:** ~18.5h.

### Sprint 2 totals

- Effort: **~46h** (5.5 + 22.5 + 18.5; 4h over architect's ~42h estimate, accounting for the new mobile-viewport spec and the legacy-parity audit step)
- Releases: 3 (v9.3.5, v9.4.0, v9.4.1)
- Migrations: 1 (0003)
- New endpoints: 2 (`PUT /api/goals/annual`, `GET /api/forecast`)
- New worker secrets: none (`SYSTEM_ANTHROPIC_KEY` already set)

---

## §D. Out of scope (deferred)

- HIGH-severity audit batch `#38–#45` — Sprint 3 (per CTO review §C of Sprint 1)
- `#53` clubs expansion — Sprint 3 (founder scoping session pre-required)
- `#47` Phase 2 narrative briefs polish (already shipped in v9.3.1; future quality work tracked separately)
- `#47` Phase 3 — Komoot partnership (deferred indefinitely, revisit after Sprint 3)

---

## §E. Founder approval gate

Before any code is written, please confirm:

1. **ADR-S2.1** — Keep #33 bearer gate; fix in frontend (Option B, ~3h). Reverting (Option A) re-opens the audit-flagged CRITICAL. **[Recommended: Option B]**
2. **ADR-S2.2** — Carry Sprint 1 architect specs verbatim for #49/#50/#52 (no re-spec). **[Recommended: yes]**
3. **ADR-S2.3** — 3-deploy phasing (v9.3.5 regressions → v9.4.0 features → v9.4.1 profile) per Sprint 1 retro "one risk theme per release" rule. **[Recommended: yes — clean smoke surface per release]**
4. Sprint 2 effort estimate ~46h is acceptable. **[Recommended: yes]**
5. Phase 1 lands the **mobile-viewport Playwright spec** as the FIRST commit before any feature work — gates the rest of Sprint 2. **[Recommended: yes — directly addresses Sprint 1's biggest miss]**

If any of these need adjustment, flag now. If approved as-is, Phase 1 (v9.3.5 regression hotfix) can begin immediately.

---

*End of CTO Review.*
