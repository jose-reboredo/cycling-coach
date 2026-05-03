# Sprint 12 — CTO Review

**Reviewed:** 2026-05-03 (sprint open + close on the same day; design-heavy sprint executed in a single push)
**Releases shipped:** 1 (v11.0.0)
**Reviewer:** CTO + Architect synthesis with the product lead. Brand Designer + Design System Architect roles consulted at the foundation phase; founder approval gates honoured at Phase 3 close (landing rebuild) and Phase 5 close (parity audit + cut).

> Sprint 12 is the brand-foundation + extended-design-system sprint. v11.0.0 ships the three-layer token taxonomy (additive on top of preserved flat tokens), six rebuilt or new components (Button / Card / EmptyState / Skeleton / Toast + Eyebrow), the Source Serif Pro display pairing, the rebuilt Marketing landing as the canonical reference page, the `/design-system` showcase route, and a 24-test contract suite locking the design-system invariants. No schema, endpoint, or behavior changes — pure design-system work.

## What worked

1. **Phase shape held end-to-end.** Phase 1 (designer walkthrough → AI-aesthetic-tells inventory) → Phase 2 (scoping + cleanup) → Phase 3 (foundation: tokens, brand, type pairing, components, landing rebuild, showcase) → Phase 4 (implementation closeout) → Phase 5 (parity audit + release). Every phase had an explicit gate; nothing leaked. The shape is reusable for the next design-heavy sprint.

2. **Additive token migration kept blast radius zero.** `tokens.css` v2 added Layer 1 / 2 / 3 namespaces *on top of* the existing flat tokens (`--c-canvas`, `--s-N`, `--c-line`, `--r-md`, etc.) without touching them. Every existing CSS module continued to resolve via the unchanged flat tokens. The audit at Phase 5 confirmed this property; in-app surfaces (Today / Train / Schedule / You) rendered unchanged. **Pattern to repeat in Sprint 14+ when in-app surfaces migrate to Layer 2 references — keep flat tokens until every consumer is moved, then drop in a single dedicated sweep.**

3. **Public-API preservation across rebuilds was disciplined.** Button + Card both ship extended variant sets (Button: 4 → 7 variants; Card: + `interactive`) and extended state matrices, but every old prop combination still works. Confirmed via grep across consumers — `pages/Dashboard.tsx`, `pages/ConnectScreen.tsx`, `routes/dashboard.{today,you,schedule,schedule-new}.tsx`, `routes/clubs.new.tsx`, `pages/JoinClub.tsx`, `pages/Privacy.tsx`. The component rebuilds reached the new design system without forcing a callsite refactor.

4. **Phase 5 parity audit caught the regression `pre-deploy-verification.md` was created for.** The `--space-5/7` silent prune would have collapsed every `Card pad="md"/lg"` to `padding: 0` across the entire app. Static analysis (var-resolution scan) located it before any visual smoke; visual smoke confirmed the fix held; both surfaces verified at desktop + 375px mobile. **The memory rule paid for itself in this sprint alone.**

5. **The token-resolution scan is the right shape of guard.** Hard-dep vs soft-hook distinction (`var(--x)` vs `var(--x, fallback)`) lets Layer 3 component-tokens ship as placeholders while still flagging any genuine missing reference. Red-green verified before commit. The scan is a generalisable pattern; reuse for Sprint 14+'s broader migration.

6. **Right-sized ceremony.** No discovery agents spawned for design work the founder + designer were already aligned on. No multi-agent fan-out for component rebuilds — the work was sequential and the diffs reviewable in one head. Founder approval gates respected at the two consequential moments (Phase 3 close on the landing, Phase 5 close pre-cut). Per `feedback_release-ceremony.md` — tech lead, not process robot.

7. **Economy-model routing held.** Opus used at the gates that need judgment (foundation authoring, parity audit synthesis, retro). Sonnet used for the mechanical work (token alias declarations, contract test scaffolding, README sweep). Per `feedback_economy-model.md`.

## What regressed

1. **`--space-5 / --space-7` were silently pruned from the new alias set during Phase 3.** The architecture doc said "8 named tokens through `--space-16` with sensible intermediate steps" and the implementation collapsed to `1, 2, 3, 4, 6, 8, 12, 16, 24, 32` — but `Card.module.css` migrated `var(--s-5)` → `var(--space-5)` and `var(--s-7)` → `var(--space-7)` without re-checking the alias set. The mismatch shipped in commit `c436ae1` and went undetected through the showcase commit (`19c88d6`) because the showcase route didn't exercise `Card pad="md"/lg"` against a populated visual reference. **Caught at Phase 5, fixed in `1088737`. Lesson:** when defining a "pruned" semantic alias scale, every consumer's references must be cross-checked at definition time, not at audit time. The new resolution-scan contract test (`design-system-contract.test.ts`) now blocks recurrence statically.

2. **The pre-Sprint-12 design system inventory missed `--c-border`'s silent fall-through.** Calendar.module.css had been resolving 9 border references to `currentColor` for an unknown duration. The Phase 1 cleanup commit (`5c8e1bf`) added the alias and the contract test now locks it (`tokens.css preserves the Sprint 12 backward-compat aliases (--c-border)`). **Lesson:** any audit cycle should grep for `var(--undeclared-name)` as a first pass. The new resolution-scan applied to the Sprint 12 surface is a partial answer; extending it to legacy CSS modules is a Sprint 14 candidate.

3. **The TypeScript strictness gap in the new test file** — `noUncheckedIndexedAccess` flagged the regex match-group access, which I missed locally and only caught at the post-fix typecheck. Quick fix (explicit truthy guard on captures), but it's a recurring class of friction with Vitest test files that handle regex output. No process change needed; just a reminder to run `tsc --noEmit` after every test file edit, not just at the end of the implementation block.

## What we learned

- **Additive token migrations are the contract for any future design-system change touching production.** The blast radius of `tokens.css` is unbounded — every component CSS module reads it. Sprint 12 proved that adding semantic / component layers *without* removing or renaming the flat tokens lets the rebuild proceed safely. Sprint 14+ in-app surface migration must follow the same pattern: add Layer 2 references *while preserving* the flat tokens until every consumer is moved.

- **Static-scan contract tests for design tokens are tractable.** The 24-test suite (token taxonomy + hex-literal discipline + touch-target floor + 8-state invariants + PWA manifest + var-resolution scan) runs in ~17ms and is cheap to extend. The pattern from `worker-cache-contract.test.ts` (read source as text, assert structural properties) generalises cleanly to CSS. **Filing this as a memory rule** — for any future "system change touching every surface", build a static-scan contract test alongside the change, not after.

- **Hard-dep vs soft-hook distinction is the right granularity** for var() resolution. Layer 3 component tokens *should* ship as forward-declared placeholders with fallbacks; the resolution scan must allow that without flagging. The Card regression was a hard-dep failure. The Button focus-ring placeholders are soft hooks. Both are correct under the new test.

- **Designer walkthrough → tells inventory → fix-by-fix-not-vibes** is the right shape for design audit work. Phase 1 produced a concrete document (`docs/design/03-phase-1-close.md`) of named AI-aesthetic tells. The rebuild addressed each tell explicitly. The post-rebuild manual `/impeccable critique` substitute was a checklist against the document, not a fresh judgment. This kept the work falsifiable.

- **Single-day delivery is feasible for foundation-style sprints when the foundation is well-scoped.** Sprint 12 opened, executed Phase 1–5, and shipped v11.0.0 in one calendar day. The reason: the architecture doc + business-requirements doc were tight and the per-phase commits were small. **Reusable** — when a sprint's scope is "rebuild a foundation, not in-app surfaces", a single-day shape is honest.

## Tech debt accrued

- **In-app surfaces (Today / Train / Schedule / Drawer) still consume flat tokens, not Layer 2.** Adoption is the Sprint 14 charge. Until then, the design system is "the new components + Marketing landing"; the in-app surfaces are the old aesthetic. The contract test allowlist (`AiPlanCard / SessionPrefillModal / SessionRoutePicker / TabShared`) carries 6 hex literals total — well under the 20 ceiling, but tracked for migration.
- **Self-hosted fonts deferred.** Source Serif Pro currently loads via Google Fonts with `display=swap`. The architecture doc planned for self-hosted (subset to Latin + Latin-Extended, `font-display: optional`). Backlog.
- **Phosphor iconography migration deferred.** Existing line icons (`RideIcon`, `SocialIcon`, `RaceIcon`, `BikeIcon`, `SessionIcon`) ship unchanged. `@phosphor-icons/react` not installed. Backlog.
- **Form fields rebuild deferred** to Sprint 14+. The Marketing landing doesn't expose form fields; the in-app surfaces (Settings, schedule-new, modals) refresh at Sprint 14+.
- **ToastProvider + queue + portal + auto-dismiss timing** not shipped. Toast is presentational only. Backlog.
- **`/impeccable` slash command not invoked end-to-end** — the Phase 3 close used a manual checklist substitute against the AI-aesthetic-tells document. The actual `/impeccable` command was not run because the founder's session-time was respected. Acceptable for this sprint; flag it if a future design sprint needs the full critique pass.

## Process notes

- **Sprint 12's docs/design/ scaffolding worked well.** `01-existing-system-inventory.md` (Phase 1) → `03-phase-1-close.md` (designer walkthrough output) → `04-phase-2-scoping.md` (per-step scope) → `05-mobile-walkthrough.md` (mobile-specific tells) → `landing-ux.md` (UX spec ahead of build). Each doc had a single owner and a single purpose. Reuse the pattern for any future design-heavy sprint.

- **`PRODUCT.md` + `DESIGN.md` at the project root, not under docs/, was the right placement** (per commit `b62fd0b`'s rationale: "impeccable convention"). Both are project-level brand foundations, not design-system internals — they belong at the root next to README.

- **The 4-doc sprint shape (`00-summary` + `01-business-requirements` + `02-architecture-changes` + `03-cto-review`) is now mandatory** per `feedback_sprint-documentation-mandatory.md`. Sprint 12 honours it. Sprint 13's docs need to be scaffolded at sprint open, not retro'd at close.

- **Phase 5 audit doc** (`04-phase-5-parity-audit.md`) was added beyond the standard 4-doc shape. **Recommendation:** make a Phase 5 audit doc mandatory for any sprint that ships a system-touching change (tokens / endpoints / schema / build). The Sprint 11 retro called for harnesses; the Sprint 12 audit is the lower-cost equivalent for design-system changes.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-deploy-verification.md` | **Re-validated** — Phase 5 parity audit caught the `--space-5/7` regression that visual-only smoke might have missed. Counts as a second incident validating the rule. |
| `feedback_release-readme-sweep.md` | **Re-validated** — README sections (Routes / Components / Recent releases) were swept as part of `chore(release): cut v11.0.0`. |
| `feedback_sprint-documentation-mandatory.md` | **Re-validated** — 4 docs shipped at sprint close (5 with the Phase 5 audit doc). |
| `feedback_release-ceremony.md` | **Re-validated** — single-day sprint, no agent fan-out for sequential design work, founder approval gates respected at the two consequential moments only. |
| `feedback_economy-model.md` | **Re-validated** — Opus at judgment gates (foundation, audit, retro), Sonnet at mechanical edits (token aliases, README sweep, scaffolding). |
| `feedback_pre-coding-scope-alignment.md` | **Re-validated** — designer walkthrough at Phase 1 open captured the actual tells; the fixed list drove the rebuild instead of the rebuild chasing a vague "looks AI-generated" verdict. |
| **NEW: `feedback_static-scan-contracts.md`** | **To file** — for any system-change touching every surface (tokens, endpoints, schema, build), build a static-scan contract test alongside the change. Pattern: read source as text, assert structural properties. Reference: `worker-cache-contract.test.ts`, `worker-authz-contract.test.ts`, `design-system-contract.test.ts`. The Sprint 12 var-resolution scan added a new sub-pattern: distinguish hard deps from soft hooks. |
| **NEW: `feedback_additive-foundation-migrations.md`** | **To file** — when changing a foundation that's consumed by every downstream module (tokens.css, schema.sql, base CSS), the migration must be additive: add new APIs without renaming or removing old ones. Old consumers stay valid until a dedicated sweep migrates them. The Sprint 12 token rebuild proved the blast-radius math; the same shape applies to schema columns and worker route shapes. |

## Carry-forward for Sprint 13

- **Route-generation rebuild** (deferred from Sprint 11; explicitly carried to Sprint 12 in the original schedule, then swapped to Sprint 13 by founder decision at 2026-05-03 sprint-12 open). Scope unchanged: end-to-end redesign — geocode (Nominatim ambiguity surfaces) + ORS request shape (bbox, profile, waypoint scaffold) + scoring weights + post-validation gates + Strava + RWGPS saved-route ranking + picker UX + fixture-based harness. Don't touch one layer in isolation. Per `project_route-generation-status.md` — no targeted patches.
- **Sprint 14+ candidates** (not Sprint 13's charge): in-app surface adoption of Layer 2 tokens; self-hosted fonts; Phosphor migration; form fields rebuild; ToastProvider implementation; per-component documentation pages on the showcase route; visual regression suite (Playwright snapshot comparison) at the four in-app surfaces.
- **Memory rules to file before Sprint 13 starts** — `feedback_static-scan-contracts.md` and `feedback_additive-foundation-migrations.md` per the table above.
