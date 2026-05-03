# Sprint 12 — Designer walkthrough

**Date:** 2026-05-03
**Reviewer:** Brand Designer + Experience Designer (project orchestrator roles)
**Scope:** Marketing landing, Today, Train, Schedule, EventDetailDrawer, Settings (You) — surface-by-surface senior critique against `references/ai-aesthetic-tells.md` and `references/senior-pro-markers.md`.
**Source-only review:** this walkthrough is read from code (`apps/web/src/`), not from rendered screens. The designer's live walkthrough may surface tells that read worse on-screen than they read in source — final calibration belongs to the live review.

---

## Headline read

The product is **more crafted than the "AI-generated" verdict implies, but has documented gaps**. The team already has real component vocabulary (`PmcStrip`, `ProgressRing`, `ZonePill`, `Eyebrow`, `Pill`, custom `ClimbProfile` SVG), one accent enforced (`#ff4d00` molten orange), accessibility-conscious tokens (contrast lifts at v9.1.4), reduced-motion at the token level, custom easing curves (not framework defaults), opinionated voice ("Don't break the chain", "Three riders, one shared toolkit"), and editorial scaffolding (`№ 01 — Honesty`, `№ 02 — The product`).

The "AI-generated" feedback is **directionally correct but partially overcalibrated**. The actual gaps are concrete and fixable:

1. **No editorial type pairing.** Current setup is Geist + Geist Mono — both Vercel typefaces, both geometric, neither editorial. The `№ 01` framing wants a serif; instead it gets Geist sans. This is the single highest-leverage change.
2. **Color palette has no ramps.** Tokens declare `--c-accent`, `--c-accent-deep`, `--c-accent-soft`, `--c-accent-glow`, `--c-accent-light` (5 tints) but no `50–950` ramp. Neutrals are the same — `--c-canvas`, `--c-bg-deep`, `--c-surface`, `--c-surface-elev`, `--c-surface-pressed`, `--c-surface-overlay` (6 surfaces) without a systemic ramp underneath.
3. **No semantic → component token layer.** Tokens are flat (`--c-text`, `--c-line`, `--sh-md`). Components reference primitives directly. This is the structural change that makes future palette/dark-mode/seasonal-theme work cheap.
4. **Stat-counters-without-source risk.** Hero (`10s setup`, `$0`, `∞`, `100%`) and Credentials band (`6` Coggan zones, `$0`, `100%`, `<10s`) both use the orchestrator-flagged "stat counters with no source" pattern. The `∞ token refresh` in particular reads as marketing copy, not a fact.
5. **Iconography is a mix.** `apps/web/src/design/icons/` contains hand-rolled custom SVGs (good) but the Landing's `ForList` uses `'✓'` and `'—'` unicode glyphs, and the codebase has emoji-as-section-icon usage that the orchestrator flags as a tell.
6. **Content drift on "100% local-first".** Hero claims `100% local-first` (`apps/web/src/pages/Landing.tsx:67`) — this was true pre-v10.9.0 but is no longer accurate after the Strava OAuth → D1 migration (Migration 0012). Tokens live server-side now. **This is a content correctness issue, not a design issue.** Flag for legal/marketing review.
7. **`withArrow` on every primary CTA.** `Button` has a `withArrow` prop that ships an arrow `→` on every primary CTA (Landing hero, Final CTA, TopBar). Orchestrator tells flag this as a default-AI pattern.

None of these are fatal. All are addressable in Sprint 12 Phase 3.

---

## Surface 1 — Marketing landing

**File:** `apps/web/src/pages/Landing.tsx` (459 lines) + `Landing.module.css` (716 lines)

### Composition
TopBar with single Connect CTA → Hero (Pill + Italic-emphasised H1 + lede + 2-CTA pair + 4-stat row + instrument-cluster preview) → Credentials band (4-stat row) → For-you/Not-for-you grid → 4 FeatureSpread sections (alternating reverse) → 5-row Pricing grid → Final CTA (ClimbProfile + Eyebrow + Italic H2 + lede + button + footnote).

### Senior-pro markers present
- Editorial section numbering: `№ 01 — Honesty`, `№ 02 — The product`, `№ 03 — Pricing`, with `Eyebrow rule tone="accent"` decoration.
- Italic emphasis in headlines via `<em>` ("Plus a club layer", "Don't break the chain", "shared toolkit"). Real type-as-design move, not just bold.
- Anti-pattern-aware framing: "For you / Not for you" deliberately rejects the bland-everyone marketing pose.
- Specific claims with numbers: "about 50¢ a month if you use it daily" — concrete, not "Affordable!". "Up to you." in pricing is voice with personality.
- Custom ProgressRing + PmcStrip + ZonePill in the instrument-cluster preview — the visual is the value prop, not a screenshot. This is rare and well-done.
- `ClimbProfile` and `GrainOverlay` give the hero texture without resorting to gradient-mesh-tells.

### AI-aesthetic tells present
| Tell | File:line | Severity | Notes |
|---|---|---|---|
| Stat counters with no source (`10s`, `$0`, `∞`, `100%`) | `Landing.tsx:63-68` | Medium | The orchestrator flag is "stat counters with no source". `∞ token refresh` reads as marketing, not data. |
| Two-CTA centred hero | `Landing.tsx:54-61` | Low | "Connect with Strava" + "See what you get" — the secondary is a jump-link not a full secondary CTA, mitigates somewhat. Founder/designer call. |
| `withArrow` on primary CTA (every instance) | `Landing.tsx:25, 55, 263` | Medium | Orchestrator tell: "Buttons with arrow → suffix on every CTA". |
| Three-feature-card / feature-grid risk | `Landing.tsx:182-214` | Low | Four FeatureSpreads with alternating reverse + custom visuals dodges the "three identical card row" anti-pattern. Marginal pass. |
| Inter-alone risk | tokens.css `--font-sans: "Geist"` | High | Geist is not Inter, but it IS a single sans family with no serif companion. The `№ 01` framing wants a serif. |
| Equal-width 2-column repeated | `Landing.module.css` `.featGrid` | Low | The `reverse` flag breaks symmetry intentionally. Marginal pass. |
| Stock claim "Free. Forever." | `Landing.tsx:223-225` | Low | Could be tightened — "Free. Forever." is borderline AI-marketing. Voice review needed. |

### Content drift
- `100% local-first` (line 67) — **false post-v10.9.0**. Tokens are server-side now. Replace with something defensible: `Edge-first` or `Cloudflare workers + your browser`.

### What I would change first
**Land an editorial serif for the `№` framing and the section H2s.** The numbered eyebrows are the boldest editorial move on the page; pairing them with Geist sans flattens the gravitas. Source Serif Pro (already locked at sprint open) at 600 weight on the H2s would unlock this without changing layout.

Second priority: rewrite the hero stat row + credentials band so each number has a source attribution (e.g. `10s setup → typical Strava OAuth round-trip`). The `∞ token refresh` line in particular needs to either go or get a footnote.

---

## Surface 2 — Today

**File:** `apps/web/src/routes/dashboard.today.tsx` (187 lines) + `routes/TabShared.module.css`

### Composition
Eyebrow ("Today · {weekday, date}") → form-state lede paragraph (one of four states keyed off TSB) → PmcStrip → 4 StatTile row (Week TSS / Week hours / FTP / W/kg) → optional proxy-note → TodayDossier → Year-forecast Card (ProgressRing + projection text).

### Senior-pro markers present
- The form-state lede is a strong editorial moment: `Form is fresh. TSB at +6 — great day to test the legs.` That's real coach voice, not "Welcome aboard!".
- Conditional copy by TSB band (`fresh / overreached / fatigued / productive`) shows microcopy variation per state — orchestrator senior marker.
- ProgressRing with explicit `value`, `eyebrow`, `label`, and slot for the number — well-architected component.
- Clean information hierarchy: Eyebrow → Lede → Strip → Tiles → Card. No redundant chrome.
- Proxy note (`TSS is a duration-based proxy until you set FTP`) is honest microcopy, not glossed-over.

### AI-aesthetic tells present
| Tell | File:line | Severity | Notes |
|---|---|---|---|
| "Welcome back" empty-state copy | `dashboard.today.tsx:105` | Low | Better than "Welcome aboard!" but still generic. Voice opportunity. |
| Stat-tile row of 4 identical-shape tiles | `dashboard.today.tsx:120-125` | Low | Four StatTiles in a row reads as the orchestrator's "stat counter row" pattern, mitigated by domain-specific labels (TSS / hours / FTP / W/kg). Acceptable in an in-app dashboard. |
| Year-progress card has no comparator | `dashboard.today.tsx:152-182` | Medium | Just shows "X% of yearly target" + projection. No comparator (last year? cohort?). Senior dashboard would compare. |

### What I would change first
**Stat tiles need a delta or sparkline.** Today they're just static numbers. Adding a 7-day delta (`Week TSS · 423 (+18 vs prior week)`) or a tiny sparkline lifts them from "number labels" to "form data" — and matches the editorial tone the lede already sets.

Second: the "Welcome back" empty state is a missed voice moment. Coach-voice would be more like "No form data yet. Connect Strava and we'll compute the curve from your last 90 days."

---

## Surface 3 — Train

**File:** `apps/web/src/routes/dashboard.train.tsx` (260 lines)

### Composition
Composition not fully read in this pass (260 lines; main body is AI plan card + per-day Schedule buttons + prefill modal flow + goal event card). High-level: Train owns the planning surface.

### Observed strengths
- Per-day "+ Schedule" pattern with idle/pending/done state per day is a real interaction design — not a generic list.
- AiPlanCard, AiCoachCard, GoalEventCard are domain-specific components, not generic content cards.
- Prefill modal pattern (open modal → user reviews → confirm → POST) is the right architecture for AI-suggested actions.

### AI-aesthetic tells likely present
- Card stack of equal-weight rows for the AI weekly plan — risk of "feature card grid" feel applied to a list. Worth designer review on screen.
- Empty state when no plan generated yet — voice opportunity (didn't read this branch in detail).

### What I would change first
**Defer most Train-tab redesign to Sprint 14+** when the foundation is laid. This sprint touches Train only enough to verify the new tokens don't break it (Phase 5 parity audit). Train deserves its own focused surface-refresh sprint after foundations land.

---

## Surface 4 — Schedule

**File:** `apps/web/src/routes/dashboard.schedule.tsx` (440 lines)

Calendar surface — `MonthCalendarGrid` / `WeekCalendarGrid` / `DayCalendarGrid` switching, with `EventDetailDrawer`. Visually the most "branded" in-app surface (zone-coloured pills, custom hour grid, time-blocked event rendering from v9.12.3).

### Strengths
- Zone-coloured pills are a real domain-specific visual language.
- Px-based positioning with `computeOverlapColumns` (Sprint 10) — engineering and design aligned around the calendar reading correctly.
- Pills carry both time chip (mono) and title (sans) — type-as-hierarchy move.

### Tells
- The empty-day microcopy and the cancelled-event filter chip likely need voice review; not read in this pass.

### What I would change first
**No structural changes this sprint.** Schedule is in good shape post-Sprint 10. Token refactor only.

---

## Surface 5 — EventDetailDrawer

**File:** `apps/web/src/components/Calendar/EventDetailDrawer.tsx` (403 lines)

### Observed
- The drawer is the embedded route picker host (Sprint 10's `recurring_group_id` banner; Sprint 7's route-picker integration).
- 30 kB gzipped — fat. Lazy-load is overdue.
- Drawer-as-modal-replacement (Sprint 5's `feedback_pattern-replacement.md`) is the right structural choice; this comment is about visual polish.

### Tells
- Drawer chrome (header / close button / scroll behaviour) likely uses default rounded-lg + shadow + border combo. Orchestrator flag: "drop shadow + border + rounded-lg on the same element ('belt and suspenders' depth)". Worth checking.
- States — loading, error, no-route-found, route-picked — likely under-designed; haven't read this pass.

### What I would change first
**Pick one depth strategy** (shadow OR border, not both) and apply consistently across drawer + cards. Then audit the drawer's 8 states against the new component matrix.

---

## Surface 6 — Settings (You tab)

**File:** `apps/web/src/routes/dashboard.you.tsx` (277 lines)

### Composition
Container → 4 motion sections (Training profile / AI Coach Anthropic key / Strava connection / RWGPS connection — added Sprint 10).

### Strengths
- Motion stagger via `transition delay 0, 0.1, 0.2, 0.25` on the 4 sections is a real motion-as-language move. Orchestrator senior marker.
- Each card is self-contained with its own loading / connected / disconnected state — exactly what the personal-standards "states designed before merging" rule asks for.
- Inline error state for RWGPS disconnect (`{rwgpsError && ...}`) — small but real.

### Tells
- All four sections wrap in `Card tone="elev" pad="md"` with `Eyebrow rule tone="accent"` — same template four times. Risk of orchestrator "perfect symmetry, no variable rhythm" tell. Could break by making the Training profile card wider / hero-style and the API-key + connection cards narrower.
- API key form copy (`AI coaching is bring-your-own-key. Each plan costs ≈ $0.02. Your key stays in this browser.`) is solid coach-voice.
- "Get a key →" link uses arrow-suffix pattern in a benign way (it's a real "go elsewhere" affordance, not a CTA decoration). OK.

### What I would change first
**Variable rhythm.** Make the Training profile card hero-sized at the top (full-width, big numbers), and the three connection cards a 3-column grid below. Same components, different rhythm — eliminates the "four identical sections" tell.

---

## Top-3 priorities for Phase 3 (recommended order)

1. **Type pairing.** Add Source Serif Pro for display + section H2s (`№ 01 — Honesty`, all `<h2 className={styles.sectionH2}>`, all `<h2 className={styles.finalH2}>`). Geist stays as body + UI. This is one font-family addition, ~50 KB after subsetting, and unlocks editorial gravitas across every surface where the `<em>` italics already do half the work.
2. **Token three-layer refactor.** Primitive ramps → semantic intent → component scope. The current flat token set (`--c-accent`, `--c-canvas`, etc.) becomes Layer 2 (semantic) backed by Layer 1 ramps; component CSS modules consume Layer 3 tokens. No visual change at first; sets up dark-mode, seasonal themes, and palette evolution as cheap operations.
3. **Stat-row source attribution.** Every number on the Marketing landing gets a footnote-style source. `10s setup → typical Strava OAuth round-trip`, `$0/mo → 100% of features free`, etc. Removes the AI-generated marketing-copy tell while keeping the punchy hero shape. Also: kill `∞ token refresh` outright (it's not a number) and replace `100% local-first` (false post-v10.9.0).

---

## What this walkthrough deliberately did NOT cover

- **Onboarding flow** (`OnboardingModal`, `ConnectScreen`, `JoinClub`) — first-time-user experience deserves its own walkthrough; not in Sprint 12 scope.
- **Mobile-specific layout** — read from desktop source only. Mobile tells (BottomNav density, touch-target compliance, safe-area insets) need a device walkthrough.
- **Performance** — no Lighthouse / FCP / CLS measurements taken. Backlog.
- **Accessibility** — focus-ring is tokenised (`--ring-focus`) and contrast is documented at v9.1.4, but no screen-reader pass done in this walkthrough.

These belong in a follow-up walkthrough or in Sprint 14+ surface-refresh sprints.

---

## Three senior gut-check questions (for the founder + designer)

These are the orchestrator's `senior-pro-markers.md` framing. Bring real answers to the Phase 1 close.

1. **"Could this be any other product?"**
   *My read:* No. The PmcStrip + ZonePill + ClimbProfile + zone-colour-coded calendar are domain-specific to cycling-with-power-data. The voice ("Don't break the chain", "shared toolkit", "fresh / overreached / fatigued / productive") is coach-and-captain, not generic SaaS. The Marketing landing's "For you / Not for you" framing is opinionated. Brand foundation is partial; voice is real.

2. **"What does this remind you of?"**
   *My read:* The closest reference brand is **TrainerRoad** (training-data-as-design, dense numbers, no-frills voice) crossed with **Whoop** (one accent, dark surface, motion as feedback). Source Serif Pro plus the `№` framing pulls it toward editorial publications (e.g. *The Athletic* / *Bicycling*) which would be a good direction; the brand foundation should pick reference brands deliberately.

3. **"What detail would you change first?"**
   *My read:* The Marketing landing hero `100% local-first` claim. It's a content correctness bug masquerading as a design tell. Replace with something defensible the same hour the brand foundation lands.

---

## Process notes for the live walkthrough

When the live designer walkthrough runs, calibrate against this document:
- If the designer flags a tell I marked Medium/High that is actually fine on screen — record the disagreement and pick the designer's read.
- If the designer flags a tell I marked Low that they consider blocking — same. The designer's eye trumps the source-only review on visual matters.
- Specifically ask the designer about: typography pairing recommendation, palette ramp generation method (OKLCH vs HSL vs hand-tuned), iconography choice (Phosphor vs custom curated set), and whether the `№` editorial framing is worth doubling-down on or scaling back.
