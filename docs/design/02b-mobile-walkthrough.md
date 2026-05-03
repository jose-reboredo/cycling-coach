# Sprint 12 — Mobile walkthrough

**Date:** 2026-05-03
**Reviewer:** Brand Designer + Experience Designer (project orchestrator roles)
**Scope:** Mobile-specific chrome (BottomNav, TopBar mobile mode, PWA shell), safe-area / viewport / touch-target compliance, mobile-only surfaces, and design-system implications for the future-mobile-app target.
**Source-only review:** read from code, not from device. Final calibration is a real device walkthrough on iPhone Safari (PWA installed) + Android Chrome.
**Sibling document:** `02-designer-walkthrough.md` (desktop). This file is the mobile complement.

---

## Headline read

The repo has **PWA foundations in better shape than typical hand-rolled web apps**. `viewport-fit=cover` is set, safe-area insets are honoured at top and bottom, the BottomNav has robust safe-area-bottom + iOS-toolbar fallback (`max(env(safe-area-inset-bottom, 0), 12px)`), backdrop-blur + saturate gives the bar a real iOS-native feel, and touch-target tokens (`--hit-min: 44px`, `--hit-comfy: 48px`, `--hit-big: 56px`) exist and are referenced by 17 component CSS modules. v9.7.5's iOS Safari hardening sprint paid off — the foundation is durable.

The actual mobile gaps are:

1. **PWA manifest drift.** `apps/web/public/manifest.webmanifest` still says `name: "Cycling Coach"` + `short_name: "Coach"` — pre-Cadence-Club rebrand (v9.1.0). Status-bar / theme colours `#08090b` mismatch tokens.css `--c-canvas: #0a0a0c`. Description still references "smart route picker" (vague). Three icon sizes only (`icon.svg` + `icon-maskable.svg`) — no precomputed PNG fallbacks for older Android.
2. **No portrait/landscape policy stated visually.** Manifest locks `orientation: "portrait"` — correct call for cycling but never communicated; on rotate the app silently doesn't rotate. A user-facing "portrait optimised" cue in onboarding would help.
3. **Tap-highlight not consistently disabled.** `BottomNav` sets `-webkit-tap-highlight-color: transparent` (line 53) but most other tappable surfaces don't — the default iOS grey flash will appear on Cards / Drawer triggers / Pills. Style decision: kill globally or apply per-component intentionally.
4. **No `touch-action: manipulation` declaration anywhere.** This is the no-300ms-delay-tap optimisation; modern browsers handle it but iOS still benefits in some PWA contexts.
5. **Mobile-specific motion not differentiated.** All motion uses the same `--e-out` easing on web and (would-be) mobile. A native mobile app would expect spring-style physics (overdamped on dismiss, underdamped on enter) — current motion language is mobile-web-grade, not native-grade.
6. **No status-bar coordination on theme switches.** `theme-color` in `index.html` is hardcoded `#0a0a0c`; on dark/seasonal/branded theme switches (future), the iOS status bar background won't follow.
7. **Onboarding / connect flow not mobile-walked in this pass.** First-time-user flow is mobile-heavy (OAuth round-trip on mobile is its own UX) — separate walkthrough warranted.

None of these are blockers. They are the concrete mobile-specific items Phase 3 must address if the strategic destination is a mobile app.

---

## Mobile chrome — what's there

### BottomNav (`apps/web/src/components/BottomNav/BottomNav.module.css`)

**Strengths**
- Mobile-only via `@media (min-width: 600px) { .root { display: none } }`. Breakpoint of 600px (not 1024) gives iPad portrait + tablets the desktop tabs — defensible call from v9.7.2.
- `position: fixed; bottom: 0` with `z-index: var(--z-nav)` — proper layering.
- `backdrop-filter: blur(20px) saturate(180%)` + `-webkit-backdrop-filter` — gives the bar an iOS-native frosted feel without a hard background colour.
- `padding-bottom: max(env(safe-area-inset-bottom, 0), 12px)` — handles both the home indicator AND the case where Safari's bottom toolbar appears (env returns 0 in that case; the 12px fallback prevents collision). Documented inline.
- Buttons have `min-height: 60px` — over-spec for touch (60 > 44 floor), comfortable on real devices.
- Active-state colour is `var(--c-accent)` (molten orange); inactive is `var(--c-text-faint)` — high contrast, single accent enforced.
- `-webkit-tap-highlight-color: transparent` kills the grey iOS tap flash.
- `:focus-visible` keyboard-accessible state with `var(--ring-focus)`.
- `flex` layout (not `grid: repeat(N, 1fr)`) per v9.12.2 — adapts cleanly between Individual mode (5 slots) and Club mode (4 slots) without dead-space.

**Tells / opportunities**
- Label uses `font-mono` at 10px with `letter-spacing: 0.14em uppercase`. Senior-pro markers like the deliberate type choice; the all-caps tracked-out look will date when Source Serif Pro lands and the brand starts pulling editorial. Worth designer review.
- No active-state animation. Tap → colour swap, no transform, no haptic-style feedback. Native mobile apps treat tab-bar tap as a moment; the bar deserves a 120ms accent-line slide or a slot-indicator dot. Phase 3 motion-token exercise.
- No badge slot. When a future feature (notifications, unread RSVP, AI plan ready) needs to surface, the bar has no design-system place for a count badge. Add to component contracts in Phase 3.

### TopBar (`apps/web/src/components/TopBar/TopBar.module.css`)

- `padding: calc(var(--s-3) + env(safe-area-inset-top, 0)) var(--s-5) var(--s-3)` — correct safe-area-top handling (notch + Dynamic Island).
- Wider horizontal padding on `≥768px` (`var(--s-8)`) — desktop refinement.
- Brand bar present via the `<TopBar />` component since v9.3.3.
- No mobile-specific tells flagged in source; visual audit on device needed.

### TopTabs (`apps/web/src/components/TopTabs/TopTabs.module.css`)

- `min-height: var(--hit-min)` (44px) on each tab — touch-target compliant.
- `@media (max-width: 599px) { display: none }` — visible only on tablet+. Pairs with BottomNav for mobile.
- Shrink-to-fit on narrow viewports without overflow (allows tablet portrait at 600–768px). Correct breakpoint logic.

### `index.html` viewport + PWA chrome

- `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">` — correct.
- `<meta name="theme-color" content="#0a0a0c">` — matches tokens.css `--c-canvas`. (Manifest disagrees — see drift below.)
- `<meta name="apple-mobile-web-app-capable" content="yes">` + `apple-mobile-web-app-status-bar-style="black-translucent"` — proper PWA chrome.
- `<meta name="apple-mobile-web-app-title" content="Cadence Club">` — correct rebrand.
- Web fonts via `https://fonts.googleapis.com` — third-party request on first load. **Phase 3 plan to self-host fonts (Source Serif Pro + Inter) via `apps/web/public/fonts/` will eliminate this network round-trip and the privacy footprint.** Worth keeping the existing Geist + Geist Mono behind the same self-host policy.

---

## PWA manifest — `apps/web/public/manifest.webmanifest`

| Field | Current | Issue | Fix |
|---|---|---|---|
| `name` | `"Cycling Coach"` | Pre-rebrand drift (v9.1.0 changed brand to Cadence Club) | `"Cadence Club"` |
| `short_name` | `"Coach"` | Generic, not branded; appears under home-screen icon | `"Cadence"` (recommended) — fits home-screen char limits |
| `description` | "...smart route picker." | "smart" is vague; orchestrator forbidden-words proximate | Rewrite to specific: "Form curve, structured sessions, club schedule." |
| `start_url` | `"/dashboard"` | Correct — installed users skip the landing | Keep |
| `orientation` | `"portrait"` | Correct for cycling app | Keep, but communicate in onboarding |
| `background_color` + `theme_color` | `#08090b` | **Drift from tokens.css `--c-canvas: #0a0a0c`** | Match `--c-canvas` exactly; status bar fades correctly into the app shell |
| `categories` | fitness/health/lifestyle/sports | Acceptable | Consider adding "training" if app stores accept |
| `icons` | 2 entries (svg + maskable svg) | No precomputed PNG fallbacks for older Android (needs ≥192/512) | Add 192×192 and 512×512 PNGs for App Store / Play Store readiness |
| `shortcuts` | Absent | iOS 16.4+ + Android both honour PWA shortcuts | Add 2–3 shortcuts: "Today's session", "Schedule", "Generate plan" |
| `screenshots` | Absent | Required for richer install prompts on Android | Add post-Phase-3 (Marketing landing rebuild produces these) |

These are concrete, low-effort fixes that significantly upgrade the install experience.

---

## Mobile-specific surfaces — observations

### Today (`apps/web/src/routes/dashboard.today.tsx`)
- The 4-StatTile row (`Week TSS / Week hours / FTP / W/kg`) reads as 2×2 on narrow viewports (likely — needs device check). Designer call: 2×2 vs single-row scrollable horizontal.
- ProgressRing is `size={120}` on Today (vs `size={140}` on Landing). Smaller because mobile-first; defensible.
- Eyebrow `Today · {weekday, date}` may wrap on small screens with long weekday names ("Wednesday" + "20 December" = ~32 chars). Visual check.

### Schedule (`apps/web/src/routes/dashboard.schedule.tsx`)
- Calendar Month view on mobile: 7 columns × ~50px each = ~350px wide. Fits iPhone width but with no padding. Worth designer call on whether to compress columns or scroll.
- Day view grids are tall (16h × 40px = 640px) — exceeds typical mobile viewport above the BottomNav. Vertical scrolling expected; check whether the time gutter sticks at the top.

### EventDetailDrawer
- 30 KB gzipped is heavy for a mobile-first drawer. Lazy-load this on mobile specifically — first-paint on Today / Schedule shouldn't include drawer code unless a card is tapped.
- Drawer slides in from right (assumption; needs source check). On mobile, bottom-sheet pattern is more native — Phase 3 component-rebuild call.

### Modals (5 of them — `OnboardingModal`, `ClubCreateModal`, `ClubEventModal`, `SessionPrefillModal`, plus the sprint-10 founded `dashboard.schedule-new` page-route replacement)
- All declare safe-area-aware padding (greppable). Check on device for dismiss-gesture handling.
- iOS PWA modal pattern: backdrop tap dismisses, swipe-down dismisses (recommended Phase 3 add).

---

## Touch-target compliance

- 17 component CSS modules reference `min-height: 44px` or `var(--hit-*)` — most touch surfaces are compliant.
- Spot-checked: `BottomNav .item` 60px ✓, `TopTabs .tab` 44px ✓.
- **Untracked surfaces worth a check:** Pill (likely under 44px when used inline), small icon-only buttons (e.g. close-X on drawers), inline form helpers.

Recommendation: add a contract test (`touch-target-contract.test.ts`) that statically asserts every interactive component CSS module references `var(--hit-min)` or higher. Same pattern as v10.13.0 cache contract.

---

## Mobile-app future state — design-system implications

Founder noted this product targets a future mobile app. Three plausible paths:

| Path | Cost | Native feel | Codebase reuse |
|---|---|---|---|
| **PWA-only with deep iOS/Android polish** | Lowest | Medium | 100% |
| **Capacitor wrapping the existing React app** | Low | Medium-high (native chrome, plugins for camera/notifications/biometrics) | ~95% |
| **Expo + React Native** (rewrite) | High | Highest | ~50% (logic reused; UI rewritten) |

**Stack-agnostic design-system requirements (apply to all three paths):**

1. **Tokens portable beyond CSS.** Phase 3's three-layer token plan must produce both `tokens.css` (CSS custom properties) AND `tokens.ts` (typed JSON object). If we go React Native, tokens are imported as TS at runtime; if Capacitor or PWA, CSS custom properties consume them. Source-of-truth lives in TS; CSS is generated.
2. **Component contracts mobile-aware.** Buttons / Cards / Form fields must specify touch-target floors (44px), tap-state visuals (not hover-only), and safe-area awareness as part of the public contract — not as platform-specific overrides. Phase 3 component rebuild bakes this in.
3. **Motion language has spring tokens.** Web `cubic-bezier` easings translate to native `Animated.spring` config (mass / tension / friction) only with deliberate mapping. Add named-spring tokens in Phase 3 alongside the duration + easing tokens (`--spring-default-tension`, `--spring-default-friction`).
4. **Iconography portable.** Phosphor (Phase 3 plan) ships React + React Native packages from one repo (`@phosphor-icons/react` and `@phosphor-icons/react-native`). Selection is portable; a custom hand-rolled SVG library would not be.
5. **Type pairing self-hosted.** Inter + Source Serif Pro both have webfont (.woff2) and native (.ttf/.otf) distributions. Self-hosting under `apps/web/public/fonts/` aligns with what an Expo / Capacitor build would bundle — same files, different loader.
6. **Safe-area as a token, not a CSS thing.** `--safe-area-top`, `--safe-area-bottom` (resolving to `env()` on web; passed by native bridge in Capacitor; from `useSafeAreaInsets()` in React Native). Phase 3 should declare these tokens explicitly so consumers don't reach for raw `env()`.

**Recommendation for Sprint 12:** treat the eventual-mobile-app destination as a **constraint on the design system**, not as work to do this sprint. Phase 3's token + component design accommodates the future without committing to a stack now. The stack call belongs to a future founder decision sprint with concrete trade-off analysis.

---

## Top-3 mobile priorities for Phase 3

1. **PWA manifest cleanup.** `name`, `short_name`, `description`, `theme_color` / `background_color` aligned with tokens, two PNG icon fallbacks (192/512), 2–3 PWA shortcuts. ~1h. High visible quality lift on install.
2. **Component contracts mobile-aware from day one.** Every component rebuilt in Phase 3 specifies its touch-target floor, tap-state (not hover-only), and safe-area awareness as part of the public contract. The `/design-system` showcase route renders the mobile viewport at 375px alongside desktop. ~2h on top of the existing component-rebuild budget.
3. **Tokens portable beyond CSS.** Source-of-truth in `apps/web/src/design/tokens.ts` (typed object); generate `tokens.css` from it. Existing `tokens.ts` already exists (per the inventory) but mirrors `tokens.css` rather than driving it — flip the relationship. ~2h. Sets up native mobile-app stack agnosticism without committing to a stack.

---

## What this walkthrough did NOT cover

- **Real device walkthrough.** Source-only review. iPhone Safari PWA + Android Chrome PWA install flow needs a real-device pass.
- **Onboarding flow on mobile.** `OnboardingModal` + `ConnectScreen` + Strava OAuth round-trip on mobile is its own UX surface; deserves a dedicated walkthrough at Sprint 14+ or whenever onboarding is in scope.
- **Performance on 4G.** Lighthouse mobile score, FCP, CLS, TTI not measured. Backlog.
- **Accessibility — VoiceOver / TalkBack pass.** Focus-ring tokenised but no screen-reader walkthrough done.
- **Mobile-specific empty / loading / error states.** Will surface during Phase 3 component rebuild — call out then if any read poorly on mobile.

These belong in a follow-up walkthrough or in surface-refresh sprints downstream (Sprint 14+).
