# Dashboard design audit — findings

**Date:** 2026-04-28 · **Auditor:** Claude (per `superpowers:brainstorming` design doc 2026-04-28) · **Catalog:** `ui-ux-pro-max` skill (99 UX guidelines, 44 react-perf, 53 react-stack)

> Companion design doc: [`2026-04-28-dashboard-design-audit-design.md`](./2026-04-28-dashboard-design-audit-design.md). Process: audit → user triages → fix S/M, defer L → ship.

## TL;DR

Dashboard is in good shape on the foundations: solid global focus ring, design tokens, sensible touch-target sizing in `Button`, working `prefers-reduced-motion` plumbing through CSS variables, semantic dialog on the onboarding modal, lazy-loaded ride photos. The audit surfaces **22 findings** — none are critical (no broken-keyboard, no inaccessible content), but several **High** items concentrate around three themes:

1. **Touch targets** — half a dozen ghost / mono-text buttons (`subtleBtn`, `surfaceBtn`, `addressEdit`, `demoBannerClose`) sit at 26–32 px, well below the 44 px floor.
2. **Reduced-motion bypass** — three infinite pulse animations and four `motion.section` blocks hard-code durations rather than reading `--d-*` tokens, so users with `prefers-reduced-motion: reduce` still see them.
3. **Modal & menu focus management** — `OnboardingModal` and `UserMenu` are otherwise well-built but neither traps focus while open nor returns focus to the trigger on close.

Disposition recommendation:

| Severity | Count | Default action |
|---|---|---|
| High | 8 | Fix this pass (all are S effort). |
| Medium | 11 | Fix the **S**-effort ones in this pass; defer **M** to v8.4.0 or v8.5.0 issues. |
| Low | 3 | Doc + defer; mostly already tracked elsewhere. |

Pre-existing GitHub issues that already cover audit-worthy work (no new findings here, just cross-references): **#2** (footer missing), **#4** (yearly goal not editable), **#5** (volume bucket numbers), **#6** (mock routes), **#12** (Lighthouse mobile).

## Methodology recap

Each surface evaluated against the skill's 8 priority categories:

1. Accessibility (CRITICAL) · 2. Touch & Interaction (CRITICAL) · 3. Performance (HIGH) · 4. Layout & Responsive (HIGH) · 5. Typography & Color (MEDIUM) · 6. Animation (MEDIUM) · 7. Style Selection (MEDIUM) · 8. Charts (LOW)

Findings tagged **Severity** (Critical/High/Medium/Low) and **Effort** (S ≤ 30 min · M ≤ 2 h · L > 2 h). Skill catalog rules cited inline in `Category: Issue` form.

## Note on PARS vs. skill recommendation

Running the skill's design-system generator (`scripts/search.py "cycling fitness dashboard performance dark athletic SaaS pro" --design-system`) returned: **Vibrant & Block-based** style + **Barlow Condensed** typography + **green CTA (#22C55E)** + Video-First Hero pattern. This is the typical sports-fitness preset.

PARS (Performance Dark) intentionally diverges:

- **Geist + Geist Mono** instead of Barlow — instrument-panel feel, not athletic-condensed
- **Molten orange #ff4d00** (Strava-derived) instead of green — keeps the brand association
- **Cockpit dark canvas** with restraint — not block-based maximalism

This was a deliberate design choice approved at the start of the v8 redesign for the Marco persona (Pas Normal Studios audience). The audit honors that choice; findings are about catalog rules that apply *regardless of style* (a11y, touch, perf, motion).

The one place this matters: the orange `#ff4d00` accent is contrast-borderline on the canvas (`--c-text` baseline is fine; the accent fails AA for *small* text, passes for ≥ 24 px). See finding **H7**.

---

## High-severity findings (fix this pass)

### H1 — Touch targets below 44 px on multiple controls

**Category:** `Touch: Touch Target Size — Minimum 44x44px touch targets`
**Surfaces:** AI Coach card, Routes picker, Demo banner, Goal event card

| Control | File | Approx size | Why it fails |
|---|---|---|---|
| `.subtleBtn` ("Change API key", "Clear plan", "Cancel", "Edit") | `AiCoachCard.module.css:35`, `GoalEventCard` | ~26 px tall (11 px font + `--s-2`/8 px padding) | No `min-height: var(--hit-min)` |
| `.surfaceBtn` (Tarmac/Gravel/Any pills) | `RoutesPicker.module.css:54` | ~28 px | Padding `--s-2 var(--s-3)` only |
| `.addressEdit`, `.addressCancel` | `RoutesPicker.module.css:105`, `:131` | ~12 px | `padding: 0` |
| `.demoBannerClose` (×) | `Dashboard.module.css:576` | 28 × 28 px | Fixed dim |
| `.showAll` ("Show all 5 routes") | `RoutesPicker.module.css:236` | ~36 px | Borderline |

**Effort:** S · **Fix:** add `min-height: var(--hit-min)` (44 px) and increase horizontal padding where needed; use a `.t-mono-xs`-style label inside a 44 px hit zone (visual size can still look small via padding around a small label).

**Disposition:** **Fix all in this pass** — the demo banner close is already a known small-tap surface; the rest accumulate in interactive sections.

---

### H2 — Infinite pulse animations bypass `prefers-reduced-motion`

**Category:** `Animation: Reduced Motion — Check prefers-reduced-motion media query`
**Files:**

- `Dashboard.module.css:420` `today-pulse 1.6s var(--e-out) infinite` (week-day badge — currently dead code path)
- `AiCoachCard.module.css:310` `today-pulse 1.6s var(--e-out) infinite` (today's day in week plan)
- `Pill.module.css:23` `pill-pulse 1.6s var(--e-out) infinite` (`.dot` on every Pill with the dot prop — including the "Demo data" / "In sync" hero pill, the demo banner Pill)

The `tokens.css` reduced-motion block squashes `--d-*` tokens to 1 ms, but these `@keyframes` declarations use literal `1.6s` durations. Result: users with motion-sensitivity (vestibular / migraine) still see infinitely pulsing dots — exactly the population the rule protects.

**Effort:** S · **Fix:** wrap each infinite animation in `@media (prefers-reduced-motion: no-preference)` or, simpler, use `--d-*` tokens for animation duration and have the reduced-motion block already squash them. Easiest: add a global `*, *::before, *::after { animation-duration: var(--d-instant) !important; }` *only* inside the existing `@media (prefers-reduced-motion: reduce)` block.

**Disposition:** **Fix this pass** — single CSS block in `tokens.css`.

---

### H3 — `OnboardingModal` lacks focus trap + focus restore

**Category:** `Accessibility: Manage focus properly — Focus trap in modals return focus on close`
**File:** `apps/web/src/components/OnboardingModal/OnboardingModal.tsx`

The modal renders `role="dialog" aria-modal="true"` correctly, ESC dismisses, body-scroll is locked. But:

- Tab does not stay inside the modal — it walks past the Skip button into the page behind, where the user can interact with the dashboard while the dialog is "modal".
- After close (Skip / Save / ESC / backdrop click), focus does not return to the user-menu trigger that opened "Edit profile" (or to the first interactive element on the dashboard for the first-run case).

**Effort:** M (~1 h) · **Fix:** small custom focus-trap (no library needed): on open, `useEffect` that saves `document.activeElement`, focuses the first focusable child, listens for Tab/Shift-Tab and wraps. On close, restores the saved element with `previousActive?.focus()`.

**Disposition:** **Fix this pass** — modal correctness is a reputational item, especially for the first-run experience.

---

### H4 — Address input has no programmatic label

**Category:** `Forms: Input Labels — Always show label above or beside input. NO Placeholder as only label`
**File:** `RoutesPicker.tsx:93–99`

`<input value={startAddress} placeholder="Zürich, Switzerland" />` has only a sibling `<Eyebrow>Start from</Eyebrow>` (visual heading, not associated). Screen readers announce the input as unlabelled; placeholder disappears once typed.

**Effort:** S · **Fix:** wrap in `<label>` with the eyebrow as `<span>` content, or add `aria-label="Start address"`.

**Disposition:** **Fix this pass.**

---

### H5 — `OnboardingModal` `autoFocus` is fine; `RoutesPicker` address `autoFocus` is questionable

**Category:** `Accessibility: Keyboard Navigation`
**File:** `RoutesPicker.tsx:98` (`<input … autoFocus />`)

Inside the modal `autoFocus` is appropriate (focus must move into the dialog). In `RoutesPicker`, `autoFocus` fires when the user clicks "Change" — that's a click, so focus management is acceptable. But `autoFocus` also fires on **route navigation** if the editing state happens to be true on mount (it isn't currently, but could regress). Risk is low here; flagging because the catalog rule discourages reflexive `autoFocus`.

**Effort:** S · **Fix:** call `inputRef.current?.focus()` imperatively when transitioning to editing instead of relying on `autoFocus`. Defensible to leave as-is — borderline.

**Disposition:** **Defer (low value)** — re-classify as Low if you agree.

---

### H6 — `motion.div` animates `height` (RideDetail, VolumeChart bars)

**Category:** `Animation: Transform Performance — Use transform and opacity for animations. NO width/height/top/left`
**Files:**

- `RideDetail.tsx:33–37` — `initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}`
- `VolumeChart.tsx:120–133` — bar columns animate `height: 0 → ${pct}%`

Animating `height` triggers layout each frame; `'auto'` is especially expensive (Motion measures the target height repeatedly). On a 12-bar chart this is cheap on desktop but visible on a mid-range Android.

**Effort:** S–M ·

- **VolumeChart bars (S):** swap to `scaleY` from origin bottom (`transformOrigin: 'bottom'`) — same visual, GPU-accelerated.
- **RideDetail expand (M):** trickier because `height: auto` is what we want visually. Either: (a) live with it (most apps do); (b) animate only `opacity` and let the height jump; (c) use a `<details>` element with CSS `interpolate-size: allow-keywords` (Chromium-only, recent). Simplest production choice: keep height animation but set `transition={{ duration: 0.18 }}` so the layout thrash is 18 frames not 32, then guard with `prefers-reduced-motion` to skip animation entirely.

**Disposition:** **Fix VolumeChart in this pass** (S, clear win); **defer RideDetail** to a follow-up unless you want it now (small but adds complexity).

---

### H7 — Hardcoded Motion durations bypass reduced-motion squash

**Category:** `Animation: Reduced Motion`
**Files:** `Dashboard.tsx` (8× `motion.*` blocks), `VolumeChart.tsx`, `RideDetail.tsx`, `OnboardingModal.tsx`, `UserMenu.tsx`, `RoutesPicker.tsx`, `AiCoachCard.tsx`

Every `transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}` literal in the codebase ignores the `prefers-reduced-motion` token squash (because it's a JS prop, not a CSS variable). Motion library *does* honor `useReducedMotion()` if asked, but we never ask.

**Effort:** S · **Fix:** wrap the app (or `Dashboard`) in `<MotionConfig reducedMotion="user">` once. Motion library then short-circuits all child `transition` props under reduced-motion. One-liner.

```tsx
import { MotionConfig } from 'motion/react';
// in main.tsx or Dashboard root:
<MotionConfig reducedMotion="user">{children}</MotionConfig>
```

**Disposition:** **Fix this pass.** Single line, very high payoff.

---

### H8 — Color contrast: orange accent on dark canvas borderline for small text

**Category:** `Accessibility: Color Contrast — Minimum 4.5:1 for normal text`
**Surfaces:** Pill (`.accent` color `#ff4d00` on `--c-accent-soft` ≈ `rgba(255,77,0,0.1)` over canvas), `.greet em`, `.h2 em`, `.bulletGood`, `.surfaceEm` 12 px mono, `.matchHigh` 22 px mono

Eyeball estimate (no programmatic check this pass):

- `#ff4d00` on `#0a0a0c` (canvas): contrast ≈ **3.9:1** — fails AA for normal text (< 24 px), passes for large text (≥ 24 px / 19 px bold).
- `.greet em` is 40–80 px → ✓ passes (large text).
- `.h2 em` is 28–44 px → ✓.
- Small accent text: `.surfaceEm` (12 px), `Pill.accent` text (10 px), `.bulletGood::before` (decorative line — not text), `.brandBadge` (9 px). The 9–12 px accent text fails AA.

**Effort:** S · **Fix:** brighten the accent for small-text usage, e.g. introduce `--c-accent-light: #ff7a3d` (≈ 5.2:1 on canvas) and use it specifically for ≤ 14 px text. Or accept the failure on decorative pill labels (which are nearly always large enough or have a colored background that brings effective ratio higher). Strict fix: nudge `--c-accent` slightly lighter — but this changes brand feel.

**Disposition:** **Recommend deferring to a token-level decision.** Add it as a v8.4.0 issue rather than fix in-pass — touches the design system, not just this dashboard.

---

## Medium-severity findings

### M1 — `alert()` modal in dev fallback path

**Category:** `Feedback: Confirmation Messages` / professional UI hygiene
**File:** `Dashboard.tsx:420` — `onStart={() => alert('Generate your AI plan to replace this sample workout with your real one.')}`

Native `alert()` is jarring on a polished dashboard and blocks the main thread.

**Effort:** S · **Fix:** convert to an inline non-modal hint or a `Pill` with the same copy near the WorkoutCard's CTA. Or, since the message implies the user should scroll to AI Coach, smooth-scroll to `#train` instead of alerting.

**Disposition:** **Fix this pass.**

---

### M2 — BottomNav active state is click-only, doesn't follow scroll

**Category:** `Navigation: Active State — Highlight active nav item with color/underline`
**File:** `BottomNav.tsx:16` (`useState` not synced to scroll)

Tabs are anchor links to `#today / #train / #stats / #you`. Clicking sets `activeId`; scrolling away doesn't update it. After scroll, the active orange dot still claims the last-clicked tab even though the user is in a different section.

**Effort:** M · **Fix:** `IntersectionObserver` over the four section IDs; setActive when the section in view ≥ 50% changes. ~30 lines.

**Disposition:** **Defer to v8.4.0 issue** (M effort + needs a manual scroll test).

---

### M3 — Font loading is render-blocking

**Category:** `Performance: Render Blocking` + `Performance: Font Loading`
**File:** `apps/web/index.html:20–23`

`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?...&display=swap">` blocks the first contentful paint until Google Fonts CSS arrives. `display=swap` is correct (no FOIT), but the CSS link itself is in the critical path.

**Effort:** M · **Fix options:**

- (a) Self-host Geist/Geist Mono as woff2 in `public/fonts/`, declare `@font-face` with `font-display: swap` in `tokens.css`. Saves one external round trip and removes Google Fonts dependency.
- (b) Use `media="print" onload="this.media='all'"` trick to make the link async — works but is a hack.
- (c) Leave as-is and rely on `defaultPreload: 'intent'` to mask the cost.

**Disposition:** **Defer** — feeds into Lighthouse mobile ≥ 90 work (issue #12). Already tracked.

---

### M4 — No skip-to-main link

**Category:** `Accessibility: Skip Links`
**File:** all page shells

Keyboard users with the TopBar + UserMenu in tab order have to tab past several elements before reaching content. A skip link is conventional.

**Effort:** S · **Fix:** add `<a href="#main" className={styles.skipLink}>Skip to main content</a>` as the first child of `<body>` (i.e. in `__root.tsx`) plus CSS to hide it until focused, and ensure the dashboard's `<main>` has `id="main"`.

**Disposition:** **Fix this pass.**

---

### M5 — UserMenu missing arrow-key nav + focus management

**Category:** `Accessibility: Keyboard Navigation` + `react-stack: Manage focus properly`
**File:** `UserMenu.tsx`

Has `role="menu"` + `role="menuitem"` (good), `aria-expanded`, `aria-haspopup`, ESC + click-outside close (good). Missing:

- ↑/↓ to move between menu items (ARIA-conformant menus expect this).
- Focus enters menu when opened, returns to trigger on close.

**Effort:** M (~1 h) · **Fix:** when `open` flips to true, focus first menu item; track focused index in state; ↑/↓ keyboard handler updates focus. On close, focus returns to the trigger.

**Disposition:** **Defer to v8.4.0 issue** alongside H3 (modal focus mgmt) — same primitive can be reused.

---

### M6 — VolumeChart lacks chart-level ARIA + has incomplete tablist semantics

**Category:** `Accessibility: ARIA Labels` + `Accessibility: Screen Reader`
**File:** `VolumeChart.tsx:42` (whole chart) and `VolumeChart.tsx:59` (`role="tablist"`)

- The chart `<div className={styles.chart}>` has no `role="img"` + `aria-label`. Screen readers announce nothing useful.
- `<div role="tablist">` with `<button role="tab">` requires matching `role="tabpanel"` siblings — we don't have those (the chart re-renders inline). Either drop the tab roles (use plain buttons + `aria-pressed`) or wrap the chart in a `tabpanel` per mode.

**Effort:** S · **Fix:**

- Add `role="img" aria-label="Volume — last {N} {weeks|months}, total {km} km, {m} m elevation"` to the chart container.
- Drop `role="tablist"`/`role="tab"`; use `aria-pressed={mode === id}` on the buttons (already present). Removes incomplete ARIA and is functionally identical.

**Disposition:** **Fix this pass.**

---

### M7 — TopBar lacks `padding-top: env(safe-area-inset-top)`

**Category:** `Layout: Fixed Positioning — Account for safe areas`
**File:** `TopBar.module.css:1–15`

On iPhone with the dynamic-island / notch, the sticky TopBar slides under the status bar without an inset. The `<meta name="viewport" content="...viewport-fit=cover">` is set, so the inset is available.

**Effort:** S · **Fix:** `padding-top: calc(var(--s-3) + env(safe-area-inset-top, 0));`

**Disposition:** **Fix this pass.**

---

### M8 — `<em>` for stylistic italic on user's first name

**Category:** `Accessibility: Screen Reader — Use semantic HTML`
**File:** `Dashboard.tsx:303` (`<em>{firstName}</em>` in greeting), `:464`, `:495`, etc.

`<em>` denotes emphasis; screen readers may stress the word. We're using it purely to apply orange italic via `.greet em`. Acceptable in a marketing voice ("the *user's* dashboard"), defensible here, but the catalog rule prefers semantic HTML.

**Effort:** S · **Fix (optional):** swap to `<span className={styles.greetEm}>{firstName}</span>` and reuse the same CSS. Many sites do leave `<em>` for stylistic italic — it's a defensible choice, but if we're cleaning up we could fix it.

**Disposition:** **Defer / drop** — borderline pedantic.

---

### M9 — `recents` list could announce its expand state more clearly

**Category:** `Interaction: Active States` / `Accessibility: ARIA Labels`
**File:** `Dashboard.tsx:546–581`

Current state: `<button aria-expanded={detailOpen} aria-label="Toggle detail for {name}">` ✓ correct. The chevron rotates. Good.

But the inner content of the button — `<h4>` + meta + stats — uses an `<h4>` inside a `<button>`. That's allowed by HTML5 (buttons can contain phrasing content), but `<h4>` is technically flow content. Browsers handle it; some validators warn.

**Effort:** S · **Fix:** swap `<h4>` → `<span className="rideName">` styled the same. Or use `<div role="button" tabIndex={0}>` (worse for a11y). Or leave it — pragmatic.

**Disposition:** **Defer / drop.**

---

### M10 — Hero greeting fixed at "Morning" regardless of time of day

**Category:** `Content: Placeholder Content` / personalization
**File:** `Dashboard.tsx:303` (`<h1>Morning, <em>{firstName}</em>.</h1>`)

Always greets "Morning" even at 9 PM.

**Effort:** S · **Fix:** simple `getHours()` switch — `Morning / Afternoon / Evening`. 5 lines.

**Disposition:** **Fix this pass** — small polish win.

---

### M11 — Strict-Mode `useMemo` of `readTokens()` defeats reactivity on token change

**Category:** `react-stack: Hooks` + `Effects`
**File:** `Dashboard.tsx:54` (`const tokens = useMemo(() => readTokens(), [])`)

`useMemo(() => readTokens(), [])` runs once at mount. If the user disconnects (token cleared by the user menu) and the page doesn't reload, the gate stays open with stale tokens. Today the code immediately calls `window.location.href = '/'` after `clearTokens()` (line 114), masking this — but it's a fragile coupling.

**Effort:** S · **Fix:** track tokens with `useState` + a tiny event bus / storage event listener, OR keep the memo but ensure all token-clear paths trigger navigation.

**Disposition:** **Defer / document** — current behavior is correct because of the navigation. Not user-facing.

---

## Low-severity findings

### L1 — User-facing copy exposes URL syntax

**File:** `Dashboard.tsx:649` (`<code>?demo=0</code>`), `ConnectScreen.tsx:70` (`<code>?demo=1</code>`)

Showing `?demo=1` in body copy reads as a developer's note that leaked into the UI.

**Effort:** S · **Fix:** for the demo banner, simplify to "Connect your Strava to see your real data." For the connect screen demo hint, hide the code unless `?dev` is on, or rewrite as "Want a guided tour first? [Try the demo]" linking to `/dashboard?demo=1`.

**Disposition:** **Fix this pass** (banner) + **defer** (connect screen — minor).

---

### L2 — Style divergence from skill recommendation (PARS vs. fitness preset)

Documented above. No action; record divergence rationale in the design system docs.

**Disposition:** **Document.** Add a one-paragraph "PARS rationale" to `src/design/tokens.ts` header comment OR to the existing Confluence "User Interfaces" page.

---

### L3 — Already-tracked items

These appear in the dashboard but are already filed:

| Issue | Surface |
|---|---|
| #2 | Site footer missing on /dashboard |
| #4 | Yearly km goal hardcoded at 8,000, not editable |
| #5 | Volume chart should show distance + elevation per bucket |
| #6 | Routes are mock; surface labels should match Strava |
| #12 | Lighthouse mobile ≥ 90 |

No new findings; flagging for completeness.

---

## Summary table — proposed in-pass fixes

| # | Severity | Effort | Title | File |
|---|---|---|---|---|
| H1 | High | S | Touch targets ≥ 44 px on small ghost buttons | `AiCoachCard.module.css`, `RoutesPicker.module.css`, `Dashboard.module.css` |
| H2 | High | S | Squash infinite pulse animations under `prefers-reduced-motion` | `tokens.css` |
| H3 | High | M | OnboardingModal focus trap + restore | `OnboardingModal.tsx` |
| H4 | High | S | `aria-label` on address input | `RoutesPicker.tsx` |
| H6a | High | S | VolumeChart bars: swap `height` → `scaleY` | `VolumeChart.tsx` |
| H7 | High | S | `<MotionConfig reducedMotion="user">` wrapper | `main.tsx` or `Dashboard.tsx` |
| M1 | Medium | S | Replace `alert()` with smooth-scroll to AI Coach | `Dashboard.tsx` |
| M4 | Medium | S | Skip-to-main link | `__root.tsx` + CSS |
| M6 | Medium | S | VolumeChart `role="img"` + drop tablist roles | `VolumeChart.tsx` |
| M7 | Medium | S | TopBar safe-area-inset-top | `TopBar.module.css` |
| M10 | Medium | S | Time-of-day greeting | `Dashboard.tsx` |
| L1 | Low | S | Demo banner copy cleanup | `Dashboard.tsx` |
| L2 | Low | S | Document PARS-vs-skill divergence | `tokens.ts` header |

**Fix count if all approved: 13 items, ~3–4 hours total** (most are 5–15 min CSS / one-line wrappers).

## Deferred to GitHub issues (recommend v8.4.0 / v8.5.0)

| # | Severity | Effort | Title | Why deferred |
|---|---|---|---|---|
| H3-extension | High | M | Reusable focus-trap utility | If we don't make it shared, M5 duplicates |
| H6b | High | M | RideDetail expand: keep `height: auto` but reduce-motion gate | Cosmetic |
| H8 | High | M | Accent-on-dark contrast — introduce `--c-accent-light` for ≤14 px text | Touches design tokens |
| M2 | Medium | M | BottomNav active state syncs to scroll (IntersectionObserver) | Needs scroll testing |
| M3 | Medium | M | Self-host Geist fonts to remove render-blocking external CSS | Already tracked under #12 |
| M5 | Medium | M | UserMenu arrow-key nav + focus mgmt | Reuses focus-trap utility from H3-ext |

## Verification steps when fixes ship

- `npm run build:web` passes with TS strict
- Manual probe at 375 px (iPhone 13 viewport) and 1280 px (laptop) of:
  - Hero fold + GoalEventCard
  - Today's workout (both AI plan present and absent)
  - Momentum (StreakHeatmap + WinsTimeline)
  - VolumeChart (week/month toggle, bar animation)
  - AI Coach (no key → key → report state transitions)
  - Routes picker (surface filter buttons, address edit flow)
  - Previous rides (expand a ride to RideDetail)
  - Demo banner (`?demo=1`)
  - BottomNav tap targets
- Keyboard probe: Tab through dashboard, confirm focus rings, Skip-to-main works, modal focus traps
- `prefers-reduced-motion` enabled in OS → confirm pulses freeze, motion sections snap

Once approved fixes ship, deploy to Cloudflare and run `npm run docs:sync` to regenerate the Confluence Interfaces page if any component contracts changed.
