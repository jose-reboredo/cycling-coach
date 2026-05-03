# Sprint 13 — CTO Review

**Reviewed:** 2026-05-03 (sprint open + close on the same day; two-release shape executed in a single push)
**Releases shipped:** 2 (v11.1.0 credentials substrate · v11.2.0 My Account UI + #5 + copy sweep + housekeeping)
**Reviewer:** CTO + Architect synthesis with the product lead. Brainstorm consultation across Architect / Security / Strategy on Opus at sprint open. Founder approval gates respected at both release cuts.

> Sprint 13 is the user-value sprint. v11.1.0 ships the credentials substrate (passphrase-derived AES-GCM, multi-provider table, recovery flow); v11.2.0 ships the `/dashboard/you` rebuild (5-section My Account page consuming the substrate + Sprint 12 design system end-to-end), VolumeChart per-bucket numbers (#5), and the cyclist-friendly copy sweep that absorbed founder feedback mid-sprint. Two stale GitHub issues closed (#79 shipped in v9.12.2; #80 shipped in v10.12.0). 258 → 308 tests passing (+50 net across both releases). No schema, endpoint, or behavior regressions on existing in-app surfaces.

## What worked

1. **Three-role Opus consultation at sprint open landed the architecturally-correct call.** Architect picked option B (encrypted-in-D1 with Workers Secret), Security picked option A (browser-only), Strategy picked option C (passphrase-derived). Founder picked C — the only option that keeps cross-device sync **and** the BYOK property (Worker compromise leaks ciphertext, not master keys). Without the brainstorm consultation, the default would have been option B (canonical CF pattern) — the right *technical* answer for a different architecture, the wrong *strategic* answer for this product. **Pattern to repeat: every architecture-locking decision gets a 3-role role-prompted consultation, not just Architect alone.**

2. **Two-release shape held.** v11.1.0 = secrets handling; v11.2.0 = profile UI. Each ≤ 1 risk theme per `feedback_pre-coding-scope-alignment.md`. Substrate shipped, was used by the next release. Smooth — no scope bleed.

3. **TDD discipline on every new module.** `credentials.test.ts` (8 tests) → `credentials.ts` lib. `validation.test.ts` (11 tests) → `validation.ts` module. Red → green → commit on each. Both modules shipped first try, no rework. Static-scan contract tests (`credentials-contract.test.ts` 10 / `profile-contract.test.ts` 6) shipped in the same commits as the modules they protect — locks the regression class on every future change.

4. **Additive migration discipline (memory rule re-validated).** Three schema migrations (0014 user_credentials / 0015 recovery meta / 0016 profile fields) all additive — zero existing rows touched, all new columns nullable. The v11.1.0 migration banner added users to the new substrate at *their* pace; existing localStorage `useApiKey` flow stayed valid throughout. v11.2.0 page rebuild preserved every Strava + RWGPS + AI Coach behavior. Founder verified at v11.1.0 deploy; no regressions found in the v11.2.0 audit.

5. **Mid-sprint scope addition handled without panic.** Founder feedback after v11.1.0 ship: "users don't know what passphrase is." Absorbed as Task 7.5 (cyclist-friendly copy sweep), folded into v11.2.0 with a locked vocabulary table (AC-1.2.11) and 15 specific before/after string changes. The substrate shipped first with the technically-correct vocabulary; v11.2.0 swept it. No rework on the substrate itself — only rendered HTML changed.

6. **Static-scan contract test pattern paid for itself again.** Sprint 11's `worker-cache-contract.test.ts` enforces a deliberate inventory of every `/api/` GET endpoint. Adding `/api/me/credentials` (v11.1.0) and `/api/me/profile` (v11.2.0) each fired the test — forced explicit inventory updates, prevented silent entry-filter bypass. Locked-in.

7. **First in-app surface adopts the v11.0.0 design system end-to-end.** `/dashboard/you` rebuild consumes Card / Eyebrow / Button / EmptyState exclusively, token-only CSS, no hex literals. Var-resolution scan from Sprint 12 picks the new `dashboard.you.module.css` up automatically and confirms zero violations. Early signal for Sprint 14+ in-app token migration: the pattern works.

8. **Working-skills repo (cross-project source-of-truth) verified in sync mid-sprint.** Founder asked at v11.1.0 close: "before start check if latest changes done in working-skills are applying." Local `/Users/josereboredo/claude-skills/` matched origin/main 0/0 ahead/behind; symlink at `~/.claude/skills/josemreboredo-orchestrator` resolves to the live repo; recent upstream commits (13th role, economy.md doctrine, mine/references split) are auto-propagated to every project. **Pattern to keep: surface the symlink / sync state explicitly when the founder flags it; the propagation works by design but the verification step makes it auditable.**

9. **Two stale GitHub issues honestly closed.** #79 (5-sub-item polish bundle) — confirmed shipped in v9.12.2 by code inspection during Sprint 13 brainstorming; closed with sub-item-by-sub-item evidence. #80 (calendar misalignment) — confirmed shipped in v10.12.0 by `// v10.12.0 (GH #80)` marker in WeekCalendarGrid.tsx + DayCalendarGrid.tsx; closed with code-pointer evidence. Roadmap reflected the cleanup: 13 → 10 open, 63 → 66 shipped on the live `/whats-next` page.

## What regressed

1. **The v11.1.0 substrate UX shipped with developer vocabulary** (passphrase / encrypt / recovery code). Caught by founder feedback within minutes of deploy: *"users don't know what Passphrase is, every user faced need to be not technical."* Absorbed as Task 7.5 in v11.2.0 — vocabulary swept across 4 surfaces / 15 strings within hours. **Lesson:** the brainstorm + architect/security consultations did the architectural work but **none of the three roles consulted are user-facing copy specialists.** The Experience Designer / Brand Designer roles in the orchestrator should have been engaged for any user-visible surface — even a "substrate-only" release that ships a setup modal + recovery page is, in fact, user-visible. The next time we ship "substrate" with any UI, XD/BD must consult before the v1 ship, not after.

2. **The PassphraseUnlockCard component was wired into v11.1.0 but isn't yet hosting the daily-use unlock flow on `/dashboard/you`.** v11.1.0's MigrationBanner triggers the SetupPassphraseModal (one-time setup); v11.2.0's My Account page shows substrate state (encrypted on this device) but doesn't yet host the per-session passphrase entry. Daily AI use still goes through the legacy `useApiKey` path until the AI Coach card on Today / Train surfaces are refreshed. **Acceptable trade for the 2-day shape**, but the Sprint 14+ AI Coach card refresh has a tighter dependency than I originally scoped.

3. **Subagent-driven workflow hit an org-level monthly token limit mid-Sprint-13.** Spec compliance + code quality reviews via the `superpowers:code-reviewer` agent worked beautifully for v11.1.0 Tasks 1–5, then the limit fired. Switched cleanly to inline review for the remaining tasks (controller does the spec + quality verification itself). Same discipline, no skipped checks. **Lesson:** subagent-driven flow is cost-sensitive; for sprints with 10+ tasks, plan the cost ceiling upfront. The `feedback_economy-model.md` rule applies here too — Sonnet for mechanical implementation, reserve Opus for the ADR + code-quality-review on the security-sensitive surfaces.

4. **`account.recover.tsx` uses inline styles** (not a `module.css`). Page-level layout is one-off; defensible for a single-route, but the design-system contract scan won't enforce hex-literal discipline on inline styles. **Tracked**: when the route gets a second iteration (e.g. UX polish in Sprint 14+), extract to `account.recover.module.css` and bring it under the var-resolution scan.

## What we learned

- **Architecture decisions touching user trust deserve a Strategy role, not just an Architect.** The Architect's option B was technically correct (canonical CF pattern). The Security role's option A was privacy-correct (zero server-side ciphertext). Strategy's option C beat both because the question "can we keep the BYOK voice while gaining cross-device sync?" is a positioning question, not a tooling question. **Filing as a memory rule.**
- **"Substrate-only" is rarely actually substrate-only.** v11.1.0 was scoped as "no user-visible UI changes" and yet shipped a 3-step modal, a recovery page, a migration banner, and a `.txt` download with branded body text. Every one of those surfaces had user-facing copy that should have gone through XD/BD consult before ship. The vocabulary patch was cheap because it was caught immediately; the next time, slot XD into the Phase 4 implementation review for any release that touches a UI string. **Filing as a memory rule.**
- **The orchestrator's Phase 5 audit doc shape is reusable per-release inside a multi-release sprint.** Sprint 12 introduced the audit doc as a single per-sprint artefact. Sprint 13 ran it twice (v11.1.0 audit + v11.2.0 audit appended to the same file). Worked cleanly — single doc per sprint, multiple sections per release, single source-of-truth for "what we verified before each cut." **Pattern to keep.**
- **Cross-project working-skills sync is a Phase 0 verification step.** When the founder asks "are the latest changes applying?" the answer is "the symlink resolves correctly + origin/main is 0/0 ahead/behind" — three commands' worth of evidence. Surface this proactively at sprint open if the working-skills repo had recent commits.

## Tech debt accrued

- **PassphraseUnlockCard daily-use wiring** — Sprint 14+ candidate. The AI Coach card on Today / Train surfaces still uses the legacy `useApiKey` path. The substrate is ready; the consumer UI isn't.
- **`account.recover.tsx` inline styles** — extract to a `module.css` when the route gets its next iteration (better a11y, hex-literal lock, design-system parity).
- **`managed: 1` Pro-tier server-side managed-key plumbing** — schema column + GET-response branch ship ready. Billing relay (Anthropic API key on Cadence Club's account) + Stripe webhook are a future feature, not a future sprint baseline.
- **Multi-provider UI** — the `(athlete_id, provider)` PK supports it. The surface for adding OpenAI / local-Llama is a future-sprint feature.
- **Argon2id rotation** — when the WASM bundle cost falls or threat model demands it. `kdf_iterations` column allows clean rotation. Backlog ADR.
- **`useAthleteProfile` localStorage hook** — was fine for v9.x but now duplicates state with the v11.2.0 server-backed profile API. Should be unified or deprecated in Sprint 14.
- **`OnboardingModal`** — still consumes `useAthleteProfile`. When that hook is unified or replaced, OnboardingModal needs updating to PATCH `/api/me/profile` directly.

## Process notes

- **Per-interaction role selection** worked exactly as the orchestrator describes. Sprint 13 engaged Architect + Security + Strategy at sprint open for the credentials-storage decision — three roles, three independent perspectives, founder picked. Discovery + Scoping for v11.1.0 substrate was Architect + Tech Lead. Implementation was Tech Lead with QE on the contract tests. v11.2.0 added XD/A11y for the page rebuild + the post-ship copy sweep was XD + founder feedback loop. Per-role engagement matched per-task complexity; no overhead.
- **Two-release single-sprint shape is repeatable.** Sprint 13 totalled ~23h across two days, two release commits, two parity audits (in one doc), one retrospective. Cleaner deployment story (each release ≤ 1 risk theme) than a single big v11.0.0-style release would have given. **Recommend: when a sprint shape calls for substrate + consumer, ship them as separate releases on consecutive days, not as one combined release.**
- **Founder feedback within hours of deploy is the fastest possible regression-detection loop.** v11.1.0 shipped at ~17:30; the "users don't know what passphrase is" feedback came at the next interaction; v11.2.0 absorbed the fix the same evening. The pre-deploy parity audit didn't catch it (audit confirmed substrate correctness, not copy fluency), and that's expected — the audit's risk surface is regressions, not voice. **Voice-correctness is an XD/BD review category, not a Phase 5 audit category. Slot it earlier.**
- **The 4-doc sprint shape (00-summary + 01-business-requirements + 02-architecture-changes + 03-cto-review) + 04-phase-5-parity-audit per release** is now a 5-doc shape for any multi-release sprint. Worked cleanly here. Locked into the sprint template as the standard.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-coding-scope-alignment.md` | **Re-validated** — two releases ≤ 1 risk theme each held cleanly across a single sprint |
| `feedback_additive-foundation-migrations.md` | **Re-validated** — three additive migrations (0014/0015/0016) shipped without touching existing rows; the localStorage → encrypted migration was opt-in via banner |
| `feedback_static-scan-contracts.md` | **Re-validated** — credentials-contract (10) + profile-contract (6) shipped in the same commits as the modules they protect; both fired exactly once mid-sprint when new endpoints were added without inventory updates |
| `feedback_pre-deploy-verification.md` | **Re-validated** — Phase 5 audits run per release, not per sprint; one combined doc with two release sections |
| `feedback_release-readme-sweep.md` | **Re-validated** — README's Routes + Components + Recent releases swept on each release commit |
| `feedback_release-ceremony.md` | **Re-validated** — founder approval gate respected before each deploy; no autonomous deploys |
| `feedback_economy-model.md` | **Re-validated + extended** — Opus for the brainstorm consultation + ADR; Sonnet for the implementation work; subagent-driven flow hit a token ceiling and we adapted to inline review without skipping the discipline |
| `feedback_sprint-documentation-mandatory.md` | **Re-validated + extended** — 4-doc shape becomes 5-doc shape (00–04) for any multi-release sprint |
| **NEW: `feedback_three-role-architecture-consultation.md`** | **To file** — for any architecture decision that touches user trust or product positioning, engage Architect + Security + Strategy on Opus in parallel; the three independent perspectives surface the strategic answer the technical-only consult would miss |
| **NEW: `feedback_xd-consult-on-any-ui-string.md`** | **To file** — even "substrate-only" releases ship UI copy. Slot XD/BD consult into Phase 4 implementation review for any release that lands user-visible strings; the post-ship copy patch is cheap once but expensive systematically |

## Carry-forward for Sprint 14

Carry-forward known at sprint close:

- **In-app surface migration to Layer 2 tokens** (Today / Train / Schedule / Drawer rebuilds against the v11.0.0 design system). `/dashboard/you`'s rebuild is the proof-of-pattern; the rest of in-app surfaces follow.
- **PassphraseUnlockCard daily-use wiring on the AI Coach card** (Today / Train). The component is ready; the consumer surface needs the unlock state machine inline.
- **#49 AI year-end forecast.** Replace static YTD goal bar with AI-projected forecast. Schema impact: `users.annual_goal_km` + `annual_goal_type`. Consumes the v11.2.0 profile substrate.
- **#56 Club Share & Invite Flow.** Engagement loop unlock — currently no way to invite others to a club.
- **`account.recover.tsx`** — extract inline styles to `account.recover.module.css`; bring under design-system var-resolution scan.
- **`useAthleteProfile` unification or deprecation** — duplicates state with v11.2.0 server-backed profile API.
- **`managed: 1` Pro-tier flow** — only if Pro tier is greenlit. Substrate ready.
- **Argon2id rotation ADR** — when WASM bundle cost falls.
- **Memory rules to file before Sprint 14 starts** — `feedback_three-role-architecture-consultation.md` and `feedback_xd-consult-on-any-ui-string.md` per the table above.
