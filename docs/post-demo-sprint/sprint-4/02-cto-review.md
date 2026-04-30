# CTO Review — Sprint 4 · Clubs Expansion (Issue #53)
**Author:** CTO (Opus, judgment synthesis)
**Date:** 2026-04-30
**Inputs:** `01-clubs-experience-design.md` (BA+UX), `#53` issue body + wireframes + founder mid-stream notes
**Product baseline:** v9.5.2 (live)

---

## Headline

The expansion materially **outgrows the original Sprint 3 Phase 4 budget** (~10h roster slice). The BA+UX doc lays out 4 tabs, 6 user stories, 6 AI embedding points, 3 new D1 tables, 4 new endpoints, and a Worker cron handler. Honest sizing: **~50-65h of engineering**, not 10h.

This is its own sprint — **Sprint 4 = Clubs Expansion**. The originally-planned Sprint 4 features (`#49`, `#50`, `#52`) push to Sprint 5.

The AI embedding strategy in §B is unusually disciplined for a product feature: **5 of 6 AI moments are zero-cost or weekly-cron Haiku**, only 1 is on-demand BYOK Sonnet. That keeps the per-club cost ceiling at ~$0.05-0.15/month even at 100 clubs.

---

## §A. Risk + scope (5-phase plan, ~52h)

| Phase | Release | Scope | Effort | Risk |
|---|---|---|---|---|
| **1** | v9.6.0 | 4-tab IA shell + Overview tab (no AI yet); slim sticky header (no cover hero); stat tiles; basic Upcoming list (no readiness dots); existing invite link block; Circle Note as plain admin text. **`#53` roster slice partial-credit closes here.** | ~10h | LOW |
| **2** | v9.6.1 | Members tab full (FTP-default sort, role badges, search, sort dropdown, member-row drawer). FTP masking by default per founder Q4. New `event_rsvps` table + `POST /api/clubs/:id/events/:eventId/rsvp` endpoint. RSVP wired into Overview Upcoming. | ~10h | LOW |
| **3** | v9.6.2 | Schedule tab calendar view + filter sidebar. Conflict pill (admin-only). New `GET /api/clubs/:id/events?range=` for the month query. | ~9h | MED |
| **4** | v9.6.3 | AI moments — Phase A (statistical, no AI cost): readiness dots (B-AI-2), members trend arrow (B-AI-3). Wires `daily_load` into the Overview Upcoming + Members rows. **Cron infrastructure lands here** (Worker `scheduled` export). | ~7h | LOW |
| **5** | v9.6.4 | AI moments — Phase B (LLM-driven): Circle Note auto-draft (B-AI-1), Metrics tab + AI insights feed (B-AI-5), post-ride callout (B-AI-6). New `club_circle_notes` + `club_metrics_rollup` tables. Schedule "Suggested for you" (B-AI-4) ships only if BYOK toggle is in user prefs. | ~16h | MED |

**Total:** ~52h across 5 releases. Each phase is independently deployable and demoable.

---

## §B. Decision gates (5 ADRs need founder approval)

The BA+UX doc surfaced 6 open questions (§F). My recommendations:

| ADR | Question | My recommendation |
|---|---|---|
| **S4.1** | Members rail bar value `312 V` — what does V mean? | **Volume in km / week** (matches `Hours/Mo` axis already in Members table; mono unit avoids ambiguity). Drop the `V` suffix entirely; just show "312 km · week". |
| **S4.2** | Calendar event types — only RIDE pills, or also café/race/training-camp pills? | **Multi-type from day one.** `club_events.event_type` already exists in migration 0002 (per architect spec). Use icons (🚴 ride, ☕ social, 🏁 race) — colour-coded would clash with the conflict pill amber. |
| **S4.3** | Circle Note authorship | **Option (b): AI-drafted with free-text editing.** Highest-leverage UX (admin saves drafting time but has full control); cost is a single weekly Haiku call per club (~$0.001). |
| **S4.4** | FTP privacy default for Members tab | **Masked by default for Member role; opt-in toggle.** Captain + Pace Setter see all. Aligns with persona C's intimidation risk + persona A's competitive needs (A is generally Captain or Pace Setter in his own club anyway). |
| **S4.5** | RSVP visibility | **Avatar grid + count visible to all.** Social presence is the value; if a member doesn't want to be visible, they don't RSVP. Mirrors how WhatsApp / Slack threads work. |

ADR-S4.6 (`Q6` — Metrics leaderboard ranking basis) folds into Phase 5 implementation; multi-axis sort is small extra work — defer the founder call.

---

## §C. Strategy notes (Opus judgment)

1. **Phase ordering serves founder optionality.** If Phase 4 (AI moments — statistical) is enough to pass demo, Phase 5 (LLM moments) can slip to Sprint 5 without breaking anything. Statistical moments alone (readiness dots, trend arrows) carry meaningful value to Persona A.

2. **The cron handler is load-bearing.** Phase 4 introduces the Worker `scheduled` export pattern — first cron in this codebase. Spec it carefully: weekly Monday 06:00 UTC, single run that updates trend rolls + (in Phase 5) Circle Note drafts + metrics rollup. Failure mode: skip the run, log via `safeWarn`, retry next week. Don't introduce a queue or retry layer.

3. **`club_metrics_rollup` is the privacy boundary.** No Phase 5 LLM call ever sees raw activity rows or individual `athlete_id`-keyed data. Pre-aggregate to club-level integers + ratios server-side, then send to Haiku. This is the right pattern for a multi-tenant club product later.

4. **The originally-planned Sprint 4 features (#49 #50 #52) push to Sprint 5.** Annual goal + AI forecast + You-tab profile expansion are still valuable, but the founder direction is clear: clubs is the differentiator, ship it next. Document the slip in `#49 #50 #52` issues.

5. **Don't bundle phases for "fewer deploys."** Per Sprint 1 retro rule "one risk theme per release" — 5 releases is correct here. Each is small, each is smoke-testable.

---

## §D. Founder approval gate

Before any code lands, please confirm:

1. **5 ADRs (S4.1–S4.5)** — sign off as-is or override
2. **Sprint 4 = Clubs (~52h, 5 phases v9.6.0 → v9.6.4)** — confirms the originally-planned Sprint 4 (#49/#50/#52) slips to Sprint 5
3. **Cron handler** — first cron in this codebase, accept the weekly Monday pattern + log-and-skip failure mode

After approval, the architect doc (Sonnet, §C tables and SQL) can land in 1-2 dispatches and Phase 1 can start.

---

*End of CTO Review.*
