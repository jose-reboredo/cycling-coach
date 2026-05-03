# Sprint 12 — Phase 1 close report

**Sprint:** 12 (Brand Foundation + Extended Design System)
**Phase:** 1 — Discovery
**Date:** 2026-05-03
**Status:** Phase 1 source-only artefacts complete. **Live designer walkthrough + founder brand-foundation answers still required to fully close Phase 1 and proceed to Phase 2 (Scoping).**

This report synthesises three Phase 1 inputs into one canonical reference for the live designer review and the founder's brand-foundation decision round:

| Input | Author | Path |
|---|---|---|
| Existing-system inventory | BA / Discovery agent | `docs/design/01-existing-system-inventory.md` |
| Senior designer walkthrough — desktop | Brand Designer + XD | `docs/design/02-designer-walkthrough.md` |
| Senior designer walkthrough — mobile + PWA | Brand Designer + XD | `docs/design/02b-mobile-walkthrough.md` |

---

## Synthesis — what the three documents agree on

### 1. The product is more crafted than "AI-generated" implies

All three sources independently land on this: the BA inventory finds `0` hits on the orchestrator's flagged AI copy tells (`Seamless`, `leverage`, `elevate`, `unlock`, `Welcome aboard`, `Oops`); the desktop walkthrough notes domain-specific component vocabulary (`PmcStrip`, `ProgressRing`, `ZonePill`, `ClimbProfile`, `GrainOverlay`); the mobile walkthrough finds robust safe-area handling, touch-target tokens already declared and consumed in 17 module files, and v9.7.5's iOS Safari hardening sprint paying off.

The "AI-generated" feedback is **directionally correct, partially overcalibrated**. The actual gaps are concrete and documented below.

### 2. Three real PRESENT AI-aesthetic tells, all addressable in Sprint 12 Phase 3

The BA inventory (§5 of `01-existing-system-inventory.md`) plus both walkthroughs converge on three:

1. **Depth-stack on Card-class surfaces** — `border + radius + shadow` combination ("belt and suspenders" depth). Pick one strategy and apply consistently.
2. **`withArrow` on every primary CTA** — `Button`'s `withArrow` prop ships a `→` arrow on Marketing landing hero, Final CTA, TopBar Connect, and Today's quick-add buttons. Universal hover-translate-3px reinforces. Orchestrator anti-pattern.
3. **Identical fade-in-on-scroll easing repeated 30+ times** — `[0.4, 0, 0.2, 1]` cubic-bezier appears verbatim across Landing FeatureSpread, every dashboard tab section, and the modal stack. Motion-as-decoration, not motion-as-communication. Custom easing curves are tokenised (`--e-out`, `--e-in-out`, `--e-back`, `--e-sharp`) but consumers re-declare the value inline rather than referencing the token.

### 3. Token system is shallow, not absent

- Single accent + zone tokens exist (`--c-accent`, `--c-z1…7`); the missing layer is **alpha-step ramps** (`accent-08 / 12 / 22 / 32 / 50` for hover / focus / soft-bg / border / glow contexts).
- Spacing scale (`--s-1 … --s-32`) is solid 4-pt grid.
- Radius / shadow / motion / z-index tokens all declared.
- **No semantic → component layer.** Components reference primitives directly (`var(--c-accent)`), not intent (`var(--button-bg-primary-default)`).
- ~85 hex literals across module CSS — most are token consumers, **one is a true literal** (`#0a0a0c` in `SessionRoutePicker.module.css:72` should be `var(--c-canvas)`).
- One bug: `--c-border` referenced 9 times in `Calendar.module.css` but **not declared anywhere** — silently falls through to `currentColor`. Tech-Lead-track fix, not a design decision.

### 4. Typography is a real pairing, but not editorial

Geist + Geist Mono — both Vercel typefaces, both geometric, neither editorial. Sprint 12's plan to add Source Serif Pro is therefore a **deliberate broadening** ("sans + serif + mono editorial cockpit") rather than a fix-an-AI-default. The current pairing is incomplete, not wrong.

The desktop walkthrough's recommendation stands: Source Serif Pro for display + section H2s + the `№ 01 / № 02 / № 03` editorial framing. Geist stays as workhorse. Inter is **not** the destination — the inventory confirmed Geist + Geist Mono is what's in tree, not Inter.

### 5. Iconography is hand-rolled, not generic

The BA inventory found a **persona-specific 12-icon hand-rolled set** in `apps/web/src/design/icons/` — no third-party library imported. The "generic icon set everywhere" tell is genuinely absent.

Sprint 12's plan to swap to Phosphor (`@phosphor-icons/react`) is a **broadening move** (more coverage, weight variants, future React Native portability), not a craft fix. Designer should weigh: keep the curated 12-icon set for high-frequency surfaces and add Phosphor as the long-tail set, vs full migration. Decision belongs to the live walkthrough.

### 6. Voice / tone is strong on existing surfaces

Zero hits on the orchestrator's `Seamless / leverage / elevate / unlock / transform / empower / Welcome aboard / Let's get started / Oops! / No items yet` checklist. Existing copy reads as coach-and-captain voice ("Form is fresh. TSB at +6 — great day to test the legs.", "Don't break the chain", "Three riders, one shared toolkit").

One borderline: `"Welcome back. Generate your AI plan to get a structured week."` on Today's empty state. Voice opportunity, not a tell.

**Voice + tone guide for `DESIGN.md` should codify what exists, not invent a new direction.** The operating voice is already on the page; document it.

### 7. PWA chrome is in good shape; manifest needs rebrand cleanup

Mobile walkthrough flags drift in `apps/web/public/manifest.webmanifest`:
- `name: "Cycling Coach"` → should be `"Cadence Club"` (rebrand drift since v9.1.0)
- `short_name: "Coach"` → bland; recommend `"Cadence"`
- `background_color` + `theme_color` `#08090b` ≠ tokens.css `--c-canvas: #0a0a0c` (drift)
- No PNG icon fallbacks (192 / 512) for older Android
- No `shortcuts` (PWA shortcuts iOS 16.4+ + Android both honour)

These are concrete, low-effort fixes that lift the install experience.

### 8. Content drift on a Marketing claim

`apps/web/src/pages/Landing.tsx:67` — `100% local-first` is **inaccurate post-v10.9.0**. Tokens moved server-side to D1 in Sprint 9 (Migration 0012). This is a content correctness bug masquerading as a design tell. Replace independently of any design work, ideally same day.

---

## Mobile is now first-class scope (decision 2026-05-03)

The original Sprint 12 plan placed mobile-specific surface refinement at "designer walkthrough needed → out of scope this sprint". The lead's redirection has reframed: future-mobile-app is the strategic destination, so **mobile is a first-class concern during the Phase 3 component rebuild**, not deferred.

Concrete additions to Sprint 12 scope:

| Addition | Phase | Effort delta |
|---|---|---|
| PWA manifest cleanup (name / short_name / theme / icons / shortcuts) | 4 | ~1h |
| Component contracts mobile-aware from Phase 3 (touch-target floor, tap-state, safe-area awareness as part of public contract) | 3 | ~2h baked into existing component-rebuild budget |
| Tokens portable beyond CSS — `tokens.ts` becomes source-of-truth, `tokens.css` is generated | 3 | ~2h |
| Add named-spring tokens alongside duration + easing (forward-compat with React Native / Capacitor) | 3 | ~1h |
| `--safe-area-top` / `--safe-area-bottom` semantic tokens (resolve to `env()` on web; bridge-supplied in native) | 3 | ~0.5h |
| `/design-system` showcase route renders mobile viewport at 375px alongside desktop | 4 | ~1h |
| `touch-target-contract.test.ts` — static-scan test asserting interactive components reference `--hit-min` or higher | 4 | ~1h |

**Net Sprint 12 budget delta:** ~+8h. Updated total estimate: **~54h** (was ~46h).

Mobile-app **stack decision** (PWA-deep / Capacitor / React Native) is **out of scope for Sprint 12** — Phase 3's stack-agnostic design-system shape accommodates all three paths. Stack call belongs to a future founder decision sprint with concrete trade-off analysis.

---

## Top-3 priorities for Phase 3 (locked from this Phase 1 close)

In order of leverage:

1. **Type pairing — Source Serif Pro for display + section H2s + the `№` editorial framing.** Single font-family addition (~50 KB after subsetting). Unlocks editorial gravitas across every surface where the existing `<em>` italic emphasis already does half the work. Geist stays as body + UI workhorse.
2. **Three-layer token refactor — primitive ramps → semantic intent → component scope.** Source-of-truth in `tokens.ts`, generated `tokens.css`. Adds alpha-step ramps for accent + neutrals. No visual change at first; sets up palette evolution / dark mode / seasonal themes / future-mobile-app token portability as cheap operations.
3. **Stat-row source attribution + content correctness fix.** Marketing landing hero stat row + Credentials band get source attribution; the false `100% local-first` claim is replaced same day. Removes the "stat counters with no source" AI tell while keeping the punchy hero shape.

After these, the Phase 3 component rebuild + Marketing landing canonical reference page proceeds. The `/impeccable critique` cycle gates the close.

---

## Decisions still required to close Phase 1

These items can only come from the founder + the live designer walkthrough. **Phase 2 (Scoping) cannot start without them.**

### From the founder (brand foundation answers)

Per `references/brand-foundation-template.md`:

- One-line positioning for Cadence Club (internal clarity, not marketing)
- 3 adjectives that describe the brand
- 3 anti-adjectives (we are NOT this)
- 3 reference brands whose visuals/voice we admire
- 3 brands we explicitly are NOT
- Audience: what Marco / Sofia / Léa are doing in the 60 seconds before they hit our screen (mental state, not demographics)

### From the live designer walkthrough

Calibrate against the source-only walkthroughs (`02-` and `02b-`):

- Confirm or reject each PRESENT AI tell flagged in §1.5 of the inventory and the headline read of the desktop walkthrough.
- Decide on iconography: keep curated 12-icon set + add Phosphor for long-tail, OR full Phosphor migration.
- Decide on palette ramp generation method: OKLCH (perceptual uniformity) vs HSL vs hand-tuned per-step.
- Decide on the `№` editorial framing direction: scale up (commit to publication-style chrome across in-app surfaces) vs scale back (Marketing-only, in-app stays cleaner).
- Decide on motion language depth: spring-physics tokens for native readiness vs cubic-bezier-only for now (defer spring tokens to Sprint 14+).
- Three senior gut-check answers (`02-designer-walkthrough.md` §closing): "Could this be any other product?", "What does this remind you of?", "What detail would you change first?"

---

## Ready-to-fix items (do not require designer decisions)

These can ship immediately without affecting the Phase 1 → 2 gate:

| Item | File | Owner | Effort |
|---|---|---|---|
| `100% local-first` content correctness fix on Landing hero | `apps/web/src/pages/Landing.tsx:67` | Tech Lead | ~10 min |
| `--c-border` declared in tokens.css (currently undeclared but referenced 9× in Calendar) | `apps/web/src/design/tokens.css` | Tech Lead | ~5 min |
| `#0a0a0c` literal swapped for `var(--c-canvas)` | `apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css:72` | Tech Lead | ~1 min |
| PWA manifest: `name` / `short_name` / `theme_color` / `background_color` aligned with tokens + Cadence Club rebrand | `apps/web/public/manifest.webmanifest` | Tech Lead | ~10 min |

These four fixes total ~30 minutes and close concrete drift items the inventory + walkthroughs surfaced. Recommend: bundle into a `chore(sprint-12): pre-foundation cleanup` commit on `main` ahead of Phase 2 — they are correctness fixes, not design decisions.

---

## Phase 1 → Phase 2 gate

**Required to advance:**

- [ ] Founder brand-foundation answers captured (in chat or as `docs/design/founder-brand-input.md`)
- [ ] Live designer walkthrough recorded (delta against source-only walkthroughs)
- [ ] Three senior gut-check answers documented
- [ ] Decisions on iconography / palette method / `№` framing / motion depth recorded
- [ ] Ready-to-fix items above shipped (optional but recommended; they are correctness fixes that don't depend on Phase 2 decisions)

When these are complete, Phase 2 (Scoping) opens with Architect + Tech Lead authoring the implementation plan against the locked brand foundation.
