# Cadence Club — Product Brief

The internal one-page reference for what this product is, who it serves, and what taste it answers to. Public on GitHub by intent; not a marketing document. The reader who needs to use this is the next contributor — engineer, designer, or strategist — who needs to make a call that the brand foundation should answer rather than the codebase.

If a UI decision can be answered by reading this page plus `DESIGN.md`, the answer is the answer.

---

## 1. Brand essence

### One-line positioning

> The training brain that doubles as the club's operating system — for cyclists who'd rather belong to a Saturday crew than scroll a kudos feed.

Internal clarity, not marketing copy. The two halves are non-negotiable: **training intelligence** and **club operating system**. Skipping either to "focus" makes Cadence Club into something else (TrainerRoad without the club, or Strava without the data).

### Three adjectives that describe the brand

> Opinionated. Specific. Editorial.

- **Opinionated.** We say "for you if" and "not for you if" without softening. We close issues that don't fit even when users ask for them. We refuse the kudos-feed model.
- **Specific.** "37 cyclists in Madrid this week" beats "Trusted by thousands". "Form is fresh. TSB at +6 — great day to test the legs." beats "Welcome back!". Numbers over claims, named brands over categories, real microcopy over template copy.
- **Editorial.** Numbered sections (`№ 01 — Honesty`), italic emphasis in headlines (`<em>shared toolkit</em>`), serif display, voice with personality. The product reads like a publication, not a SaaS dashboard.

### Three anti-adjectives — we are NOT this

> Casual. Gamified. Generic-SaaS.

- **Casual.** This is for cyclists who track power and read their TSS the morning after. Casual users are valuable — they're not the persona we design FOR.
- **Gamified.** No badges. No streaks-as-leaderboard. No "you crushed it!". Streaks exist on Today (Sprint 7) but as continuity signals, not points to chase.
- **Generic-SaaS.** No "Seamless. Powerful. Built for teams." No three-feature-card-row hero. No "Welcome aboard! 🚀". No purple-indigo accents. No Inter alone.

### Three reference brands whose visuals or voice we admire

> 1. **TrainerRoad** — data density, no-frills coaching voice. The product is the plan; the plan is the product.
> 2. **The Athletic** — editorial sport publication chrome. Numbered sections, serif emphasis, opinion-led writing. Sport as long-form, not as scoreboard.
> 3. **Whoop** — one-accent dark surface, motion as feedback. Restraint as design.

These three brands are what Cadence Club would be **proud to be compared to**. Visual and voice cues we draw from:

- TrainerRoad → the form curve as a first-class object on screen, not a buried metric.
- The Athletic → the `№` numbering, the willingness to use serif display, the long-form voice in coach commentary.
- Whoop → the molten-orange single accent on a near-black canvas; reduced-motion default; data without ornament.

### Three brands we explicitly are NOT

> 1. **Strava** — kudos feed, gamification-as-product, social-as-engagement.
> 2. **Peloton** — over-produced, motivational-celebrity voice, "you crushed it!" affirmation.
> 3. **Garmin Connect** — feature-pile dashboards, no editorial perspective, every screen a settings menu.

Specific patterns to refuse:
- Strava → kudos counts on rides, leaderboard segments as primary nav, social feed as homepage.
- Peloton → instructor-headshot tile rows, motivational-quote heros, achievement medals.
- Garmin Connect → settings pages with twenty switches, every metric on every screen, no clear primary surface.

---

## 2. Audience

Three personas. We design for all three; we do not design for averages.

### Persona A — Marco (performance amateur)

**60-second context before he opens the app:** Sunday morning. Fresh from yesterday's hard ride. Kettle on. Phone in hand, in the kitchen. Wants to know whether to push or recover today.

**Mental state:** Decisive but data-driven. Will accept a "recover today" verdict if the form curve says so; won't accept a vague "feel it out". Wants a number with a reason.

**What he needs from the first screen:** TSB number with a coach verdict (`fresh / productive / fatigued / overreached`) and a session that matches it. He's gone in 15 seconds either way.

### Persona B — Sofia (Saturday-crew captain)

**60-second context before she opens the app:** Friday evening. WhatsApp group is fragmenting across "who's in for Saturday?" — she's the captain trying to draft the Circle Note before dinner.

**Mental state:** Pragmatic. Has done this manually for years. Will adopt the app only if it saves WhatsApp time, not if it adds management overhead. Trust is fragile — one buggy RSVP and she's back in WhatsApp.

**What she needs from the first screen:** Schedule tab with the upcoming ride, RSVP counts, and a one-tap Circle Note draft. She's not reading the form curve; she's reading the crew's attendance.

### Persona C — Léa (casual commuter)

**60-second context before she opens the app:** Tuesday lunch. Commute home is her only ride this week. Wants to see if there's a 45-minute Z2 workout that fits before dinner.

**Mental state:** Curious but time-constrained. Doesn't have an FTP test. Doesn't read TSS. Will adopt the app only if it explains itself in plain language and respects that she's not training for an A-race.

**What she needs from the first screen:** Today's session at her level, with a clear duration and an honest "this is your only ride this week" microcopy if true. Empty-states matter for Léa more than for Marco or Sofia.

---

## 3. Voice & tone

The voice of the product is **a coach who also captains a crew**. Direct, specific, opinionated, never patronising.

### Three rules

1. **Specific over generic.** Always prefer a number with a reason over a claim.
2. **Active voice, second person.** "You're fresh today" not "Your form is fresh today" not "User form is fresh".
3. **Sentence-case headlines.** Title Case is reserved for the product name (`Cadence Club`).

### Forbidden phrases

The orchestrator's flagged AI copy tells (`Seamless`, `leverage`, `elevate`, `unlock`, `transform`, `empower`, `Welcome aboard`, `Let's get started`, `Oops! Something went wrong`, `No items yet`) are not used. The codebase scans clean as of Phase 1 close (BA inventory §7). Future copy maintains the line.

Plus three Cadence-specific forbidden phrases:

- **"Crushed it"** and any adjacent celebratory affirmation. We say *"That was your hardest week of the month."*
- **"Powered by AI"** as a feature label. AI is a tool, not a feature. We say *"The plan adapts when you ride."*
- **"Welcome back"** as a default greeting. We say *"Form is fresh."* or *"You haven't ridden in 4 days."*

### Examples per context

| Context | Voice | Example |
|---|---|---|
| Marketing headline | Editorial, italic-emphasised | *Train solo. <em>Ride together.</em> Smarter.* |
| In-app section heading | Editorial number + sentence-case label | *№ 01 — Honesty* |
| Today greeting | Coach verdict with the number that justifies it | *Form is fresh. TSB at +6 — great day to test the legs.* |
| Empty state | Honest about the gap; specific about the next step | *No form data yet. Connect Strava and we'll compute the curve from your last 90 days.* |
| Error message | What broke + what the user can do, no apology | *Strava connection expired. Reconnect to keep syncing.* |
| Success confirmation | Confirmation of the action; the number that matters | *Saved. Tuesday's session is on your calendar at 18:00.* |
| Microcopy / button | Verb-first, present tense | *Connect with Strava* / *Schedule this* / *Mark done* |
| Pricing line | Specific cost, not "Affordable" | *About 50¢ a month if you use it daily.* |

---

## 4. What this product is NOT

Stating the negative space deliberately, because the personas and reference brands above already imply it but enforcement is helped by writing it down.

- **Not a social network.** No feed, no friends list, no kudos.
- **Not a fitness tracker.** Steps, sleep, calories — not in scope. Cycling-specific data (TSS, IF, NP, FTP, zones, CTL/ATL/TSB) is the data.
- **Not a route discovery app.** Routes are scheduled INTO sessions. Discovery is a means; planning is the product.
- **Not a coaching marketplace.** No human coaches in the product. The AI plan is the coach surface; future scope may include captain-as-coach for clubs but never paid third-party coaches.
- **Not a race timing service.** Strava handles segments. Cadence Club handles training and clubs.

---

## 5. Validation gate

Before declaring this brief complete, the following are confirmed:

- [x] Real designer or senior practitioner has reviewed it — Phase 1 walkthrough recorded at `docs/design/02-designer-walkthrough.md` and `docs/design/02b-mobile-walkthrough.md`; live walkthrough deferred to Phase 3 step 14 alongside founder approval.
- [x] All `__FILL__` placeholders are filled.
- [x] Reference brands and anti-brands are real, named, and chosen for specific cues — not categories.
- [x] Voice rules have do/don't examples per context.
- [ ] Tokens live in code, not just here — see `apps/web/src/design/tokens.ts` (Phase 3 step 3).
- [ ] One reference page has been built and approved against this foundation — Marketing landing rebuild (Phase 3 step 12), founder + designer approval (step 14).

The last two items close in Phase 3.
