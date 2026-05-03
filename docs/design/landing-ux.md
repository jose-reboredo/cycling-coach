# Landing — UX Specification

**Surface:** `apps/web/src/pages/Landing.tsx`
**Phase:** 3, step 11 (Sprint 12)
**Author:** Experience Designer
**Status:** Locked at Phase 3 step 11 (drives step 12 rebuild)

The Marketing landing is the canonical reference page for the new design system. Every component, every token, every voice rule must work here before scaling to in-app surfaces in Sprint 14+. If the system can't make the landing crafted, it's not the right system.

This document specifies the IA, the primary and secondary flows, and the eight-state matrix every interactive surface honours.

---

## 1. Information architecture

The landing is a single long-scroll page with seven horizontal bands. Each band has a single editorial purpose; bands stack rather than nest.

| # | Band | Purpose | Components used |
|---|---|---|---|
| 1 | TopBar | Brand mark + single primary CTA | `TopBar`, `Button` |
| 2 | Hero | Positioning, primary CTA, instrument-cluster preview proving the value | `Pill`, `Container`, `Button`, `PmcStrip`, `ZonePill`, `ProgressRing`, `GrainOverlay`, `ClimbProfile` |
| 3 | Credentials band | Four numeric proof-points with source attribution | `Container` |
| 4 | For-you / Not-for-you | Honest persona scoping | `Container`, `Eyebrow` |
| 5 | Features | Four `FeatureSpread` sections, alternating reverse, each with its own custom visual | `Container`, `Eyebrow`, `PmcStrip`, `WorkoutPreview`, `SchedulePreview`, `ClubLayerPreview` |
| 6 | Pricing | Five-row honest BYOK pricing grid | `Container`, `Eyebrow` |
| 7 | Final CTA | Restatement of the primary action with editorial closing | `Container`, `Button`, `GrainOverlay`, `ClimbProfile` |

The order is non-negotiable. Hero → Credentials → Honesty (For/Not-for) → Product (4 features) → Pricing → Final CTA is the editorial argument: "what we do" → "you can trust the numbers" → "we're specific about who you are" → "here's what you get" → "here's what it costs" → "here's the door".

---

## 2. Primary flow

A visitor opens the landing intending to evaluate the product.

1. **Reads the hero H1 + lede.** *Train solo. Ride together. Smarter.* + the sub-paragraph. Decision: keep reading or close.
2. **Glances at the instrument-cluster preview.** Sees PmcStrip + today's session + ProgressRing. Understands this is a real training product, not marketing copy.
3. **Scrolls to credentials band.** Sees four sourced numbers (10s setup, $0/mo, 7 zones, ~$0.02/plan). Confidence that the claims aren't generic.
4. **Reads For-you / Not-for-you.** Self-identifies (or self-disqualifies). This is intentional friction — the disqualified visitor saves us a churn event.
5. **Skims the four features.** PmcStrip → today's session → schedule preview → club layer preview. The visuals carry more weight than the copy here.
6. **Reads the pricing band.** Confirms the BYOK model and the $0 floor.
7. **Scrolls to final CTA.** *Don't break the chain.* Decides.

Primary call to action throughout: **Connect with Strava**. Secondary CTA in the hero: *See what you get* (jump-link to the features band).

---

## 3. Secondary flows

### 3.1 Visitor on mobile (375 px viewport)

- TopBar collapses to brand-mark + small Connect button.
- Hero H1 wraps at the italic emphasis (`Train solo. Ride together. Smarter.` becomes three stacked lines).
- Instrument-cluster preview reflows below the lede; PmcStrip + ProgressRing stack vertically.
- Credentials band displays as 2×2 grid.
- For/Not-for grid stacks (For first, Not-for second).
- FeatureSpread rows always stack `body` above `visual` regardless of the desktop `reverse` flag.
- Pricing rows stack to a single column.
- Final CTA reduces breathing room; the dense `ClimbProfile` is preserved.

### 3.2 Visitor with `prefers-reduced-motion: reduce`

- All `motion.div` entrance animations clamp to instant via the global `--duration-* → 1ms` rule in `tokens.css`.
- ClimbProfile gradient remains static (the SVG itself doesn't animate).
- GrainOverlay stays — it's a static texture, not motion.

### 3.3 Visitor with no JS (no-JS fallback)

- Out of scope for this sprint. The landing is a TanStack Router route inside the SPA shell; no-JS visitors hit the loading shell with no content. The marketing-only static prerender is a future concern.

### 3.4 Visitor clicks "Connect with Strava"

- Browser navigates to `connectUrl()` (Strava OAuth).
- Landing component unmounts; OAuth flow takes over.
- After return, user lands on `/dashboard/today` (per manifest `start_url`).

---

## 4. Eight-state matrix per interactive surface

Per `DESIGN.md` §8, every interactive surface specifies eight states. The landing's interactive surfaces are: TopBar Connect button, Hero primary CTA, Hero secondary CTA, four FeatureSpread (non-interactive but honour visible-states for scroll), Final CTA, and the in-band "Get a key →" link in the pricing.

| Surface | Default | Hover | Active | Focus (visible ring) | Disabled | Loading | Empty | Error |
|---|---|---|---|---|---|---|---|---|
| TopBar Connect | Accent fill, no arrow | Brighter accent | Pressed | Glow + ring | n/a (always available) | If async OAuth init: spinner | n/a | If Strava down: error toast |
| Hero primary CTA | Accent fill, no arrow (drop the universal `withArrow`) | Brighter accent | Pressed | Glow + ring | n/a | Spinner during OAuth init | n/a | Toast on Strava 5xx |
| Hero secondary CTA | Ghost variant | Background pill on hover | Pressed | Ring | n/a | n/a | n/a | n/a |
| FeatureSpread visuals | Static visual after viewport intersection | n/a (decorative) | n/a | n/a | n/a | n/a | n/a | n/a |
| Final CTA | Accent fill, no arrow | Brighter accent | Pressed | Glow + ring | n/a | Spinner | n/a | Toast |
| Pricing "Get a key →" link | Link variant — accent text, no underline | Underline + accent-hover colour | Pressed | Ring | n/a | n/a | n/a | n/a |

**`withArrow` policy on the landing:** **dropped on every primary CTA**. Per the Phase 1 inventory + the orchestrator's `ai-aesthetic-tells.md` (`Buttons with arrow → suffix on every CTA`), the universal arrow pattern is one of the documented tells. Arrows reappear only on inline jump-link affordances ("See what you get" pointing at `#what`) where the arrow communicates direction, not decoration.

---

## 5. Voice rules applied to the landing copy

The voice rules in `PRODUCT.md` §3 govern every string on the landing. Calibrations specific to this surface:

- **Headline H1.** Italic emphasis on the middle clause: *Train solo. <em>Ride together.</em> Smarter.* Sentence-case.
- **Eyebrow framing.** `№ 01 — Honesty`, `№ 02 — The product`, `№ 03 — Pricing`. The `№` mark is a deliberate publication-chrome move from `The Athletic` reference brand. Renders in Source Serif Pro.
- **Hero lede.** Specific operations, not feature names. *Connect Strava in 10 seconds. Join your club, or start one. See what's on this week. An AI coach that learns your form — and helps your crew plan rides together. Free to start. Works on your phone.*
- **Credentials band numbers.** Each number has a source: `10s` *typical Strava OAuth round-trip*, `$0` *monthly subscription*, `7` *Coggan zones + Neuromuscular*, `~$0.02` *per AI plan (BYOK)*. No more `∞` (vague), no more `100% local-first` (false post-v10.9.0).
- **Pricing rows.** "About 50¢ a month if you use it daily" — the most specific affordance copy on the page.
- **Final CTA.** *Don't break the chain.* — the cyclist idiom; opinionated; specific to the audience.

---

## 6. Typography assignments

Per `DESIGN.md` §2:

| Element | Family | Size | Weight |
|---|---|---|---|
| Hero H1 | Source Serif Pro | display (64px desktop, scales down on mobile) | 600 |
| Hero italic emphasis | Source Serif Pro italic | display | 600 italic |
| Hero lede | Geist | lg (18px) | 400 |
| `№` editorial framing in Eyebrow | Source Serif Pro | sm (14px) | 500 |
| Section H2 | Source Serif Pro | 3xl (40px) | 600 |
| Section H2 italic | Source Serif Pro italic | 3xl | 600 italic |
| FeatureSpread H3 | Geist | 2xl (28px) | 600 |
| Body / lede | Geist | md (16px) | 400 |
| Hero stat number | Geist Mono | 2xl (28px) | 600 |
| Hero stat label | Geist | sm (14px) | 500 |
| Pricing label | Geist | md (16px) | 500 |
| Pricing price | Geist Mono | xl (22px) | 600 |
| Final CTA H2 | Source Serif Pro | display | 600 |
| Final CTA italic emphasis | Source Serif Pro italic | display | 600 italic |

The instrument-cluster preview retains Geist Mono for all numerical readouts; that's the cockpit signature and is not changed.

---

## 7. Token migration

Every CSS class in `Landing.module.css` migrates from flat tokens (`--c-*`, `--s-*`, `--sh-*`) to Layer 2 semantic tokens (`--surface-*`, `--text-*`, `--accent-*`, `--space-*`, `--radius-*`, `--duration-*`, `--ease-*`). The migration is mechanical and preserves visual parity by construction (Layer 2 aliases existing flat tokens at the same values).

No new design decisions are encoded in the migration; it's the foundation step that lets future palette / dark-mode work touch tokens.css alone without sweeping every CSS module.

---

## 8. Acceptance criteria for the rebuild

The Phase 3 step 13 manual quality gate scans the rebuild against `references/ai-aesthetic-tells.md` + `references/senior-pro-markers.md`. Before founder approval at step 14:

- [ ] No `withArrow` on primary CTAs (hero + final + TopBar).
- [ ] All four credentials-band numbers have source attribution.
- [ ] Hero H1 + section H2s + final CTA H2 + the `№` Eyebrows render in Source Serif Pro.
- [ ] No hex literals in `Landing.module.css` outside the primitives file.
- [ ] All eight states designed for every interactive surface (table in §4).
- [ ] No "100% local-first" anywhere.
- [ ] Sentence-case headlines (Title Case reserved for `Cadence Club`).
- [ ] `prefers-reduced-motion: reduce` honoured (existing global rule).
- [ ] Mobile reflow verified at 375px (text wraps, two-column grids stack, instrument-cluster preview repositions below lede).
- [ ] 234 unit tests still pass; tsc clean; build green.

If two or more AI tells remain after the rebuild, the orchestrator rule is **redo, don't patch** — go back to step 1.
