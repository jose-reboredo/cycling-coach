# Phase 1 — Existing-System Inventory

**Sprint:** 12 (UI/brand foundation)
**Author:** BA / Discovery agent
**Date:** 2026-05-03
**Scope:** Read-only audit of `apps/web/src/`. Inventory only — no proposed fixes.
**Counterpart artefact:** Senior designer walkthrough (separate). The designer reacts to this document; this document does not pre-empt design decisions.

> Note on grep coverage: shell `grep` was sandbox-denied during this run. Hex-literal extraction was performed by reading every CSS module (37 files, ~9.2 kLOC) and a representative sample of JSX surfaces directly. Counts in §1 are exhaustive for `*.module.css`; voice-tone scans in §7 are sampled across the high-traffic surfaces enumerated in §6 and may miss strings buried in low-traffic flows.

---

## 1. Token inventory

Source of truth: `apps/web/src/design/tokens.css` (mounted on `:root`) mirrored in `apps/web/src/design/tokens.ts` (JS values for canvas + Motion). No separate `tokens.css` files; one global declaration block.

### 1.1 Color tokens

| Token | Value | Notes |
|---|---|---|
| `--c-canvas` | `#0a0a0c` | Page bg |
| `--c-bg-deep` | `#000` | Darker band (Landing credentials section) |
| `--c-surface` | `#16181d` | Card bg |
| `--c-surface-elev` | `#1f232a` | Elevated card / modal |
| `--c-surface-pressed` | `#252a33` | Active-press state |
| `--c-surface-overlay` | `rgba(10,10,12,0.72)` | TopBar / BottomNav with blur |
| `--c-text` | `#f0f1f3` | Body |
| `--c-text-muted` | `#7d8290` | Secondary |
| `--c-text-faint` | `#7a8290` | Tertiary (v9.1.4 lifted from `#454a55` for AA) |
| `--c-line` | `rgba(255,255,255,0.06)` | Hairline |
| `--c-line-strong` | `rgba(255,255,255,0.14)` | Strong divider |
| `--c-accent` | `#ff4d00` | Molten orange (locked per §4 sprint decision) |
| `--c-accent-deep` | `#cc3e00` | Hover/pressed |
| `--c-accent-soft` | `rgba(255,77,0,0.10)` | Tint bg |
| `--c-accent-glow` | `rgba(255,77,0,0.22)` | Border tint |
| `--c-accent-light` | `#ff7a3d` | AA-passing on canvas at small sizes |
| `--c-z1`…`--c-z7` | `#3b8ce8 / #4ade80 / #facc15 / #fb923c / #ef4444 / #a855f7 / #a55be0` | Strava-aligned 7-zone scale |
| `--c-success` | `#22c55e` | + `--c-success-soft` `rgba(34,197,94,0.12)` |
| `--c-warn` | `#f59e0b` | + `--c-warn-soft` `rgba(245,158,11,0.12)` |
| `--c-danger` | `#ef4444` | + `--c-danger-soft` `rgba(239,68,68,0.12)` |
| `--c-strava` | `#fc4c02` | Strava brand only |

**Coverage observation:** No semantic ramps (e.g. `--c-accent-50…900`). Only one shade per role plus a "soft" alpha tint and (for accent) `-deep` and `-light`. Sprint 12 spec explicitly addresses this.

### 1.2 Spacing tokens

`--s-px / --s-0-5 / --s-1 / --s-1-5 / --s-2 / --s-2-5 / --s-3 / --s-4 / --s-5 / --s-6 / --s-7 / --s-8 / --s-10 / --s-12 / --s-14 / --s-16 / --s-20 / --s-24 / --s-32`
Values: `1 / 2 / 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 48 / 56 / 64 / 80 / 96 / 128 px`. 4-px base. Mostly clean; `1.5` and `2.5` half-steps exist for chip paddings. Numbers like `0-5` use hyphens for CSS legality.

### 1.3 Radius tokens

`--r-xs (2px) · --r-sm (4px) · --r-md (6px) · --r-lg (10px) · --r-xl (16px) · --r-full (9999px)`. Several CSS modules use literal `4px / 6px` directly instead of `var(--r-sm)` / `var(--r-md)` — see §1.6.

### 1.4 Shadow tokens

`--sh-sm · --sh-md · --sh-lg · --sh-glow · --sh-inner` (5 values). `--sh-glow` is the only accent-tinted shadow (`0 0 0 1px rgba(255,77,0,0.25), 0 8px 28px rgba(255,77,0,0.18)`). One inline-literal heavy shadow exists in `SessionPrefillModal.module.css` desktop variant (`0 20px 60px rgba(0,0,0,0.5)`).

### 1.5 Motion tokens

Durations: `--d-instant (50) / --d-fast (150) / --d-base (220) / --d-slow (420) / --d-lazy (720) / --d-ring (1200)` ms. Easings: `--e-out / --e-in-out / --e-back / --e-sharp`. `prefers-reduced-motion` zeros all to 1 ms (clean). However many components use literal `transition: filter 0.15s` / `0.12s` / `0.85s` / `0.7s` / `1.6s` / `2s` / `220ms` (`Calendar`, `RoutesPicker`, `SessionRoutePicker`, `TodayDossier`, `RideDetail`, `LoadingScreen`, `StreakHeatmap`, `AiCoachCard`, `RideFeedback`) — these short-circuit the reduced-motion universal selector that catches via `animation-duration` + `transition-duration: 1ms !important`, so the safety net does fire, but the values aren't tokenised.

### 1.6 Hex literals in component CSS modules (migration targets)

37 `*.module.css` files audited. Hex literals **only** found in CSS-module fallback `var(--token, #fallback)` patterns and in `rgba()` zone-color recipes. Total occurrences below — counted directly from file reads. **One fully literal hex `#0a0a0c`** appears outside a token in `SessionRoutePicker.module.css:72` (a button text color hardcoded to canvas, not via `var(--c-canvas)`).

| File | Line(s) | Hex / rgba literal | Context | Class |
|---|---|---|---|---|
| `Button/Button.module.css` | 129 | `#fff` | `.strava { color: #fff; }` | true literal — the only one not paraphrasing a zone or warn fallback |
| `AiCoachCard/AiCoachCard.module.css` | 339 | `rgba(255, 77, 0, 0.1)` | `.dayScheduleBtn { background: ... }` | accent-soft re-roll (token exists) |
| `AiCoachCard/AiCoachCard.module.css` | 340 | `rgba(255, 77, 0, 0.28)` | border | accent at non-token alpha |
| `AiCoachCard/AiCoachCard.module.css` | 349 | `rgba(255, 77, 0, 0.18)` | hover bg | accent at non-token alpha |
| `AiPlanCard/AiPlanCard.module.css` | 49–53 | `rgba(239, 68, 68, 0.10)` / `0.32` / `#ef4444` | `.error` | danger fallback in `var(--c-danger, #ef4444)` |
| `AiPlanCard/AiPlanCard.module.css` | 59–69 | `rgba(245, 158, 11, 0.08)` / `0.32` / `#f59e0b` | `.blocked` / `.blockedTitle` | warn alpha + warn fallback |
| `Button/Button.module.css` | 93 | `rgba(255, 77, 0, 0.35)` | focus-ring shadow | accent at non-token alpha |
| `Card/Card.module.css` | 22 | `rgba(255, 77, 0, 0.22)` | `.accent` border | matches `--c-accent-glow` literally |
| `Calendar/Calendar.module.css` | 12, 14, 17, 19, 23 | `rgba(255, 77, 0, ...)` / `rgba(80, 160, 220, 0.15/0.32)` / `#6ab0e0` (info fallback) / `rgba(220, 140, 50, 0.15/0.32)` / `#e0a060` (warn fallback) | event-type pill family | hardcoded color recipes |
| `Calendar/Calendar.module.css` | 36–46 | 7 × `rgba(N, N, N, 0.16/0.32)` | personal-session zone pills (`.pill_personal_z1`..`z7`) | duplicates `--c-z1..z7` channel values literally |
| `Calendar/Calendar.module.css` | 50–52 | `rgba(125, 130, 144, 0.16/0.32)` | `.pill_personal_drawer` | text-muted alpha re-roll |
| `Calendar/Calendar.module.css` | 133 | `rgba(255, 77, 0, 0.12)` | `.pill` base bg | accent alpha |
| `Calendar/Calendar.module.css` | 263, 329 | `rgba(255, 77, 0, 0.04)` | `.weekDayColToday` / `.dayCol.weekDayColToday` | accent ultra-soft |
| `Calendar/Calendar.module.css` | 399 | `rgba(0, 0, 0, 0.55)` | `.drawerBackdrop` | shadow scrim |
| `Calendar/Calendar.module.css` | 532, 533, 554, 566 | `#e0a060` / `#22c55e` | `var(--c-warn, #e0a060)` / `var(--c-success, #22c55e)` | fallback hexes — token always wins, but flagged |
| `ClubEventModal/ClubEventModal.module.css` | 5, 107, 117, 238 | `rgba(8, 9, 11, 0.78)` / `rgba(255, 77, 0, 0.08/0.16)` | backdrop + chip recipes | scrim + accent alpha |
| `ClubCreateModal/ClubCreateModal.module.css` | 5 | `rgba(8, 9, 11, 0.78)` | backdrop | scrim |
| `Dashboard.module.css` | 433 | `rgba(74, 222, 128, 0.04)` | `.weekDayDone` | z2 ultra-soft |
| `Landing.module.css` | 191 | `#000` | `var(--c-bg-deep, #000)` | fallback (token exists) |
| `Landing.module.css` | 618–629 | 7 × `rgba(N, N, N, 0.16/0.32)` + `rgba(255, 77, 0, 0.32)` | `.schedPillZ1..Z7` / `.schedPillClub` | duplicates `--c-z*` literals — same recipe as `Calendar/Calendar.module.css:40–46` |
| `Landing.module.css` | 665 | `rgba(255,77,0,.22)` | `.priceRowEmph` border-bottom | accent alpha |
| `LoadingScreen.module.css` | 28 | `rgba(255, 77, 0, 0.25)` | spinner box-shadow | accent alpha |
| `OnboardingModal/OnboardingModal.module.css` | 5 | `rgba(8, 9, 11, 0.78)` | backdrop | scrim |
| `Pill/Pill.module.css` | 45, 51, 57, 63 | 4 × `rgba(N, N, N, 0.22)` | tone borders (accent / success / warn / danger) | tone-color alpha |
| `PmcStrip/PmcStrip.module.css` | — | clean | — | (audited, no hex) |
| `RoutesPicker/RoutesPicker.module.css` | 286 | `color-mix(in srgb, var(--c-accent) 6%, transparent)` | `.selected` | not a hex but worth noting (only `color-mix` site) |
| `SessionPrefillModal/SessionPrefillModal.module.css` | 9, 39, 171, 172 | `rgba(0, 0, 0, 0.72/0.5)` / `rgba(239, 68, 68, 0.10/0.32)` / `#ef4444` | backdrop + error fallback | scrim + danger fallback |
| `SessionRoutePicker/SessionRoutePicker.module.css` | 72 | **`#0a0a0c`** | `.connectBtn { color: #0a0a0c; }` | **only fully-literal-not-token hex in any module** |
| `SessionRoutePicker/SessionRoutePicker.module.css` | 102, 165, 166, 169, 302 | `#ef4444` (×3 in `var(--c-danger, ...)`) / `rgba(239, 68, 68, 0.10/0.32)` / `rgba(255, 77, 0, 0.08)` | error states + handoff code chip | danger fallback + accent alpha |
| `StreakHeatmap/StreakHeatmap.module.css` | 77, 80, 83, 87 | 3 × `rgba(255, 77, 0, 0.25/0.5/0.75)` + `rgba(255, 77, 0, 0.5)` | heatmap intensity ramp | accent at custom alphas — by design (heat ramp) |
| `TabShared.module.css` | 454 | `#e0a060` | `var(--c-warn, #e0a060)` | warn fallback |
| `TodayDossier/TodayDossier.module.css` | — | clean | — | — |
| `VolumeChart/VolumeChart.module.css` | 119 | `rgba(255, 77, 0, 0.3)` | `.barDistance` glow | accent alpha |
| `WhatsNew/WhatsNew.module.css` | 32 | `rgba(8, 9, 11, 0.78)` | backdrop | scrim |
| `WhatsNext.module.css` | 127, 130 | `rgba(34, 197, 94, 0.22)` / `rgba(255, 77, 0, 0.22)` | `.stat-success` / `.stat-accent` borders | tone-color alpha |
| `ZonePill/ZonePill.module.css` | 36–60 | 7 × `rgba(N, N, N, 0.6/0.7)` | `.dot` box-shadow per zone | duplicates zone channel values |
| `dashboard.schedule.module.css` | 171 | `rgba(255, 77, 0, 0.08)` | filter chip active | accent alpha |

**Summary count:** ~85 hex/rgba literal occurrences across 23 of 37 component CSS modules. Of those, **1 is a true fully-literal non-token hex** (`SessionRoutePicker.connectBtn` color), **~14 are in `var(--token, #fallback)` patterns** (token always wins; cosmetic only), and **~70 are accent-alpha or zone-channel re-rolls** that bypass the token system because no `accent-N%` ramp tokens exist.

**Pattern observation for the designer:** the recurring offender is *no `accent-08`, `accent-12`, `accent-22`, `accent-32` alpha-step tokens* and *no semantic event-color / personal-session-zone pill tokens*. Calendar pill recipes (lines 36–46, 11–25) are duplicated verbatim in `Landing.module.css:618–629`. Sprint 12's three-layer token system (primitive → semantic → component) directly addresses this.

---

## 2. Component inventory

`apps/web/src/components/` — 37 directories, 42 component `.tsx` files. Line counts via `wc -l` (excluding tests). Variants/states inferred from `.module.css` class names + tsx props.

| Directory | Component(s) | Path (.tsx) | LOC | Public props | Variants | States visible |
|---|---|---|---|---|---|---|
| `AiCoachCard` | `AiCoachCard` | `components/AiCoachCard/AiCoachCard.tsx` | 363 | `apiKey, report, loading, error, invalidKey, sessionsPerWeek, onSetSessions, onSetApiKey, onClearApiKey, onGenerate, onClearReport, onScheduleDay?, scheduleDayStates?, scheduleDayError?, stravaExpired?` | api-key-setup / no-report / report | default · loading · error · empty (no key) · invalidKey · stravaExpired · per-day idle/pending/done |
| `AiPlanCard` | `AiPlanCard` | `components/AiPlanCard/AiPlanCard.tsx` | 268 | (none — self-contained, fetches `/api/plan/current`) | feasible / blocked | default · loading · error · empty (no plan) · blocked + alternative · scheduling/scheduled · `auto_updates` chip |
| `AppFooter` | `AppFooter` | `components/AppFooter/AppFooter.tsx` | 66 | none | — | default only |
| `BikeMark` | `BikeMark` | `components/BikeMark/BikeMark.tsx` | 35 | `size?, className?` | — | static SVG |
| `BottomNav` | `BottomNav` | `components/BottomNav/BottomNav.tsx` | 164 | none (reads scope from context) | individual (5 tabs) / club (4 tabs) | default · hover · active · focus-visible · safe-area-inset bottom |
| `Button` | `Button` | `components/Button/Button.tsx` | 56 | `variant?, size?, fullWidth?, withArrow?, href?, ...HTMLAttrs` | primary / secondary / ghost / strava × sm / md / lg | default · hover · active · disabled · focus-visible · withArrow translate-on-hover. **No loading state.** |
| `Calendar/DayCalendarGrid` | `DayCalendarGrid` | `components/Calendar/DayCalendarGrid.tsx` | 143 | view-specific | day | default · hover · cancelled · today · empty |
| `Calendar/MonthCalendarGrid` | `MonthCalendarGrid` | `components/Calendar/MonthCalendarGrid.tsx` | 157 | view-specific | month | default · today · cell-out · cell-clickable · cancelled |
| `Calendar/WeekCalendarGrid` | `WeekCalendarGrid` | `components/Calendar/WeekCalendarGrid.tsx` | 172 | view-specific | week | default · hover · today · clickable hour slot · cancelled |
| `Calendar/EventDetailDrawer` | `EventDetailDrawer` | `components/Calendar/EventDetailDrawer.tsx` | 403 | `event, onClose, clubId?, callerAthleteId?, callerRole?, onEdit?` | club / personal / cancelled / completed | default · cancelled · completed · cancel-club confirm · cancel-personal confirm · mark-done confirm · unsubscribe confirm · pending · error |
| `Card` | `Card` | `components/Card/Card.tsx` | 36 | `tone?, pad?, rule?, accent?, ...` | base / elev / pressed / accent × pad-sm / md / lg | default · accent rule. **No hover/disabled.** |
| `ClubCreateCard` | `ClubCreateCard` | `components/ClubCreateCard/ClubCreateCard.tsx` | 44 | none | — | default (self-hides when user has a club) |
| `ClubCreateModal` | `ClubCreateModal` | `components/ClubCreateModal/ClubCreateModal.tsx` | 169 | `open, onClose, onCreated` | — | default · loading (Save pending) · error |
| `ClubDashboard/ClubDashboard` | `ClubDashboard` | `components/ClubDashboard/ClubDashboard.tsx` | 753 | `clubId, clubName, role` | overview / schedule / members / metrics tabs | default · loading · empty · error · admin/member role · members search/sort/expanded |
| `ClubDashboard/ScheduleTab` | `ScheduleTab` | `components/ClubDashboard/ScheduleTab.tsx` | 250 | `clubId, role, ...` | month / week / day | default · empty · loading · filter-active |
| `ClubEventModal` | `ClubEventModal` | `components/ClubEventModal/ClubEventModal.tsx` | 556 | `open, clubId, onClose, ...edit` | create / edit | default · loading · error · validation · format/surface chips · AI-draft pending |
| `Container` | `Container` | `components/Container/Container.tsx` | 20 | `width?, children` | narrow / base / wide / bleed | static |
| `ContextSwitcher` | `ContextSwitcher` | `components/ContextSwitcher/ContextSwitcher.tsx` | 160 | none (reads context) | — | default · open · hover · focus-visible · active item |
| `Eyebrow` | `Eyebrow` | `components/Eyebrow/Eyebrow.tsx` | 22 | `tone?, rule?, children` | muted / accent × rule | static |
| `GoalEventCard` | `GoalEventCard` | `components/GoalEventCard/GoalEventCard.tsx` | 249 | `event, onSave, onClear` | display / form | default · empty · editing · priority-active · pending |
| `GrainOverlay` | `GrainOverlay` | `components/GrainOverlay/GrainOverlay.tsx` | 21 | `intensity?` | — | inline-SVG noise; `mix-blend-mode: overlay` |
| `OnboardingModal` | `OnboardingModal` | `components/OnboardingModal/OnboardingModal.tsx` | 207 | `open, initial, onSave, onSkip` | — | default · w/kg-preview · validation · pending |
| `Pill` | `Pill` | `components/Pill/Pill.tsx` | 21 | `tone?, dot?, children` | neutral / accent / success / warn / danger | default + animated dot pulse |
| `PmcStrip` | `PmcStrip` | `components/PmcStrip/PmcStrip.tsx` | 67 | `ctl, atl, tsb, ctlDelta, atlDelta, tsbDelta, accent?` | accent-default / fresh / productive / fatigued / overreached / warn | static computation |
| `ProgressRing` | `ProgressRing` | `components/ProgressRing/ProgressRing.tsx` | 83 | `value, size, thickness, eyebrow?, label?, children?` | — | default + animated ring |
| `RideDetail` | `RideDetail` | `components/RideDetail/RideDetail.tsx` | 254 | `rideId, enabled, fallback?` | — | loading · error · loaded |
| `RideFeedback` | `RideFeedbackPanel` | `components/RideFeedback/RideFeedback.tsx` | 72 | `loading, error?, feedback?, onAsk, disabled` | ask-button / panel | default · disabled · loading · error · empty (no fb yet) |
| `RoutesPicker` | `RoutesPicker` | `components/RoutesPicker/RoutesPicker.tsx` | 512 | session-tied | road / mtb / gravel surface; saved/favorite | default · loading · error · empty · selected · ai-discover-fallback · address-edit |
| `SessionPrefillModal` | `SessionPrefillModal` | `components/SessionPrefillModal/SessionPrefillModal.tsx` | 340 | `open, prefill, onClose, onSave, isPending, error` | — | default · validation · estimated-duration hint · pending · error |
| `SessionRoutePicker` | `SessionRoutePicker` | `components/SessionRoutePicker/SessionRoutePicker.tsx` | 745 | `sessionId, zone, durationMinutes, targetElevationM, targetSurface` | tab: generated / Strava saved / RWGPS | default · loading · error · empty · connected/disconnected RWGPS · cards selected |
| `StatTile` | `StatTile` | `components/StatTile/StatTile.tsx` | 29 | `size?, label, value, unit?, delta?, tone?` | sm / md / lg × default / accent / success / warn / danger / z1..z7 | static |
| `StreakHeatmap` | `StreakHeatmap` | `components/StreakHeatmap/StreakHeatmap.tsx` | 71 | `data` | — | l0..l4 intensity, today pulses |
| `TodayDossier` | `TodayDossier` | `components/TodayDossier/TodayDossier.tsx` | 198 | none (self-fetches) | — | default · loading · empty · cancelled · completed |
| `TopBar` | `TopBar` | `components/TopBar/TopBar.tsx` | 30 | `variant?, trailing?` | marketing / app | default + sticky blur backdrop |
| `TopTabs` | `TopTabs` | `components/TopTabs/TopTabs.tsx` | 57 | `ariaLabel, items` | — | default · hover · active · focus-visible (≥600px only) |
| `UserMenu` | `UserMenu` | `components/UserMenu/UserMenu.tsx` | 182 | `username, onSync, onDisconnect, onEditProfile, children` | — | default · open · hover · danger item |
| `VolumeChart` | `VolumeChart` | `components/VolumeChart/VolumeChart.tsx` | 143 | rides | by week / by month | default · animated bars · legend |
| `WhatsNew/WhatsNewBadge` | `WhatsNewBadge` | `components/WhatsNew/WhatsNewBadge.tsx` | 60 | `onOpen` | — | hidden (until new entries) · visible |
| `WhatsNew/WhatsNewModal` | `WhatsNewModal` | `components/WhatsNew/WhatsNewModal.tsx` | 83 | `open, onClose` | — | default · scrolling list |
| `WinsTimeline` | `WinsTimeline` | `components/WinsTimeline/WinsTimeline.tsx` | 55 | `wins` | — | default · empty |
| `WorkoutCard` | `WorkoutCard` | `components/WorkoutCard/WorkoutCard.tsx` | 120 | `workout, onStart` | — | default · stripe segments by zone |
| `ZonePill` | `ZonePill` | `components/ZonePill/ZonePill.tsx` | 33 | `zone, size?, label?` | sm / md × z1..z7 | static + glow per zone |

**State-coverage observations:**

- **Loading state** — handled ad-hoc per component (each modal owns its own `isPending` + button label like "Saving…" / "Cancelling…" / "Generating…"). No shared `<Skeleton />` primitive. Sprint 12 spec calls out skeleton as a rebuild target.
- **Empty state** — handled per-component (`AiCoachCard.empty` / `TodayDossier.empty` / `WinsTimeline.empty` / `RidesTab` / `EventDetailDrawer` cancelled banner). No shared `<EmptyState />` primitive.
- **Error state** — strings written inline in each component; styling lives in each module's `.error` / `.errorMsg` / `.drawerError` / `.demoNote` rules. No central toast; errors surface as inline text or as `Pill tone="danger"`.
- **Disabled state** — `:disabled` rule present on every button-bearing module CSS but using opacity-only (0.45–0.7) — colour signal only, not a textural shift.
- **Hover** — present on every interactive element. Often via `filter: brightness(1.10–1.15)` (Calendar pills / SessionRoutePicker / TodayDossier), occasionally via `border-color` / `background` swap. Inconsistent.

---

## 3. Typography inventory

Source of truth: `apps/web/src/design/tokens.css:11–12`:

```
--font-sans: "Geist", -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: "Geist Mono", ui-monospace, "JetBrains Mono", monospace;
```

**Important:** the codebase uses **Geist + Geist Mono**, NOT Inter (the orchestrator's "universal AI font" tell). The token file's docstring (`tokens.ts:8–22`) explicitly justifies this divergence as anti-AI-slop. Sprint 12's brand decision is to *replace* this with Inter + Source Serif Pro pairing, so the existing situation is a deliberate-but-incomplete pairing (sans + mono, no editorial face).

### 3.1 Unique families

- Primary: `"Geist"` → fallback to `-apple-system, BlinkMacSystemFont, sans-serif`
- Numerals: `"Geist Mono"` → fallback to `ui-monospace, "JetBrains Mono", monospace`

The fonts are referenced via `var(--font-sans)` / `var(--font-mono)` in 100% of CSS modules — **no module imports a third font**. No `@font-face` rule in the codebase: Geist isn't shipped, so the cascade falls through to system-ui in practice. (This is the FOUT/FOIT risk Sprint 12 spec acceptance criterion #5 addresses.)

### 3.2 Type-scale utility classes (in `tokens.css:168–241`)

Mono: `t-mono-xxs / xs / sm / md / lg / xl / 2xl / 3xl / 4xl / 5xl` — sizes from 10/14 to 120/108 px, weight 500–700, tracking from `+0.16em` (small mono) to `-0.045em` (display).
Sans: `t-sans-xs / sm / md / lg / xl / 2xl / 3xl / 4xl / 5xl` — sizes from 12/18 to 96/92 px, weight 400–700, tracking from `0` to `-0.045em`.

Eyebrow: `eyebrow` utility (`500 11px/16px var(--font-mono); letter-spacing: 0.14em; uppercase; color: var(--c-text-muted)`).

Practical observation: **CSS modules rarely use these utility classes** — most write `font: 500 11px/1 var(--font-mono); letter-spacing: 0.16em; text-transform: uppercase;` inline as a shorthand. The eyebrow shorthand is duplicated dozens of times across modules with slight variations (mostly `0.14em` vs `0.16em` letter-spacing).

### 3.3 `font-family` declarations outside tokens

I found two non-token references in CSS modules:
- `Calendar/Calendar.module.css:153, 165, 240, 309, 358, 376, 489` — `font-family: var(--font-mono);` on isolated pill-time / pill-dur / metaRow `dt` rules. These are *correct* uses (still via token), just not bundled into a `font:` shorthand.
- `OnboardingModal.module.css:184` — `font-family: var(--font-sans);` on `.textarea` (correct).

### 3.4 Inline `style={{ fontFamily: ... }}` audit

Reviewed the following high-traffic surfaces by reading the full `.tsx`: `Landing.tsx`, `Dashboard.tsx`, `ConnectScreen.tsx`, `LoadingScreen.tsx`, `JoinClub.tsx`, `dashboard.tsx`, `dashboard.today.tsx`, `dashboard.train.tsx`, `dashboard.you.tsx`, `dashboard.rides.tsx`, `AiCoachCard.tsx`, `Button.tsx`, `EventDetailDrawer.tsx` (first 200 lines), `SessionPrefillModal.tsx`, `AiPlanCard.tsx` (first 100 lines), `ContextSwitcher.tsx` (first 80 lines), `AppFooter.tsx`, `BikeMark.tsx`, `StreakHeatmap.tsx`.
- **Zero** inline `fontFamily` style props were found in the audited surfaces.
- One `style={{ flex: N, background: 'var(--c-z*)' }}` pattern in `Landing.tsx:330–338` (the WorkoutPreview stripe) — uses tokens via `var()`, not a literal.

This is a **clean** result. (Anti-pattern absent.)

---

## 4. Iconography inventory

### 4.1 In-code icon library

Single file: `apps/web/src/design/icons/index.tsx` — 191 LOC. Hand-rolled SVG icons; 1.6 px stroke; `24×24` viewBox; `currentColor`. JSDocs reference the persona served (Marco / Sofia / Léa). Exports:

| Icon | Lines (approx) | Purpose |
|---|---|---|
| `TodayIcon` | 30–37 | clock face — Today tab |
| `TrainIcon` | 41–47 | line peak — Train tab |
| `RidesIcon` | 51–59 | bar chart — Rides tab |
| `YouIcon` | 63–70 | profile silhouette — You tab |
| `OverviewIcon` | 75–84 | 4-square grid — club Overview |
| `ScheduleIcon` | 88–97 | calendar — Schedule |
| `MembersIcon` | 102–111 | three figures — Members |
| `MetricsIcon` | 116–126 | line chart — Metrics |
| `RideIcon` | 137–147 | bicycle — event type "ride" |
| `SocialIcon` | 152–160 | coffee cup — event type "social" |
| `RaceIcon` | 164–175 | chequered flag — event type "race" |
| `SessionIcon` | 181–190 | interval bars — personal session |

Total: 12 hand-rolled icons. The set is **persona-specific** and **purpose-specific**, not a generic library — this is a brand strength noted by the founder (per-`tokens.ts` docstring).

### 4.2 Third-party icon imports

Audited `apps/web/package.json` and `apps/web/package-lock.json` references in source: **no third-party icon library is imported** (`lucide-react`, `react-icons`, `@heroicons/react`, `phosphor-react`, `@phosphor-icons/react`, `remixicon`, `feather-icons` — none present).

**Observation for designer:** the planned Sprint 12 swap to `@phosphor-icons/react` is a net-add of a new dependency. The 12 hand-rolled icons would need replacement (or retention as branded glyphs alongside the broader Phosphor set). The orchestrator-flagged "generic icon-set used for everything" tell is currently **absent** in this codebase.

### 4.3 Emoji used as section icons in JSX

Sampled the high-traffic surfaces. Findings:

| File | Line | Character | Context |
|---|---|---|---|
| `apps/web/src/pages/Landing.tsx` | 287 | `'✓'` | `<span className={styles.forIcon}>{variant === 'for' ? '✓' : '—'}</span>` — checkmark in "For you / Not for you" list |
| `apps/web/src/pages/Landing.tsx` | 287 | `'—'` | em-dash for the "not for" list — typographic, not emoji |
| `apps/web/src/components/AiCoachCard/AiCoachCard.tsx` | 299 | `'✓'` | day-schedule button "done" state |
| `apps/web/src/components/AiCoachCard/AiCoachCard.tsx` | 299 | `'…'` | day-schedule button "pending" state |
| `apps/web/src/components/AiCoachCard/AiCoachCard.tsx` | 303 | `'●'` / `'·'` / `'↗'` | static day-mark fallback (today / rest / scheduled) |
| `apps/web/src/components/Calendar/EventDetailDrawer.tsx` | 240 | `'✓'` | inline in "✓ Completed on …" banner |
| `apps/web/src/components/Calendar/EventDetailDrawer.tsx` | 293 | `'✓'` | inline on "✓ Mark done" button |
| `apps/web/src/components/SessionPrefillModal/SessionPrefillModal.tsx` | 193 | `'×'` | modal close button |
| `apps/web/src/components/Calendar/EventDetailDrawer.tsx` | 144 | `'×'` | drawer close |
| `apps/web/src/routes/dashboard.rides.tsx` | 221, 233 | `'←'` / `'→'` | pagination arrows ("← Prev" / "Next →") |
| `apps/web/src/components/Button/Button.tsx` | 40 | `'→'` | `withArrow` suffix character |
| Various .module.css files | — | `':;\\'` etc. | not emoji, content punctuation only |

**Anti-pattern alignment:** the orchestrator's "📈 Analytics, 🚀 Performance, 💡 Insights"-style emoji is **absent**. Glyphs in use are Unicode typography (`✓ ✗ — · ● → ↗ ×`), not pictograms. The "Buttons with arrow `→` suffix on every CTA" tell is **partial PRESENT** — see §5.

### 4.4 Code-comment emoji

Comments in CSS sometimes mention emojis as labels for state markers (e.g. `Calendar.module.css:14` mentions "✨"). These are not rendered.

---

## 5. AI-aesthetic-tells audit

Cross-checked against `/Users/josereboredo/claude-skills/josemreboredo-orchestrator/references/ai-aesthetic-tells.md`. PRESENT requires file:line evidence; ABSENT means audited and not found in the surfaces sampled; NEEDS_DESIGNER_REVIEW means the call is judgmental.

### 5.1 Color tells

| Tell | Status | Evidence |
|---|---|---|
| Default Tailwind purple/indigo on primary CTAs | **ABSENT** | Primary CTA is `--c-accent: #ff4d00` (molten orange). No purple/indigo anywhere. |
| Slate-only neutrals with no warmth | **NEEDS_DESIGNER_REVIEW** | Neutrals are `#0a0a0c / #16181d / #1f232a / #252a33 / #f0f1f3 / #7d8290 / #7a8290`. They're cool/grey-blue (slate-adjacent). The token file (`tokens.ts:30–43`) *intends* a "dark cockpit" feel, not warmth. Sprint 12 decision #3 calls for "warmth bias on neutrals" — confirming the founder reads the existing palette as cold. |
| Gradient hero backgrounds with no semantic role | **ABSENT** | Landing hero uses `<ClimbProfile>` SVG (a mountain silhouette) + `<GrainOverlay>` (noise texture). The only gradient is `Landing.tsx:437–441`'s `climbGrad` linear gradient on the climb-profile shape — semantically the "climb" itself. |
| More than one accent color per viewport | **ABSENT** | Single accent: `#ff4d00`. Zone colors (z1..z7) are functional, not decorative. Status colors (success/warn/danger) appear only in their semantic contexts. |
| Pure black `#000` text on pure white `#fff` | **ABSENT** | Dark-mode-only product. `--c-canvas: #0a0a0c`, text `#f0f1f3`. The `.strava` button is the only `#fff` use site (`Button.module.css:129`) and it's *button text on Strava-orange*, not body copy. |
| Glassmorphism applied everywhere | **NEEDS_DESIGNER_REVIEW** | `backdrop-filter: blur(...)` appears on `TopBar.module.css:12`, `BottomNav.module.css:20–21`, `UserMenu.module.css:39–40`, `OnboardingModal.module.css:6`, `ClubEventModal.module.css:5`, `SessionPrefillModal.module.css` (no — uses `rgba` only), `WhatsNew.module.css:33`, `Pill.module.css` (no). 4 use sites — sticky/overlay surfaces only, not "everywhere". Walkthrough should confirm the deliberate-motif vs. over-applied call. |

### 5.2 Typography tells

| Tell | Status | Evidence |
|---|---|---|
| Inter alone with no companion | **ABSENT** (different problem) | Geist + Geist Mono pairing. Sans + mono, not sans + serif. Sprint 12 acknowledges this is incomplete (no editorial face) and plans Inter + Source Serif Pro. So the *current* state isn't the "Inter alone" tell — but the planned end-state is "Inter + Source Serif Pro" which the orchestrator's tell document doesn't directly speak to. |
| All headings same weight (font-bold everywhere) | **ABSENT** | Heading weights vary: `700` (`Landing.heroH1`, `Dashboard.greet`, `ConnectScreen.h1`), `600` (`sectionH2`, `eventTitle`, `slimHeaderName`), `500` italic (italic emphasis like `<em>` inside headings, e.g. `Landing.heroH1Italic` weight 400). Active hierarchy via `weight + size + tracking` combo. |
| Tight letter-spacing on body | **ABSENT** | Body uses 0 or `-0.005em` letter-spacing on sans. Tight tracking is reserved for display sizes (`-0.025em` to `-0.045em`). |
| No display face at all | **PRESENT (mild)** | Display headings are *Geist Sans at 96–120 px* + italic `<em>` accent. There is no editorial display family (e.g. serif). Founder's plan in Sprint 12 adds Source Serif Pro to fill this gap. |
| Default line-height 1.5 on everything | **ABSENT** | Tokens scale: 14/10 (1.4) for tiny mono, 18/14 (1.28) for small mono, 28/22 (1.27) for large body, 0.92–0.96 for display. Display lines are tight; body lines are 1.45–1.65. Real type system in place. |

### 5.3 Layout tells

| Tell | Status | Evidence |
|---|---|---|
| Three-feature-card row under the hero | **ABSENT** | `Landing.tsx:172–215` uses *FeatureSpread* — alternating left/right two-column rows with narrative copy + bespoke visuals (PmcStrip, WorkoutPreview, SchedulePreview, ClubLayerPreview). 4 features, asymmetric, content-distinct. |
| Centered hero with two CTAs ("Get Started" + "Learn More") | **ABSENT but related** | Hero has 2 CTAs (`Connect with Strava` + `See what you get`) but copy is specific, not generic. Hero is **left-aligned** with a 880-px max-width container — not centered. Visual anchor: instrument-cluster preview on the right. |
| Perfect symmetry in every section | **ABSENT** | Landing.tsx alternates `featReverse` between rows (`02` and `04` reversed). FeatureSpread is asymmetric by design. |
| Equal-width 2-column heading-left/paragraph-right repeated 4× | **NEEDS_DESIGNER_REVIEW** | The 4 FeatureSpread rows are 2-column on `≥1024px`. They alternate sides and visuals are bespoke per row, but the *structure* is the same template repeated 4×. Designer call. |
| Card grids of 3 or 4 with identical-length copy | **ABSENT** | `bandList` (4 stat tiles in credentials band) — copy is one short label per (e.g. "Coggan zones", "Subscription"). FeatureSpread uses long-form per-item copy of varying length. |
| Every section full-width with centered max-w-7xl, no rhythm | **ABSENT** | `<Container width="narrow|base|wide">` is varied: narrow (720), base (1100), wide (1440). Some sections (`band`, `final`) use `bg-deep` for contrast. Padding alternates `s-12 → s-24 → s-16 → s-32`. There is rhythm. |

### 5.4 Component tells

| Tell | Status | Evidence |
|---|---|---|
| Drop shadow + border + rounded-lg on the same element | **PRESENT** | `Card.module.css` always has `border: 1px solid var(--c-line); border-radius: var(--r-lg);` — and the `accent` variant adds `box-shadow: var(--sh-glow);` (which is a glow-shadow, but still a shadow alongside the border). Same pattern on `OnboardingModal.modal:19–24`, `ClubEventModal.modal:23–28`, `WhatsNew.modal:46–51`. The border+radius+shadow stack is a recurring motif. |
| Avatar + name + role stacked vertically, three across, identical heights | **ABSENT** | `ClubDashboard` Members tab uses a *table-like row layout* (`grid-template-columns: 1fr 120px 120px`) with avatar + name on left, role pill mid, joined-date right. Not a 3-across card grid. |
| Stat counters with no source ("10K+ users, 99.9% uptime…") | **ABSENT (counter-example)** | `Landing.bandList` shows `6` Coggan zones (real, sourced — Coggan defined them), `$0` subscription (real), `100%` your data (descriptive), `<10s` connect (testable). All real, all specific, none vanity. Sprint 12 acceptance criterion #3 asks for *more* real numbers (cyclist counts, club counts) on the rebuilt landing. |
| Generic icon-set used for everything | **ABSENT** | 12 hand-rolled persona-specific icons (§4.1). No `lucide-react` / `heroicons` (§4.2). |
| Buttons with arrow `→` suffix on every CTA | **PRESENT (mild)** | `Button.tsx:40` — `withArrow` adds `→`. Used on `Connect with Strava` (Landing × 2, ConnectScreen, JoinClub), `Save key` (no arrow), `Generate weekly plan` (with arrow), `Connect Ride with GPS` (with arrow), `Connect Strava` on YouTab (with arrow). The arrow is *not* on every button — only on primary "go forward" CTAs. The hover-translate-3px micro-interaction (`Button.module.css:48–50`) reinforces the directional metaphor. Designer call: meaningful pattern or AI tell? |

### 5.5 Copy tells (string scan)

I read the high-traffic JSX surfaces (Landing, ConnectScreen, LoadingScreen, JoinClub, dashboard.\*, AiCoachCard, EventDetailDrawer, SessionPrefillModal, AiPlanCard) and searched for the orchestrator-flagged trigger words. Findings:

| Tell phrase | Status | Evidence |
|---|---|---|
| "Seamless / leverage / elevate / unlock / transform / empower" | **ABSENT** | None of these appear in the audited surfaces. |
| "Welcome aboard!" / "Let's get started 🚀" / "You're all set!" | **ABSENT** | `JoinClub.tsx:109` uses "Welcome to {clubName}." (specific to the club, not the generic "welcome aboard") — distinct in tone. `dashboard.today.tsx:105` says "Welcome back. Generate your AI plan…" — a brand-tone variant; designer call. |
| Headlines that are product-feature-as-marketing ("Powerful. Flexible. Built for teams.") | **ABSENT** | Headlines are activity-rooted: "Train solo. Ride together. Smarter.", "Three riders, one shared toolkit.", "Solo training brain. Plus a club layer.", "Free. Forever. Bring your own key.", "Don't break the chain." — all specific to cycling. |
| Empty states "No items yet" with generic illustration | **ABSENT** | Empty-state strings are specific: "No rides yet. Once you log a ride on Strava it will show up here." (`dashboard.rides.tsx:108`); "No goal event set yet. Add a target race or event to start planning." (`dashboard.train.tsx:184`); "No training data saved yet. Open the profile editor from the top-right menu to set your FTP, weight, and HR Max." (`dashboard.you.tsx:106`); "No rides yet — your dashboard fills in once we have your activity history." (`ConnectScreen.tsx:36–39`). No generic "No items yet"; no illustration slots. |
| Error messages "Oops! Something went wrong." | **ABSENT** | Error strings are domain-specific: "Could not load plan", "Could not generate plan", "Could not join club.", "Couldn't cancel — try again.", "Couldn't save — try again.", "Title is required.", "Date or time is invalid.", "Disconnect failed". None say "Oops". |

### 5.6 Motion tells

| Tell | Status | Evidence |
|---|---|---|
| Fade-in-on-scroll on every section | **PRESENT** | `Landing.tsx:14–18` defines a `fade` const; every `<motion.article>` (FeatureSpread × 4) and the final-CTA section have `initial={{ opacity: 0, y: 30 }}, whileInView` (Landing.tsx:303–306, 250–253). Each dashboard tab section also has identical staggered `initial={{ opacity: 0, y: 16/20 }}` `transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}` (e.g. `dashboard.today.tsx:73–77`, `dashboard.train.tsx:171–175`, `dashboard.you.tsx:97–101`). Same easing curve `[0.4, 0, 0.2, 1]` used 30+ times. |
| Auto-playing background videos | **ABSENT** | No `<video>` elements in the codebase; ClimbProfile is an inline SVG. |
| Scroll-jacked parallax | **ABSENT** | No scroll-bound animations beyond `whileInView` (which fires once per section per `viewport={{ once: true }}`). |
| Hover transforms on every clickable thing (`scale-105`) | **ABSENT** | Hover effects are `filter: brightness(1.1–1.15)`, `border-color` swap, `background` swap, `color` swap, or `translateX(3px)` on the Button arrow. No `scale()` on hover anywhere I read. |

**Tell tally for Phase 1 baseline:** PRESENT 3 (component-stack borders+radius+shadow; mild Button arrow ubiquity; fade-in-on-scroll uniformity). NEEDS_DESIGNER_REVIEW 4 (slate-warmth call; glassmorphism deliberate-motif call; FeatureSpread template-repetition call; Button arrow meaningful-pattern call). ABSENT (clean) on the rest.

The codebase is already past the "obvious AI tell" threshold (≤ 1) on most categories. Sprint 12's foundation work (token ramps, editorial face, copy tone-lock) addresses the residual ones.

---

## 6. Surfaces inventory

Routes via `apps/web/src/routes/__root.tsx` + Tanstack file-routing:

| Surface | File path | One-line description | Top 3 components used | Top 3 token/hex references |
|---|---|---|---|---|
| Marketing landing | `apps/web/src/pages/Landing.tsx` | Anonymous-visitor home; hero + 4 FeatureSpreads + pricing + final CTA | `TopBar`, `Container`, `Button`, plus locally-defined `ClimbProfile`, `WorkoutPreview`, `SchedulePreview`, `ClubLayerPreview`, `FeatureSpread` | `--c-accent` (heroH1Italic, sectionH2 em), `--c-text-muted` (lede), `--c-z1..z7` (schedPill stripes) — **plus 7 `rgba(z*, 0.16/0.32)` literals at lines 618–624** |
| Today (tab) | `apps/web/src/routes/dashboard.today.tsx` | Form + PMC + KPI tiles + `TodayDossier` + year-progress ring | `PmcStrip`, `StatTile`, `TodayDossier` | `--c-accent` (eyebrow), `--c-surface-elev` (Card), `--c-text` (greetLede strong) |
| Train (tab) | `apps/web/src/routes/dashboard.train.tsx` | Goal event editor + `AiPlanCard` + `AiCoachCard` (BYO Anthropic key) | `GoalEventCard`, `AiPlanCard`, `AiCoachCard` | `--c-accent` (start button, eyebrow), `--c-line` (per-day rows), `rgba(255,77,0,0.10)` literal in `AiCoachCard.dayScheduleBtn` |
| Schedule (tab) | `apps/web/src/routes/dashboard.schedule.tsx` | Personal calendar — month/week/day toggle, filter chips, quick-add | `ScheduleTab`, `MonthCalendarGrid`, `EventDetailDrawer` | `--c-accent` (today, active filter), `var(--c-border, var(--c-line))` (grid lines — note the inconsistent `--c-border` token usage), `rgba(255, 77, 0, 0.04)` (today col bg) |
| Drawer (EventDetailDrawer) | `apps/web/src/components/Calendar/EventDetailDrawer.tsx` | Bottom-sheet (mobile) / right-side (desktop) event detail with action footer | `SessionRoutePicker`, `RideIcon/SocialIcon/RaceIcon/SessionIcon`, `Pill` | `rgba(0, 0, 0, 0.55)` backdrop, `--c-canvas` (drawer bg), `--c-warn` (drawerBtnDanger — with `#e0a060` fallback) |
| Settings (You tab) | `apps/web/src/routes/dashboard.you.tsx` | Profile dl + Anthropic key + Strava + RWGPS connect cards | `Card`, `Button`, `Eyebrow` | `--c-accent` (eyebrow tone), `--c-surface-elev` (cards), `--c-text-muted` (apiKeySet) |
| Login (ConnectScreen) | `apps/web/src/pages/ConnectScreen.tsx` | Strava-OAuth gate, fact row, demo-mode hint | `Button`, `TopBar`, `Pill` | `--c-accent` (h1Italic), `--c-text-faint` (demoHint), `--c-line` (factRow border) |
| Onboarding (OnboardingModal) | `apps/web/src/components/OnboardingModal/OnboardingModal.tsx` | FTP / weight / HR-max capture; w/kg preview | `Button`, `Eyebrow`, modal shell only | `rgba(8, 9, 11, 0.78)` backdrop literal, `--c-accent` (title em + accent-soft wkg bg), `--c-line-strong` (input border) |

**Cross-surface notes:**

- Each tab route reuses `TabShared.module.css` for shell padding + greet/profile layout, so visual consistency across `today/train/rides/you` is structural.
- Every modal (`OnboardingModal`, `ClubCreateModal`, `ClubEventModal`, `WhatsNewModal`, `SessionPrefillModal` desktop variant) uses the same backdrop recipe `rgba(8, 9, 11, 0.78)` with `backdrop-filter: blur(8px)`. Five duplicated literals — clear semantic-token candidate (`--c-overlay-scrim`).
- `Calendar.module.css` and `dashboard.schedule.module.css` reference both `--c-border` (which is **not declared** in `tokens.css` — falls through silently) and `--c-line`. The legacy `--c-border` references show up as `var(--c-border, var(--c-line))` in `dashboard.schedule.module.css:114` (intentional fallback) and bare `var(--c-border)` in `Calendar.module.css:188, 200, 232, 248, 268, 414, 502, 516, 519` (bug surface — token undefined, browser falls back to `currentColor` or `initial`).

---

## 7. Voice & tone audit

### 7.1 Trigger-phrase scan

I read the JSX of the surfaces in §6 and the high-traffic component tsx (`AiCoachCard`, `AiPlanCard`, `EventDetailDrawer`, `SessionPrefillModal`, `ContextSwitcher`, `AppFooter`). Trigger-phrase results:

| Phrase | Hit count | Locations |
|---|---|---|
| "Seamless" | 0 | — |
| "leverage" | 0 | — |
| "elevate" | 0 | — |
| "unlock" | 0 | — |
| "transform" | 0 | — |
| "empower" | 0 | — |
| "Welcome aboard" | 0 | — |
| "Let's get started" | 0 | — |
| "Oops! Something went wrong" | 0 | — |
| "No items yet" | 0 | — |
| "Welcome back" | 1 | `dashboard.today.tsx:105` — "Welcome back. Generate your AI plan to get a structured week." (greeting; designer call) |
| "Welcome to" | 1 | `JoinClub.tsx:109` — "Welcome to {clubName}." (club-specific) |

**Result: clean** on the orchestrator's flagged AI-copy tells in the surfaces audited.

### 7.2 Representative empty-state / error / success strings (verbatim)

For the designer's voice review:

1. **Landing hero lede** (`Landing.tsx:48–52`): "Connect Strava in 10 seconds. Join your club, or start one. See what's on this week. An AI coach that learns your form — and helps your crew plan rides together. Free to start. Works on your phone."
2. **For-you list, item 6** (`Landing.tsx:157`): "You'd rather pay for what you use than for a monthly subscription"
3. **Pricing lede** (`Landing.tsx:227–231`): "Free to start. Always free for your club. The only thing you might pay for is your personal AI coach — about 50¢ a month if you use it daily. Skip it and it's $0 forever."
4. **Today dynamic copy** (`dashboard.today.tsx:88–107`): "Form is **fresh**. TSB at +6 — great day to test the legs." / "Form is **overreached**. TSB at -18 — recover hard before the next session." (form-aware; warmer than the orchestrator-flagged "you crushed it")
5. **AiCoachCard empty** (`AiCoachCard.tsx:101–105`): "AI coaching is bring-your-own-key. Each report costs ≈ **$0.02**. Your key stays in this browser. [Get a key →]"
6. **Rides empty** (`dashboard.rides.tsx:108`): "No rides yet. Once you log a ride on Strava it will show up here."
7. **EventDetailDrawer cancelled** (`EventDetailDrawer.tsx:230–233`): "This event was cancelled on {date}."
8. **SessionPrefillModal lede** (`SessionPrefillModal.tsx:200–204`): "We've parsed what we can from the coach. Review the details, adjust the time, and save to your calendar."
9. **JoinClub error phase** (`JoinClub.tsx:118–120`): "That **invite** didn't work." / "The invite link is invalid or has expired."
10. **EventDetailDrawer cancel-personal confirm** (`EventDetailDrawer.tsx:251–253`): "Cancel **{event.title}**?" + "Keep session" / "Yes, cancel"
11. **AppFooter copyright** (`AppFooter.tsx:42`): "© Cadence Club · Strava® is a registered trademark of Strava, Inc." (proper attribution; brand awareness)
12. **AppFooter tagline** (`AppFooter.tsx:18–20`): "A performance training brain. Built quietly, for cycling friends, with no investors."

The voice in evidence: **specific, technically literate, slightly self-aware, dry-British register, declarative**. The Landing copy reads like an editorial product page (e.g. Pas Normal Studios, Rapha journals); error microcopy is plain. There is no marketing-speak. The greatest gap is *consistency at the in-app microcopy level* — Sprint 12's voice/tone-guide locks this; surface-by-surface migration is in Sprint 14+.

---

## 8. Three-question senior gut-check

For the founder + senior designer to answer in the Phase 1 walkthrough. Open questions; not pre-answered.

1. **Could this be any other product?** — i.e. swap the molten orange for a brand X palette, swap Cadence Club for brand Y wordmark, swap "Strava" for any other data source — would the structure, surfaces, copy, and visuals still pass for that other product, or are they specifically *cycling* / specifically *training-brain* / specifically *Marco-Sofia-Léa*?

2. **What does this remind you of?** — first instinct, not a calculated answer. Pas Normal? Strava? Trainerroad? Garmin Connect? An AI-generated SaaS dashboard? A 2008 BBM-era product? The shape of the answer reveals what the brand foundation needs to lean *into* and what it needs to lean *away from*.

3. **What detail would you change first?** — if you could only fix one thing before the rebuild starts, what would it be? (Possible candidates the inventory surfaces: the slate-warmth bias on neutrals / the missing editorial face / the duplicated zone-color recipes / the universal `→` button arrow / the universal fade-in-on-scroll / something the inventory missed.)

---

*Inventory ends. No fixes proposed. Phase 3 work proposes fixes after the designer walkthrough closes Phase 1.*
