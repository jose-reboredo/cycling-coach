# Sprint 12 — Business Requirements

**Source:** Designer review 2026-05-03 (the look-and-feel reads as AI-generated and needs to meet a senior designer's bar). Founder approved Sprint 12 = UI/brand on the same day; route-generation rebuild moved to Sprint 13.
**Wedge:** First-impression craft. Every persona (Marco, Sofia, Léa) hits the same surfaces; current palette / typography / component states make the product look generic. The fix is foundational, not cosmetic.

## Hypothesis

A real brand foundation (`PRODUCT.md` + `DESIGN.md`) plus a three-layer token system plus a rebuilt component library plus one canonical reference page (Marketing landing) will eliminate the AI-aesthetic tells the designer flagged. Subsequent sprints scale the new system to the in-app surfaces; this sprint earns the right to do that by building one surface end-to-end against the new foundation and getting designer + founder sign-off.

The opposite hypothesis (that surface-level cosmetic upgrades would suffice) is rejected because:
- The codebase already has hand-rolled components — they're not the bottleneck.
- The real gaps are in **palette ramps**, **typography pairing**, **token semantic layers**, **iconography consistency**, and **state coverage** (loading / empty / error designed, not bolted on). Every one of those is foundational, not cosmetic.

## In scope

| # | Theme | Phase | Effort |
|---|---|---|---|
| 1 | 30-minute designer walkthrough — record specific tells across Today / Train / Schedule / Drawer / Landing | 1 | ~1h |
| 2 | Existing-system inventory (tokens, components, hex-literal scan, AI-aesthetic-tells audit) | 1 | ~2h (BA agent) |
| 3 | Architect: extend-vs-greenfield decision; migration risk; 234-test parity gate strategy | 2 | ~1h |
| 4 | Tech Lead: implementation plan + sequencing | 2 | ~1h |
| 5 | Brand Designer: fill `references/brand-foundation-template.md` → `PRODUCT.md` + `DESIGN.md` | 3 | ~6h |
| 6 | DSA: refactor `tokens.css` to three layers (primitive → semantic → component); 4-pt grid spacing scale; full color ramps; type scale | 3 | ~6h |
| 7 | DSA: type loading — Inter + Source Serif Pro via `apps/web/public/fonts/` self-hosted; preload tags in `index.html` | 3 | ~2h |
| 8 | DSA: icon system swap to Phosphor (`@phosphor-icons/react` MIT); replace existing icons in `apps/web/src/design/icons/`; eliminate emoji as section icons | 3 | ~3h |
| 9 | DSA + Tech Lead: rebuild Button (full variants + states), Card (variants + depth strategy), Form fields (custom-styled, all states), Empty-state (illustration slot), Skeleton (loading system), Toast (notification system) | 3 | ~12h |
| 10 | XD: `docs/design/landing-ux.md` — IA + flows + 8-state matrix for the canonical reference page | 3 | ~2h |
| 11 | XD + DSA: rebuild `apps/web/src/pages/Landing.tsx` end-to-end using only system components + tokens; replace generic copy with specific numbers and editorial voice | 3 | ~6h |
| 12 | Brand Designer: `/impeccable shape` → `/impeccable craft` → `/impeccable audit` (Haiku) → `/impeccable critique` (Opus) → `/impeccable polish` (Sonnet) on the reference page | 3 | ~2h |
| 13 | Founder: explicit sign-off on the reference page | 3 gate | — |
| 14 | Tech Lead: build `/design-system` showcase route — every component in every state on a single dev-only page | 4 | ~3h |
| 15 | Tech Lead: replace existing components with the new system on the Marketing landing path; keep 234 tests green | 4 | ~5h |
| 16 | Tech Lead: pre-deploy legacy parity audit (visual regression on Today / Train / Schedule / Drawer); cut v11.0.0; deploy | 5 | ~3h |

**Total estimate:** ~46h. Phase 3 (steps 5–13) is ~33h — the bulk of the sprint by design.

## Out of scope

- **Route-generation rebuild.** Sprint 13.
- **Full in-app surface refresh** of Today / Train / Schedule / Drawer with the new system. Sprint 14+. This sprint touches them only enough to verify they don't break under the token refactor (legacy parity audit at Phase 5).
- **Real photography or commissioned illustration.** Out of budget; tasteful gradients + stock + a mention in the brand foundation that this is a near-term gap.
- **Lighthouse 95+ enforcement in CI.** Backlog.
- **Storybook proper** (the npm package). The `/design-system` showcase route is the lightweight in-product equivalent.
- **Dark mode.** Backlog. The token system is being built three-layer so dark mode lands cleanly later, but is not delivered this sprint.
- **Voice/tone changes that touch in-app microcopy beyond the landing.** This sprint locks the voice & tone guide; surface-by-surface microcopy migration is in Sprint 14+.

## Acceptance criteria

A senior designer:
1. Reviews the rebuilt Marketing landing and the `/design-system` showcase. Reports ≤ 1 AI-aesthetic tell. ✅ via `/impeccable critique` Opus pass + manual designer review.
2. Approves the Marketing landing as the canonical reference page. ✅ founder sign-off captured in `03-cto-review.md` at sprint close.

A user:
3. Opens the Marketing landing and sees real numbers (e.g. cyclist counts, club counts) instead of generic claims like "Trusted by thousands". ✅ verified at Phase 3 step 11.
4. Opens any surface and sees consistent iconography (Phosphor only, no mixed sets, no emoji as section icons). ✅ verified at Phase 4.
5. Loads the page on a 4G connection and the type pairing renders without FOUT (font preload tags + `font-display: optional`). ✅ verified at Phase 5.

A reviewer running the post-deploy contract tests:
6. `npm run test:unit -- --run` → 234 tests pass. ✅ Phase 4 gate.
7. `npx tsc -b` → exit 0. ✅ Phase 4 gate.
8. Visual regression of Today / Train / Schedule / Drawer post-deploy: no unintended changes (intended changes only on the Marketing landing). ✅ Phase 5 gate.

A founder:
9. Reads the brand foundation (`PRODUCT.md` + `DESIGN.md`) and signs off on the positioning, palette evolution, and voice/tone direction. ✅ Phase 3 gate.

## Process directives

- **Pre-coding scope alignment** (memory rule). Designer walkthrough at Phase 1 open is the alignment step. No implementation begins until Phase 1 closes with documented tells + token inventory + the founder's positioning input.
- **Pre-generation checklist** (orchestrator). Before any UI generation in Phase 3, run `checklists/pre-generation.md` — foundation gate, source gate, constraint gate, voice gate, anti-pattern gate, companion-skill gate. Every generation prompt cites the tokens it's constrained to.
- **Two-or-more tells = redo, don't patch** (orchestrator rule). After every generation, scan `references/ai-aesthetic-tells.md`; if 2+ tells appear, redo affected sections rather than patching.
- **Quality non-negotiable** (orchestrator personal standard). Every component shipped this sprint has unit tests, every state visible in the showcase route, no half-finished implementations.
- **Token efficiency is design** (orchestrator personal standard). Model routing per `methodology/model-routing.md` — Opus for brand foundation first author, Sonnet for token + component work, Haiku for `/impeccable audit` and asset polish.
