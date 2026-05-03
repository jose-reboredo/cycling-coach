# Cadence Club — Design System

The internal one-page reference for the visual and motion language. Public on GitHub by intent. Pairs with `PRODUCT.md` (positioning, audience, voice).

If a design decision can be answered by reading this page, the answer is the answer. If a decision requires going beyond what's documented here, update this document in the same change.

Tokens in code: `apps/web/src/design/tokens.ts` (source of truth) → `apps/web/src/design/tokens.css` (generated, committed).

---

## 1. Color system

### Anchor

The primary anchor is **molten orange** `#ff4d00`, retained from v9.1.1 onward. The palette evolves around this anchor — neutrals warm-tilted, alpha ramps added, semantic state colors broadened. The anchor itself does not change.

### Roles (≤ 7)

The orchestrator's brand-foundation rule limits color roles to seven. The roles below are the canonical set for the product.

| Role | Token (semantic) | Source primitive | Usage |
|---|---|---|---|
| **Brand primary** | `--accent-default` | `--color-orange-500: #ff4d00` | Primary CTAs, active state, selected pill, focus-ring base |
| **Surface 0 (page)** | `--surface-page` | `--color-warm-grey-950: #0a0a0c` | Page background |
| **Surface 1 (card)** | `--surface-card` | `--color-warm-grey-900: #16181d` | Card background |
| **Surface 2 (elevated)** | `--surface-elevated` | `--color-warm-grey-800: #1f232a` | Modal, drawer, dropdown background |
| **Text primary** | `--text-primary` | `--color-warm-grey-50: #f0f1f3` | Body text, headings |
| **Text secondary** | `--text-secondary` | `--color-warm-grey-400: #7d8290` | Helper text, captions, eyebrow |
| **Border / divider** | `--border-default` | `--color-warm-grey-700: alpha 0.06` | Hairlines, card borders, dividers |

State colors (`--state-success`, `--state-warning`, `--state-danger`, `--state-info`) are reserved for state communication — never decoration.

Zone colors (`--c-z1` … `--c-z7`) are domain-specific to cycling power zones and are retained outside the seven-role scheme; they identify training intensity and are functional, not decorative.

### Alpha-step ramps

For each role, alpha steps are declared at `08 / 12 / 22 / 32 / 50` — used for hover backgrounds, focus rings, soft fills, and overlay treatments. The Phase 1 inventory found these declared inconsistently; the new system declares them once.

```
--accent-08:  rgba(255, 77, 0, 0.08)   /* hover bg */
--accent-12:  rgba(255, 77, 0, 0.12)   /* soft bg / pressed */
--accent-22:  rgba(255, 77, 0, 0.22)   /* glow */
--accent-32:  rgba(255, 77, 0, 0.32)   /* strong border */
--accent-50:  rgba(255, 77, 0, 0.50)   /* disabled accent */
```

### Palette generation

Primitive ramps (50–950) for orange and warm-grey are generated via OKLCH for perceptual uniformity, exported to hex for universal CSS compatibility. Generation source: `apps/web/src/design/generate-tokens.ts`. Output is committed; the generation script runs on the (rare) occasion the palette is tuned.

### Discipline

- **One accent per viewport.** Molten orange is the only accent. Two competing accents fights for attention; if it appears, redo.
- **No default Tailwind palettes.** No `purple-600`, `indigo-500`, `slate-*` — these are AI-aesthetic tells.
- **Pure black is forbidden.** The page background is `#0a0a0c`, not `#000`. Pure black on pure white (or vice versa) screams default.
- **Warm-grey neutrals, not slate.** Subtle warm bias; senior work has temperature.
- **Color carries semantic meaning.** Danger/success/warning never used as decoration.

---

## 2. Typography

### The pairing

| Role | Family | Why |
|---|---|---|
| Display + section H2s + `№` editorial framing | **Source Serif Pro** (variable, 200–900) | Editorial gravitas. Pairs with the publication chrome already in the product. Free, OFL, Adobe-released, Google-Fonts hosted. |
| Body + UI labels + form fields | **Geist** (variable, 100–900) | Workhorse. Geometric without being default-Inter. Pre-existing in the project. |
| Numerical / tabular / time / power | **Geist Mono** (variable, 100–900) | Tabular nums. Already used for the calendar time chips, instrument-cluster numbers, and the `.eyebrow` utility. |

Three families. Each does one job. None overlap.

### Pairing rationale (recorded for posterity)

The Phase 1 walkthrough noted: Geist + Geist Mono is a real pairing but lacks editorial gravitas; the existing `№ 01 — Honesty` framing wants a serif. Source Serif Pro adds the third register without replacing the workhorse pair. The decision is **broadening, not replacing** — Geist remains the dominant face by character count.

### Scale

Modular scale 1.25 (major third). Eight named sizes:

| Token | Size | Line-height | Family | Use |
|---|---|---|---|---|
| `--font-size-xs` | 12px | 18px | Geist | Caption, microcopy |
| `--font-size-sm` | 14px | 22px | Geist | UI label, helper text |
| `--font-size-md` | 16px | 26px | Geist | Body |
| `--font-size-lg` | 18px | 28px | Geist | Lead paragraph |
| `--font-size-xl` | 22px | 30px | Geist | H4 / H5 / H6 |
| `--font-size-2xl` | 28px | 34px | Source Serif Pro | H3 |
| `--font-size-3xl` | 40px | 44px | Source Serif Pro | H2 |
| `--font-size-display` | 64px | 64px | Source Serif Pro | Display / hero H1 |

Mono parallel scale (`.t-mono-xs` through `.t-mono-5xl`) retained from existing utility classes, used for instrument clusters, time chips, and numeric stats.

### Discipline

- **Hierarchy via combined size + weight + spacing**, not size alone.
- **Optical adjustments** — tighter tracking on display (`-0.025em` and tighter), looser on body (default).
- **Real measure** — body line length 60–75 characters; container max-widths enforce this.
- **Inter alone is forbidden.** This system explicitly does not use Inter. Geist + Geist Mono + Source Serif Pro is the answer.
- **No `font-bold` everywhere.** Use weight 500 / 600 / 700 deliberately; `<strong>` is a meaning, not a style.

### Loading

Phase 3 ships fonts via Google Fonts (`<link>` in `apps/web/index.html`).

Phase 4 self-hosts under `apps/web/public/fonts/`, subsetting to Latin + Latin-Extended in WOFF2, with `<link rel="preload">` for the two priority weights (Source Serif Pro 600, Geist 500) and `font-display: optional` to avoid FOUT/FOIT.

---

## 3. Spacing & layout

### Base grid

4-pt base. Eighteen named tokens from `--space-px` (1px) to `--space-32` (128px), with intermediate half-steps (`--space-1-5: 6px`, `--space-2-5: 10px`) for chip paddings.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Inner padding, tight gaps |
| `--space-2` | 8px | Default gap |
| `--space-3` | 12px | Section padding (mobile) |
| `--space-4` | 16px | Card padding (default) |
| `--space-6` | 24px | Card padding (comfortable) |
| `--space-8` | 32px | Section padding (desktop) |
| `--space-12` | 48px | Section gap |
| `--space-16` | 64px | Major section gap |
| `--space-24` | 96px | Hero / final-CTA breathing room |

### Container widths

| Width | Use |
|---|---|
| `--container-narrow` | 640px | Marketing reading sections, single-column forms |
| `--container-base` | 1080px | Marketing landing primary container |
| `--container-wide` | 1280px | Dashboard surfaces, in-app full-width |
| `--container-full` | 100% | Hero sections, full-bleed bands |

### Whitespace policy

**Generous on Marketing. Contextual in-app.** The Marketing landing breathes — section paddings of 96–128px between major sections are correct. The in-app dashboard is dense by design; cyclists reading their TSB don't want to scroll past hero whitespace to find a number.

---

## 4. Radius & elevation

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 2px | Pills, small chips |
| `--radius-sm` | 4px | Buttons, input fields, small cards |
| `--radius-md` | 6px | Cards (default) |
| `--radius-lg` | 10px | Modals, drawers, large cards |
| `--radius-xl` | 16px | Hero panels, instrument-cluster preview |
| `--radius-full` | 9999px | Avatars, dot indicators, fully-rounded pills |

### Elevation — single-strategy rule

**Pick shadow OR border, not both.** The orchestrator's "drop shadow + border + rounded-lg on the same element ('belt and suspenders' depth)" is a documented AI tell. The system enforces single-strategy:

- **Default cards** use `--shadow-1` (subtle), no border.
- **Outlined cards** use `--border-default`, no shadow.
- **Elevated surfaces** (modal, drawer) use `--shadow-3`, no border (the surface color difference does the visual work).

Five-step shadow ramp:

| Token | Value | Use |
|---|---|---|
| `--shadow-1` | `0 1px 2px rgba(0,0,0,0.4)` | Subtle (default cards) |
| `--shadow-2` | `0 4px 12px rgba(0,0,0,0.42)` | Hover lift |
| `--shadow-3` | `0 8px 24px rgba(0,0,0,0.45)` | Elevated (modal, drawer) |
| `--shadow-4` | `0 16px 40px rgba(0,0,0,0.50)` | Floating panels |
| `--shadow-5` | `0 24px 64px rgba(0,0,0,0.55)` | Critical-attention surfaces (rare) |

Plus `--shadow-glow` for the molten-orange focus glow on primary CTAs (existing token, retained).

---

## 5. Motion

### Three principles

1. **Motion explains state change or spatial relationship.** Never decoration. The orchestrator anti-pattern "fade-in-on-scroll on every section" is forbidden.
2. **Custom easing curves only.** Framework-default `cubic-bezier` is a tell. The system declares four named easings, plus four named springs.
3. **`prefers-reduced-motion: reduce` is honoured at the token level.** Zero-duration override applies globally; ad-hoc keyframes and infinite pulses are also caught by the existing `animation-duration: 1ms !important` rule in `tokens.css`.

### Duration tokens

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 50ms | Tap feedback |
| `--duration-fast` | 150ms | Hover, focus, color swap |
| `--duration-base` | 220ms | Default transitions |
| `--duration-slow` | 420ms | Drawer/modal enter, page transitions |
| `--duration-lazy` | 720ms | Hero entrance, decorative reveals |
| `--duration-ring` | 1200ms | Progress ring fill |

### Easing tokens (custom curves)

| Token | Value | Use |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default ease-out feel |
| `--ease-emphasised` | `cubic-bezier(0.3, 0, 0.1, 1)` | Drawer enter, modal enter |
| `--ease-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Subtle overshoot for primary action confirmation |
| `--ease-sharp` | `cubic-bezier(0.4, 0, 0.6, 0.2)` | Exit / dismiss |

### Spring tokens (forward-compat with native)

For React Native or Capacitor, spring physics replace cubic-bezier. The system declares four named springs as TS object — when a native stack lands, they're already there. On web, `motion`'s spring transitions consume them.

| Token | Mass / Tension / Friction | Use |
|---|---|---|
| `--spring-default` | 1 / 280 / 24 | Default UI spring |
| `--spring-emphasised` | 1 / 200 / 22 | Drawer enter, hero entrance |
| `--spring-snap` | 1 / 380 / 26 | Pill toggle, tap response |
| `--spring-soft` | 1 / 180 / 18 | Decorative reveal |

### Reduced-motion

The token block in `tokens.css` already overrides all duration tokens to `1ms` under `@media (prefers-reduced-motion: reduce)`, plus a global `*` rule catching ad-hoc keyframes and infinite pulses. Phase 3 retains this behaviour.

---

## 6. Touch targets & safe areas

### Touch-target floors

| Token | Value | Use |
|---|---|---|
| `--hit-min` | 44px | Floor — every interactive surface |
| `--hit-comfy` | 48px | Buttons, primary CTAs |
| `--hit-big` | 56px | BottomNav slots, hero CTA |

Every interactive component must reference one of these tokens for its minimum size. Phase 4 contract test (`touch-target-contract.test.ts`) enforces this.

### Safe-area semantic tokens

`env(safe-area-inset-*)` is the web mechanism; native stacks use `useSafeAreaInsets()` or platform bridges. The system abstracts both behind:

| Token | Resolves to |
|---|---|
| `--safe-area-top` | `env(safe-area-inset-top, 0)` on web |
| `--safe-area-bottom` | `env(safe-area-inset-bottom, 0)` on web |
| `--safe-area-left` | `env(safe-area-inset-left, 0)` on web |
| `--safe-area-right` | `env(safe-area-inset-right, 0)` on web |

Existing usage of `env(safe-area-inset-*)` is preserved; new code uses the semantic tokens.

---

## 7. Iconography

### Hybrid system

- **Hand-rolled persona-specific icons** (12-icon set under `apps/web/src/design/icons/`) retained for high-frequency / domain surfaces: `RideIcon`, `SocialIcon`, `RaceIcon`, `BikeIcon`, `SessionIcon`. These are part of the brand's visual language.
- **Phosphor (`@phosphor-icons/react`, MIT)** added for long-tail surfaces: settings UI, form chrome, generic actions, system feedback.

### Discipline

- **No emoji as section icons.** Forbidden. The codebase scans clean as of Phase 1; future PRs maintain the line.
- **Default Phosphor weight: Regular** (in-app), **Bold** (Marketing CTAs). Single weight per surface.
- **Icon-only buttons require `aria-label`.** Always.
- **No mixed third-party sets.** Phosphor only beyond the hand-rolled set. No Lucide, Heroicons, Tabler, or react-icons.

---

## 8. Component principles

Three rules that apply to every component built in this system. Violation = redo.

1. **Buttons never have shadows in default state.** Hover may add `--shadow-1`; default must not. (The molten-orange glow on primary CTAs is a focus-state treatment, not a default decoration.)
2. **Cards never have borders AND shadows.** Pick one (see §4).
3. **No more than one accent color per viewport.** Molten orange is the only accent. Two competing accents = redo.

### Eight states for every interactive surface

Every interactive component is designed in all eight states before merging:

`default` → `hover` → `active` → `focus` (visible ring) → `disabled` → `loading` → `empty` → `error`

The `/design-system` showcase route (Phase 4) renders every state side-by-side at desktop and 375px mobile viewports. Components that ship without all eight states do not pass the design review gate.

### Public API discipline

Components rebuilt in Phase 3 preserve their existing public APIs (props, refs, semantics). Internal implementation changes freely. This protects the 234-test suite and downstream consumers.

---

## 9. Imagery & illustration

### Current state (acknowledged gap)

- No commissioned photography.
- No commissioned illustration.
- Custom SVG (`ClimbProfile`, `GrainOverlay`) carries texture without resorting to gradient-mesh tells.
- Tasteful gradients used sparingly (hero band, pricing emphasis) — never as decorative-mesh-without-intent.

### Forbidden

- Stock photography of smiling people on white backgrounds.
- 3D abstract shapes floating with no spatial logic.
- Default favicon or AI-generated logo with three letters in a circle.
- Gradient-mesh backgrounds without semantic role.

### Future scope

Commissioned cycling photography (route, club, training contexts) and commissioned illustration for empty states are near-term gaps. Documented here so the system has a place to plug them in when budget allows. Not Sprint 12 work.

---

## 10. Validation gate

Before declaring this design system complete:

- [x] All `__FILL__` placeholders are filled.
- [x] Color palette ≤ 7 roles, no default Tailwind purple/indigo.
- [x] Type pairing has rationale (not "I like Inter") and forbids Inter alone.
- [x] Voice rules with do/don't examples per context — see `PRODUCT.md` §3.
- [x] No emoji as section icons; custom or curated SVG only.
- [ ] Tokens live in code (`tokens.ts` source-of-truth, `tokens.css` generated) — Phase 3 step 3.
- [ ] One reference page has been built and approved against this foundation — Marketing landing rebuild + founder approval, Phase 3 step 14.
- [ ] `/impeccable critique` passes (≤ 1 AI tell visible) — manual quality gate in Phase 3 step 13; founder runs the Opus pass post-merge if available.

The last three items close in Phase 3.
