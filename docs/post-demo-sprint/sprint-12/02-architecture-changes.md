# Sprint 12 — Architecture Changes (Planned)

Status: **planned**. This document is the design-time plan; the shipped section will be filled at Phase 4 close.

## Schema

**No schema changes.** This sprint is pure design system work.

## Endpoints

**No new endpoints.** No worker changes other than potentially serving self-hosted fonts via `apps/web/public/fonts/` (static-asset path; no Worker code).

## Frontend — token system refactor

### Three-layer token taxonomy

Current `tokens.css` (and inline CSS-module hex literals throughout the codebase) collapse all token concerns into one flat set of CSS custom properties. Sprint 12 refactors to:

```
Layer 1 — primitive tokens (raw values)
  --color-orange-500: #ff4d00;     /* the molten-orange anchor */
  --color-orange-50 .. -950:        /* full ramp */
  --color-warm-grey-50 .. -950:     /* neutrals with warmth bias */
  --color-success-500, etc.
  --space-1 .. -16:                 /* 4-pt grid: 4 / 8 / 12 / ... / 64 */
  --font-size-xs .. -display:       /* 8 sizes, modular ratio */
  --font-weight-regular .. -bold:
  --line-height-tight .. -loose:
  --radius-sm .. -lg:
  --shadow-1 .. -5:                 /* 5-level elevation */
  --duration-fast .. -slow:         /* motion timing */
  --ease-standard, --ease-emphasised: /* custom cubic-bezier, not framework default */

Layer 2 — semantic tokens (intent)
  --surface-page, --surface-card, --surface-elevated:
  --text-primary, --text-secondary, --text-faint:
  --accent-default, --accent-strong, --accent-soft:
  --border-default, --border-strong:
  --state-success, --state-warning, --state-danger, --state-info:
  --focus-ring:

Layer 3 — component tokens (component-scoped)
  --button-bg-primary-default, --button-bg-primary-hover, --button-bg-primary-active:
  --button-text-primary, --button-text-disabled:
  --card-bg, --card-border, --card-shadow:
  --input-bg, --input-border-default, --input-border-error, --input-text-placeholder:
  ...
```

**Migration discipline:** every CSS module that currently carries hex literals or raw values gets refactored to reference Layer 2 (semantic) or Layer 3 (component) tokens. No Layer 1 (primitive) references in component CSS — primitives are an internal scale, components consume semantic + component tokens.

A static-scan contract test (added in Phase 4) asserts no `#[0-9a-f]{3,6}` hex literals remain in `apps/web/src/components/**/*.module.css`.

### Color palette evolution (decision: evolve, don't replace)

- **Primary anchor:** `#ff4d00` molten orange, retained as `--color-orange-500`.
- **Full ramp:** `--color-orange-50` (near-white tint) through `--color-orange-950` (near-black shade). Eleven steps. Generated via OKLCH for perceptual uniformity, exported to hex for CSS.
- **Neutrals:** warm-grey ramp (subtle warm bias instead of pure slate). The senior-pro markers reference flags pure-grey neutrals as an AI tell.
- **Semantic state colours:** success, warning, danger, info — each with its own three-step ramp (default, hover, soft-bg).
- **Per-viewport rule:** the orchestrator's "one accent per viewport" personal standard is enforced. Marketing landing keeps molten orange as the only accent; in-app surfaces same. Two competing accents = redo per the rule.

### Typography pairing

- **Body:** Inter (variable, weights 100–900), already in the project; kept as the workhorse face.
- **Display + editorial:** Source Serif Pro (variable, weights 200–900). Adobe-released, Google-Fonts-hosted, free, Open Font License.
- **Hosting:** self-hosted under `apps/web/public/fonts/` (subset to Latin + Latin-Extended; WOFF2 only). Avoids the third-party request to Google Fonts and the privacy + perf hit. Subset using `glyphhanger` or `pyftsubset`; budget ≤ 50 KB per face.
- **Loading:** `<link rel="preload" as="font" type="font/woff2" crossorigin>` in `apps/web/index.html` for the two primary weights (Inter 500 + Source Serif 600). `font-display: optional` to avoid FOUT/FOIT.
- **Type scale:** modular scale 1.25 (major third). Eight sizes from `--font-size-xs` (12px) to `--font-size-display` (60px+). Display uses Source Serif Pro; H1–H3 use Source Serif Pro at lower weights; H4–H6 + body + UI labels use Inter.
- **Pairing rationale (recorded in `DESIGN.md`):** Inter is a known workhorse; Source Serif Pro adds the editorial gravitas the current Inter-alone setup lacks (see `references/ai-aesthetic-tells.md` — "Inter alone with no companion face" is a documented tell).

### Spacing rhythm

- 4-pt base grid. Eight named tokens: `--space-1` (4px) through `--space-16` (64px) with sensible intermediate steps.
- Container widths: max 1200px on Marketing; 960px on in-app reading surfaces; full-bleed allowed on hero sections.
- **Whitespace policy:** generous on Marketing; contextual in-app. Recorded as a rule in `DESIGN.md`, not a vibe.

### Motion language

- Duration tokens: `--duration-fast` (120ms), `--duration-base` (200ms), `--duration-slow` (320ms), `--duration-page` (500ms).
- Easing tokens: `--ease-standard` `cubic-bezier(0.2, 0, 0, 1)`, `--ease-emphasised` `cubic-bezier(0.3, 0, 0.1, 1)`. Both custom — neither is the framework default.
- Rule (recorded in `DESIGN.md`): motion explains state change or spatial relationship; never decoration. `prefers-reduced-motion: reduce` is honoured at the token level (zero-duration override).

### Iconography

- **Adopt:** `@phosphor-icons/react` (MIT, ~1500 icons, six weights — Thin / Light / Regular / Bold / Fill / Duotone).
- **Replace:** existing line icons in `apps/web/src/design/icons/` (RideIcon, SocialIcon, RaceIcon, BikeIcon, SessionIcon). Keep the existing component names but back them with Phosphor primitives internally so call sites don't break.
- **Eliminate:** any emoji as section icon. Grep for `'📈'`, `'🚀'`, `'💡'` etc. in JSX and `.tsx` content.
- **Default weight:** Regular for in-app, Bold for Marketing CTAs. Single accent on icon-only buttons; aria-labels mandatory.

## Frontend — components rebuilt

Each component below is rebuilt to consume tokens only, with all 8 states (default / hover / active / focus / disabled / loading / empty / error) designed and implemented. Each gets an entry on the `/design-system` showcase route.

| Component | Variants | States | Notes |
|---|---|---|---|
| `Button` | primary / secondary / tertiary / ghost / link / destructive | all 8 | Drop the `withArrow` prop default-on (per AI-aesthetic-tells: "buttons with arrow → suffix on every CTA"). Loading state shows spinner inside button, not external. Icon-left / icon-right / icon-only variants. |
| `Card` | default / elevated / outlined / interactive | hover + active for `interactive` only | Pick one depth strategy (shadows OR borders, not both). `elevated` uses `--shadow-1`; `outlined` uses `--border-default`. |
| `Input` / `Textarea` / `Select` | sizes sm / md / lg | all 8 | Custom-styled, not browser default. Helper text + error text + success indicator slots. |
| `Checkbox` / `Radio` / `Toggle` | — | all 8 | Token-styled; `:focus-visible` ring uses `--focus-ring`. |
| `EmptyState` | illustration / minimal | — | Illustration slot (token-coloured SVG); headline + body + optional CTA. Microcopy variants per surface, not generic "No items yet". |
| `Skeleton` | text / circle / rect / card | shimmer animation token-driven | Replaces ad-hoc loading copy; respects `prefers-reduced-motion`. |
| `Toast` | success / info / warning / danger | enter / exit motion | New addition; replaces ad-hoc alert/console patterns surfaced in the inventory. |

## Frontend — Marketing landing rebuild

The current `apps/web/src/pages/Landing.tsx` (or wherever the landing lives) gets rebuilt end-to-end using:
- Only Layer 2 + Layer 3 tokens.
- Only the rebuilt components above.
- Real copy from the voice & tone guide in `DESIGN.md` — no "Seamless. Powerful. Modern."
- Real numbers — replace any "Trusted by thousands" with concrete cyclist / club counts.
- Sentence-case headlines except the product name "Cadence Club".
- One accent per viewport — no two-CTA centred hero with both as primary.

The IA + state matrix is documented in `docs/design/landing-ux.md` ahead of build.

## Infra

### Package additions

- `@phosphor-icons/react` — icon set.
- (Possibly) `glyphhanger` or `pyftsubset` as a build-time tool to subset self-hosted fonts. Decision at Phase 3 step 7.

### Removed

- Any unused inline SVG icons after Phosphor migration.

### CSP

- Self-hosted fonts under `apps/web/public/fonts/` are same-origin — no `font-src` CSP additions needed.
- Phosphor renders as inline SVG via React — no `img-src` additions needed.

### Worker secrets

None added or removed.

## Observability

### Smoke ladder (Phase 5)

| Check | Surface |
|---|---|
| Footer reads `v11.0.0` | Every page |
| Marketing landing renders the new system end-to-end without console errors | Landing |
| `/design-system` showcase renders every component in every state | `/design-system` |
| Hard-reload preserves font-loading (no FOUT, `font-display: optional` honoured) | Throttled 4G |
| Existing in-app surfaces (Today / Train / Schedule / Drawer) render against the new tokens without visual regression | Founder + designer walkthrough |
| `npm run test:unit -- --run` → 234 tests pass | CI |
| `npx tsc --noEmit` → exit 0 | CI |
| `prefers-reduced-motion: reduce` zero-duration override applied | Manual via DevTools |
| Contrast ratios on every text-on-surface combination ≥ 4.5:1 | `apps/web/src/lib/__tests__/` token contrast contract test |

### New contract tests (Phase 4)

- `tokens-contract.test.ts` — asserts the three-layer taxonomy is enforced (no Layer 1 primitives in component CSS modules).
- `no-hex-literals.test.ts` — scans `apps/web/src/components/**/*.module.css` for hex literals and fails on any match outside the primitives file.
- `icon-set-singleton.test.ts` — asserts no `<svg>` outside `@phosphor-icons/react` and no emoji-as-section-icon JSX patterns.
- `accent-per-viewport.test.ts` (best-effort static scan) — flags any single component using two competing accent tokens.

These extend the v10.13.0 static-scan contract pattern into the design layer.

## Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Token refactor breaks visual parity on in-app surfaces | Medium | Medium | Phase 5 visual regression on Today / Train / Schedule / Drawer; if any unintended drift, fix before deploy |
| 234 tests fail under the new tokens | Low | High | Tests don't reference tokens directly; if they fail it's because component contracts changed — the rebuild keeps existing public APIs |
| Phosphor migration introduces icon weight inconsistency | Low | Low | Default weight rule (Regular in-app, Bold on Marketing CTA) recorded in `DESIGN.md` |
| Source Serif Pro file size exceeds budget | Low | Low | Subset to Latin + Latin-Extended; ≤ 50 KB per face budget; cut weights if needed |
| `/impeccable critique` returns > 1 tell after polish | Medium | Medium | The rule is "redo, don't patch" — back to step 1 of the playbook; foundation is too weak |
| Marketing landing rebuild creates content lock-in | Low | Medium | All copy lives in the page component; voice & tone guide in `DESIGN.md` is the source of truth for future edits |
