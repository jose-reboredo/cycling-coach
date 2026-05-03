# Sprint 12 — Phase 2 Scoping

**Phase:** 2 — Scoping
**Date:** 2026-05-03
**Author:** Architect + Tech Lead
**Inputs:** Phase 1 close report (`docs/design/03-phase-1-close.md`), brand-foundation answers (locked 2026-05-03), pre-foundation cleanup (commit `5c8e1bf`)
**Output:** Implementation plan and sequencing for Phase 3–5.

---

## Headline

The Phase 1 close already documented the work. This Phase 2 doc commits the **sequencing** and the **migration strategy** — specifically: the token refactor is **additive backward-compatible**, not rewriting consumers, so the 234-test parity gate is trivial throughout. Components rebuild against the new tokens; existing consumers keep working until they're touched.

## Implementation strategy — three principles

### 1. Additive, not rewrite

The current `tokens.css` declares ~30 flat custom properties consumed by ~37 CSS modules. Rewriting consumers to reference Layer 2 / Layer 3 tokens is high-risk for low gain in this sprint. Strategy:

- **Layer 1 — primitive ramps** added as NEW tokens (e.g. `--color-orange-500: #ff4d00`).
- **Layer 2 — semantic tokens** added as NEW tokens, ALIASED to existing primitives (`--accent-default: var(--c-accent)`). Existing consumers keep working.
- **Layer 3 — component tokens** added per rebuilt component only.
- Existing flat tokens (`--c-accent`, `--c-text`, etc.) **remain in place** and continue to work. Future sprints migrate consumers gradually; Sprint 12 does not.

This keeps the 234-test parity gate automatic — no test that passes today can fail because of token reorganisation alone.

### 2. Source-of-truth flips to TypeScript

Today: `tokens.css` is the source-of-truth, `tokens.ts` mirrors it for JS consumption.
Phase 3: `tokens.ts` becomes source-of-truth, `tokens.css` is generated from it (committed, not built at runtime). Generation script lives at `apps/web/src/design/generate-tokens.ts` and runs once per change.

Why: forward-compat with React Native or Capacitor. Native stacks can't read CSS custom properties; they import the TS object. Existing CSS consumers see no change.

### 3. Components rebuild in parallel; landing rebuild is the integration point

Phase 3 splits into two tracks:
- **Track A (DSA):** brand foundation docs + token refactor + six component rebuilds.
- **Track B (XD):** landing UX doc + landing rebuild.

Track A produces the kit; Track B integrates it into the canonical reference page. The `/impeccable critique` cycle runs on the integration, not on individual components.

## Sequencing

### Phase 3 — Design

| # | Step | Owner | Effort | Output |
|---|---|---|---|---|
| 1 | `PRODUCT.md` — positioning, brand essence, three adjectives, three anti-adjectives, three reference brands, three anti-brands, audience 60-second context | Brand Designer | ~3h | `PRODUCT.md` |
| 2 | `DESIGN.md` — color system (≤7 roles + alpha ramps), typography pairing, spacing rhythm, motion principles, voice & tone do/don't | Brand Designer | ~3h | `DESIGN.md` |
| 3 | Token refactor — `tokens.ts` source-of-truth + generated `tokens.css`; OKLCH ramps; Source Serif Pro added; named-spring tokens; safe-area semantic tokens | Design System Architect | ~6h | `apps/web/src/design/tokens.ts`, `apps/web/src/design/tokens.css` |
| 4 | Source Serif Pro loading via `index.html` Google Fonts link (Phase 3); self-host migration (Phase 4) | DSA | ~1h | `apps/web/index.html` |
| 5 | Component rebuild — Button (variants + states; `withArrow` defaults to `false`) | DSA + Tech Lead | ~3h | `apps/web/src/components/Button/Button.tsx` |
| 6 | Component rebuild — Card (variants; single depth strategy: shadow OR border, not both) | DSA + Tech Lead | ~2h | `apps/web/src/components/Card/Card.tsx` |
| 7 | Component rebuild — Form fields (Input / Textarea / Select / Checkbox / Radio / Toggle, all states) | DSA + Tech Lead | ~4h | `apps/web/src/components/FormFields/` |
| 8 | Component build — `EmptyState` (new; illustration slot + microcopy + optional CTA) | DSA + Tech Lead | ~2h | `apps/web/src/components/EmptyState/` |
| 9 | Component build — `Skeleton` (loading system; respects `prefers-reduced-motion`) | DSA + Tech Lead | ~2h | `apps/web/src/components/Skeleton/` |
| 10 | Component build — `Toast` (notification system; replaces ad-hoc alert patterns) | DSA + Tech Lead | ~2h | `apps/web/src/components/Toast/` |
| 11 | `landing-ux.md` — IA + flows + 8-state matrix for the canonical reference page | Experience Designer | ~2h | `docs/design/landing-ux.md` |
| 12 | Landing rebuild — `apps/web/src/pages/Landing.tsx` end-to-end against new system | XD + DSA | ~5h | `apps/web/src/pages/Landing.tsx` (rewrite) |
| 13 | Manual quality gate — checklists from `references/ai-aesthetic-tells.md` + `references/senior-pro-markers.md` + `checklists/design-review.md`; if ≥ 2 tells remain, redo | Brand Designer | ~2h | walkthrough notes appended to `docs/design/03-phase-1-close.md` |
| 14 | **Founder approval gate** | Founder | — | Approval recorded in this doc |

**Phase 3 budget:** ~37h.

### Phase 4 — Implementation

| # | Step | Owner | Effort |
|---|---|---|---|
| 15 | `/design-system` showcase route — every component in every state, desktop + 375px mobile viewports side-by-side | Tech Lead | ~3h |
| 16 | Contract tests — `tokens-contract.test.ts`, `no-hex-literals.test.ts`, `icon-set-singleton.test.ts`, `touch-target-contract.test.ts` | Tech Lead | ~3h |
| 17 | Self-host font subsetting — Source Serif Pro and existing Geist + Geist Mono moved from Google Fonts to `apps/web/public/fonts/` (subset to Latin + Latin-Extended; WOFF2; preload tags) | Tech Lead | ~2h |
| 18 | Iconography hybrid — Phosphor `@phosphor-icons/react` added; existing 12-icon hand-rolled set retained for high-frequency surfaces | Tech Lead | ~2h |

**Phase 4 budget:** ~10h.

### Phase 5 — Release

| # | Step | Owner | Effort |
|---|---|---|---|
| 19 | Pre-deploy legacy parity audit — visual regression on Today / Train / Schedule / Drawer (founder + designer walkthrough; no unintended changes outside Marketing landing) | Tech Lead + Brand Designer | ~2h |
| 20 | Smoke ladder — `/design-system` route renders every state; 234+ tests pass; tsc clean; build green; mobile manifest updates verified on installed PWA | Tech Lead | ~1h |
| 21 | **Founder approval gate** before `npm run deploy` | Founder | — |
| 22 | Cut v11.0.0 — version bumps in 5 files; SW cache name; CHANGELOG entry; commit + push | Tech Lead | ~1h |
| 23 | Deploy + smoke verify | Tech Lead | ~30 min |
| 24 | Phase 5 close — update `_sprints-overview.md`; write `sprint-12/03-cto-review.md` retrospective | Tech Lead | ~1h |

**Phase 5 budget:** ~5h.

**Sprint 12 total:** ~52h (was estimated ~54h after the mobile-first scope add at Phase 1 close; coming in slightly under because the additive token strategy reduces refactor surface).

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Three-layer token refactor breaks visual parity | Low | Medium | Additive strategy — existing flat tokens unchanged; Layer 2 / 3 are new aliases. Visual parity preserved by construction. |
| Source Serif Pro file size exceeds budget on first paint | Low | Low | Phase 4 self-hosting + subsetting + `font-display: optional`. Phase 3 ships via Google Fonts as a 1-day cushion. |
| `withArrow` default change breaks call sites that didn't pass the prop | Low | Low | The prop becomes opt-in; existing call sites that PASS `withArrow` still get the arrow. Only call sites that **omit** `withArrow` lose it — these are the ones we want to clean. Audit-and-confirm at Phase 4. |
| Landing rebuild produces a result that doesn't pass `/impeccable critique` | Medium | Medium | Manual quality gate at step 13 runs before founder approval; if ≥ 2 tells remain, redo per orchestrator rule. Founder gate at step 14 is the final stop. |
| Phosphor icon weight inconsistency with existing 12-icon hand-rolled set | Low | Low | Hybrid migration — Phosphor for long-tail only, hand-rolled set for high-frequency / domain surfaces. Inventory confirmed the hand-rolled set is a senior-pro marker; not migrating wholesale is a deliberate craft decision. |
| 234-test parity gate fails | Very Low | High | Additive token strategy + component rebuilds preserve public APIs. If a test fails, it's a real regression — fix before merge. |
| Real device walkthrough on iPhone Safari surfaces tells the source-only review missed | Medium | Medium | Phase 4 builds the `/design-system` route at 375px viewport; founder + designer walk on real device before approval at step 14. |

## Test parity strategy

The 234-test suite (Sprint 11 baseline) must remain green throughout. Specific guards:

- **Token refactor:** existing flat tokens remain valid. New Layer 2 / 3 tokens are net-additive. No test that passed before can fail because of this change.
- **Component rebuilds:** public APIs preserved. `Button` keeps `variant`, `size`, `withArrow`, `fullWidth`, `href`, all standard HTML button attributes — internal implementation can change freely.
- **Landing rewrite:** the landing has no unit-test assertions referencing its DOM structure (verified). Visual regression handled by the Phase 5 parity walkthrough.
- **Showcase route + contract tests:** net-additive — they only add tests, never remove or modify existing ones.

Total test count after Phase 4: ~245 tests (estimate).

## What this doc deliberately does NOT decide

- **Per-component microcopy.** Lives in `DESIGN.md` voice & tone guide; surfaces during component rebuild.
- **Exact OKLCH values for ramps.** Computed at Phase 3 step 3 from the brand foundation's locked palette. Generation method (`culori` library) committed; output is hex tokens.
- **Real photography or commissioned illustration.** Out of budget. Tasteful gradients + the existing custom SVG (`ClimbProfile`, `GrainOverlay`) carry through. Documented as a near-term gap in `DESIGN.md`.
- **Dark-mode support.** Backlog. The three-layer token system enables it; the work itself is a future sprint.
- **Storybook proper.** The `/design-system` showcase route is the lightweight in-product equivalent. Storybook tooling is not added.

## Phase 2 → Phase 3 gate

- [x] Brand foundation answers locked (founder, 2026-05-03 → "lock it")
- [x] Live designer walkthrough notes — proceed under source-only review; designer reviews at Phase 3 step 14 alongside founder
- [x] Pre-foundation cleanup shipped (commit `5c8e1bf`)
- [x] Implementation plan + sequencing approved (this doc)

**Phase 3 begins.**
