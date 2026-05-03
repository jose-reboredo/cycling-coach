# Sprint 12 — Brand Foundation + Extended Design System

**Status:** In flight
**Dates:** 2026-05-03 → …
**Version target:** **v11.0.0** (MAJOR — design system change visible across every surface)
**Persona focus:** All personas — first-impression craft
**Phase shape:** Phase 3 (Design)-heavy sprint per the project orchestrator (Discovery → Scoping → Design → Implementation → Release)
**Headline outcome (target):** Brand foundation locked (`PRODUCT.md` + `DESIGN.md`); three-layer token system in code; six priority components rebuilt; Marketing landing rebuilt end-to-end as the canonical reference page; `/impeccable critique` passes with ≤ 1 AI-aesthetic tell remaining.

## Why this sprint exists

A senior designer reviewed the product 2026-05-03 and the look-and-feel reads as AI-generated. The repo has tokens, components, and a sound architectural baseline — but no real brand foundation, no token ramps, no enforced typography pairing, no editorial voice, no consistent icon set. This sprint addresses the foundation, not the surface, with the Marketing landing as the showcase reference for the new system.

## Themes

| Theme | Plugin / role | Effort |
|---|---|---|
| Brand foundation — `PRODUCT.md` + `DESIGN.md` | Brand Designer (Opus, first author) | ~6h |
| Token system — three layers (primitive → semantic → component) | Design System Architect (Sonnet) | ~6h |
| Typography pairing — Inter + Source Serif Pro (free; editorial gravitas) | Brand Designer + DSA | ~2h |
| Color palette evolution — keep `#ff4d00` as primary; add ramps + warmth bias on neutrals | Brand Designer | ~3h |
| Icon system unification — Phosphor (`@phosphor-icons/react`, MIT, weight variants) | DSA | ~3h |
| Component rebuild — Button, Card, Form fields, Empty-state, Skeleton, Toast | DSA + Tech Lead | ~12h |
| Canonical reference page — Marketing landing rebuilt end-to-end | Experience Designer + DSA | ~6h |
| `/impeccable` critique cycle — audit → critique → polish | Brand Designer | ~2h |
| `/design-system` showcase route in-app | Tech Lead | ~3h |
| Pre-deploy legacy parity audit + smoke + cut v11.0.0 | Tech Lead | ~3h |

**Total budget:** ~46h.

## Releases planned

| Version | Stage | Note |
|---|---|---|
| v10.13.x | (no releases) | No production deploys during Phase 1–3; design work is local until the reference page is approved |
| v11.0.0 | Sprint close | Cut after Phase 4 (Implementation) and Phase 5 (Release) gates pass |

## Out of scope (deferred)

- **Route-generation rebuild** — moved to **Sprint 13** as a dedicated focused sprint with a fixture-based harness. (Founder confirmed swap 2026-05-03.)
- **Full in-app surface refresh** (Today / Train / Schedule / Drawer rebuilds) — Sprint 14+. This sprint rebuilds the foundation + Marketing landing as the reference; in-app surfaces adopt the new system in subsequent sprints.
- **Performance budget enforcement** (Lighthouse 95+ in CI) — backlog.
- **Real photography / commissioned illustration** — beyond this sprint's budget. Stock + tasteful gradients placeholder until commissioned work lands.

## Decisions locked at sprint open (2026-05-03)

| # | Decision | Rationale |
|---|---|---|
| 1 | Sprint 12 = UI/brand; route-gen → Sprint 13 | First-impression craft has higher leverage than route-gen reliability right now |
| 2 | Designer is available for the Phase 1 walkthrough + Phase 3 reference-page review | Walkthrough captures specific tells, not a generic "AI-generated" verdict |
| 3 | Evolve the palette around `#ff4d00` (don't replace) | Brand has equity in molten orange; evolve via semantic + neutral-warmth ramps, not a colour swap |
| 4 | Free type pairing: **Inter + Source Serif Pro** | Source Serif Pro has wider weight range (200-900) and stronger editorial gravitas than Lora; both free, both Google Fonts hosted |

## Memory rules referenced this sprint

- `feedback_pre-coding-scope-alignment.md` — the designer walkthrough at Phase 1 open is the alignment step; no implementation begins until Phase 1 closes.
- `feedback_pre-deploy-verification.md` — Phase 5 includes a legacy-parity audit; 234 tests stay green; mutation-roundtrip and visual-regression smoke run before deploy.
- `feedback_release-ceremony.md` — sprint scope is right-sized; the four-doc shape is mandatory but each doc stays tight.

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document. |
| `01-business-requirements.md` | Wedge / hypothesis / scope / acceptance criteria. |
| `02-architecture-changes.md` | Token layers; component contracts; package additions; smoke ladder. |
| `03-cto-review.md` | Sprint retrospective (filled at sprint close). |

## Linked artefacts (filled as Phase 1 → 3 produces them)

| Artefact | Location | Owner |
|---|---|---|
| Existing-system inventory (tokens / components / hex-literal scan / AI-aesthetic-tells audit) | `docs/design/01-existing-system-inventory.md` | BA (Discovery agent) |
| Brand foundation | `docs/design/PRODUCT.md` + `docs/design/DESIGN.md` | Brand Designer |
| Token source-of-truth | `apps/web/src/design/tokens.css` | DSA |
| IA + flows for Marketing landing | `docs/design/landing-ux.md` | XD |
| Component library entries | `apps/web/src/components/` (per-component CHANGELOG) | DSA + Tech Lead |
| Showcase route | `/design-system` (dev-only) | Tech Lead |
