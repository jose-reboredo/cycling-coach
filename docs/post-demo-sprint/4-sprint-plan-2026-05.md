# Sprint 5–8 Plan + Retro/Post-mortem Process

**Author:** CTO + Strategist
**Date:** 2026-05-01
**Inputs:** Sprint 1–4 planning docs, `docs/retros/sprint-1.md`, `RELEASE_CHECKLIST.md`, CHANGELOG (v9.3.0 → v9.6.5), open backlog (13 issues), process directives
**Product baseline:** v9.6.5 (live)
**Decisions locked:** 2026-05-01 (see §D)

---

## §A — Strategist view

### Positioning vs Strava / Komoot / TrainerRoad (2026)

| Player | Strength | Cadence Club's gap to close |
|---|---|---|
| **Strava** | Social feed, kudos, segment leaderboards | Not a training tool; CTL/ATL/TSB buried four taps deep behind Premium |
| **Komoot** | Route discovery, turn-by-turn, offline | No training brain; route-only product |
| **TrainerRoad** | Plan engine, hard science, indoor focus | Subscription wall ($199/yr); no club layer; cold UX |
| **Cadence Club** | PMC + plan + route picker + **club layer with AI embedded** at $0/mo personal cost | Ship the differentiator (clubs Phase 3–5) and own it |

**Net positioning:** *"The training brain you'd build for your Saturday crew."* Free where Strava+TR charge subscriptions; opinionated where Komoot is feature-flat; collective where TrainerRoad is solo.

### Persona priorities — who's most underserved next 4 sprints

- **Persona A (Marco — performance amateur):** Already well-served by v9.6.x. Open need: `#49` AI year-end forecast + `#52` full You-tab + `#5` volume tooltips. Not the wedge.
- **Persona B (Sofia — Saturday-crew captain):** Underserved. Has Phase 1 Overview + Phase 2 Members tab + RSVP, but Schedule tab + Circle Note + member share-flow (`#56`) are still missing. **This is the wedge for Q3 2026.**
- **Persona C (Léa — casual commuter):** Highest growth potential. Has FTP-private-by-default (v9.6.2). Needs: a low-friction join flow (`#56`), zero-AI-knowledge onboarding, and the Schedule tab so she knows when rides are happening.

**Strategy:** Sprint 5–6 = Persona B/C wedge (clubs Phase 3–5 + share/invite). Sprint 7–8 = Persona A loop closure (`#49`/`#52`/`#5`) + tech-debt retirement.

### 3 candidate differentiators — pick one

| # | Differentiator | Why it matters | Cost |
|---|---|---|---|
| **i** | **Saturday Crew operating system** — RSVPs, weekly Circle Note, conflict pills, AI-suggested rides | No competitor has this; matches founder's "AI-embedded experience" bet | High (~32h S5+S6) |
| **ii** | **AI personal coach loop** — `#49` forecast + `#52` profile + adaptive plan | Per-rider value but commoditised by TrainerRoad | Med (~30h S7) |
| **iii** | **Mobile-first PWA polish** — offline PMC, iOS standalone, Lighthouse 95+ | Competitive parity, not differentiation | Low (~20h S8) |

**Pick: (i) Saturday Crew OS.** Unique in the market, founder's strategic bet, and finishes a coherent story. (ii) and (iii) become S7 and S8 scope.

---

## §B — CTO view

### Engineering capacity model

| Sprint | Planning | Implementation | Verification | Daily-quota total | Notes |
|---|---|---|---|---|---|
| 1 | ~30% | ~40% | ~10% (4 hotfixes) | ~80% | Hotfix cascade |
| 2 | ~25% | ~35% | ~5% | ~65% | Regressions + features bundled |
| 3 | ~10% | ~30% | ~5% | ~45% | CTO-only plan template; cost-conscious |
| 4 | ~10% | ~50% | ~10% (v9.6.4) | ~70% | Clubs Phase 1+2 + 3 hotfixes |
| **5 (target)** | **~8%** | **~40%** | **~7%** | **~55%** | Apply economy model + paired verification dispatch |
| **6 (target)** | **~6%** | **~35%** | **~7%** | **~48%** | LLM moments — verification budget bumped |
| **7 (target)** | **~8%** | **~30%** | **~5%** | **~43%** | Personal-loop work; less coupled risk |
| **8 (target)** | **~5%** | **~25%** | **~5%** | **~35%** | Tech debt; mostly mechanical |

Trend: planning cost dropped ~4× from S1 → S3 by adopting CTO-only single-doc planning; held in S4. Hold the line in S5+.

### Sub-agent reliability patterns from this session

| Pattern | S1 | S2 | S3 | S4 | Sprint 5+ rule |
|---|---|---|---|---|---|
| Skill-hijack (Sonnet pivots to permissions audit / settings.json) | 1× | 0× | 2× | 1× | Every Sonnet brief opens with "do not invoke skills/plugins"; first dispatch is read-only |
| Misreported "blocked" (files actually written) | 1× | 0× | 1× | 0× | Verify with `git status` before re-dispatching |
| SQL column-name hallucination (`elapsed_time` vs `moving_time`) | — | — | — | 1× (v9.6.0) | Pre-commit dispatch: separate Sonnet greps `schema.sql` for every column referenced |

### Retro-rule adherence (Sprint 1 retro → Sprints 2–4)

| Rule | S2 | S3 | S4 | Notable example |
|---|---|---|---|---|
| Pre-deploy verification (legacy parity + smoke what changed) | ✅ | ⚠ partial | ❌ broke at v9.6.1 | v9.6.1 OAuth callback CSP — parity audit on `#15` would have caught it |
| Mobile-viewport CI gate | ✅ | ✅ | ✅ | `mobile-tabs.spec.ts` has held since S2 |
| `git log -20` before destructive ops | ✅ | ✅ | ✅ | No revert-clobber repeats since S1 |
| Smoke what changed, not what's stable | ⚠ | ✅ | ❌ broke at v9.6.2 | v9.6.2 RSVP `if (!rl.ok)` — would have been caught by an actual RSVP+refetch smoke, not a 200-OK probe |
| Pre-coding scope alignment (2-min user walkthrough) | ✅ | ✅ | ⚠ partial | S4 cover-hero went in then out mid-sprint |

**Net:** 4/5 rules holding by S4. The two breaks (v9.6.1 + v9.6.2) had the same root cause — Sonnet did the implementation, no paired verification dispatch ran. **Sprint 5+ rule: every Sonnet implementation is paired with a verification dispatch in the same release window.**

### Risk surface — Sprints 5–8

1. **Worker `scheduled` cron handler (S5)** — first cron in this codebase. Failure-mode discipline: log-and-skip; no queues, no retries.
2. **Schedule tab calendar (S5)** — month-grid + filter sidebar is the largest UI piece since the dashboard refactor. Founder walkthrough mandatory (Sprint 1 Improvement #3).
3. **LLM Circle Note (S6)** — first LLM output going to a user-facing surface across multiple recipients. Multi-tenant prompt shape must keep `athlete_id` out of context.
4. **Anthropic key encryption (S7, `#52`)** — D1 vs Workers Secrets vs continued localStorage. Already decided: stay localStorage until `#56` forces multi-device (§D-3).

### Tech debt to retire over Sprints 5–8

| Item | Sprint | Why |
|---|---|---|
| `#8` TSS backfill — gated on FTP populated | 5 | Founder sets FTP → 1-shot admin op |
| `#11` Strangler-Fig finish (training_prefs → D1) | 6 | Pattern proven; 3–5h |
| `#16` CORS allowlist on `/coach` + `/coach-ride` | 8 | Will land standalone (no `#32` dependency since domain deferred — §D-2) |
| `#31` `safeWarn` rate-limit | — | Trigger-condition only; no slot |
| CSP `'unsafe-inline'` on style-src tightening | 8 | Long-tail polish |
| `#44` / `#45` / `#3` hygiene-close (work shipped, GH still open — `f2a90f3` lacked "Closes #N") | 5 | Single hygiene commit |

---

## §C — Sprint 5/6/7/8 breakdown

### Sprint 5 — Clubs Phase 3+4 (Schedule tab + statistical AI moments) → v9.7.x

| Aspect | Detail |
|---|---|
| **Theme** | Persona B/C wedge: Schedule tab + cron infra + readiness/trend statistical AI |
| **Releases** | v9.7.0 (Schedule tab + Migration 0006), v9.7.1 (cron + readiness dots + trend arrows), v9.7.2 (`#56` clubs share/invite — own release per §D-6), hotfix band |
| **Effort** | ~22h (Phase 3 9h + Phase 4 7h + `#56` ~6h) |
| **Closes** | Phase 3+4 of `#53`, `#56`; hygiene-close on `#44` `#45` `#3` |
| **Dependencies** | Migration 0006 (`event_type` + month-query indexes) — pre-CTO column-shape check vs `schema.sql` |
| **ADRs** | ADR-S5.1 cron failure mode (log-and-skip, no retry); ADR-S5.2 readiness-dot threshold (CTL Δ %?) |
| **Smoke** | Schedule tab renders 4-week grid + filters at 390×844; cron fires Mon 06:00 UTC; readiness dot flips on threshold; RSVP→refetch round-trip; share-link end-to-end |
| **DoD** | `docs/retros/sprint-5.md` committed |

### Sprint 6 — Clubs Phase 5 (LLM AI moments) → v9.8.x

| Aspect | Detail |
|---|---|
| **Theme** | Phase 5 LLM moments: Circle Note auto-draft, Metrics tab AI insights, post-ride callout |
| **Releases** | v9.8.0 (Circle Note + Metrics tab + Migration 0007), v9.8.1 (post-ride callout), hotfix band |
| **Effort** | ~16h (Phase 5) |
| **Closes** | Phase 5 of `#53`; `#11` Strangler-Fig fold-in if scope holds |
| **Dependencies** | New tables `club_circle_notes` + `club_metrics_rollup`; Haiku prompt designs from architect doc §C.4 |
| **ADRs** | ADR-S6.1 multi-tenant prompt shape (no `athlete_id` leak); ADR-S6.2 cost-ceiling alarm (per-club Haiku spend tracking) |
| **Smoke** | Cron generates Circle Note end-to-end weekly; Metrics tab renders insights; post-ride callout fires once per ride |
| **DoD** | `docs/retros/sprint-6.md` committed; **post-S6 review of route-generation feature direction (§D-7)** |

### Sprint 7 — Personal-loop closure (`#49`/`#50`/`#52`/`#5`) → v9.9.x

| Aspect | Detail |
|---|---|
| **Theme** | Persona A: AI year-end forecast, You-tab full profile, volume-chart tooltips |
| **Releases** | v9.9.0 (`#50` + `#49` bundled — goal field + forecast), v9.9.1 (`#52` You-tab — key stays localStorage per §D-3), v9.9.2 (`#5` volume tooltips) |
| **Effort** | ~25h (`#49`/`#50`/`#52` ~16h + `#5` 5h + spike/integration 4h — key-encryption ADR retired by §D-3) |
| **Closes** | `#49`, `#50`, `#52`, `#5` |
| **Dependencies** | Migration 0008 (`annual_goal_km`); `#52` AC-4 retired (key stays localStorage) |
| **ADRs** | ADR-S7.1 forecast model (linear vs ML, latency budget) |
| **Smoke** | Goal field round-trips; forecast renders with non-zero confidence; You-tab profile happy path |
| **DoD** | `docs/retros/sprint-7.md` committed |

### Sprint 8 — Tech debt + selective polish → v9.10.x

| Aspect | Detail |
|---|---|
| **Theme** | Long-tail retirement: `#16` CORS, CSP tighten, `#10` offline PMC. **Domain `#32` deferred per §D-2; Lighthouse `#12` deferred per §D-5.** |
| **Releases** | v9.10.0 (`#16` + CSP), v9.10.1 (`#10` offline PMC tile) |
| **Effort** | ~14h (down from ~20h after `#32` deferral) |
| **Closes** | `#10` (offline PMC sub-point), `#16` |
| **Dependencies** | `#10` narrowed to offline PMC only per §D-4 |
| **ADRs** | ADR-S8.1 CSP `'unsafe-inline'` removal strategy (nonce-everything vs hashes) |
| **Smoke** | OAuth still green on workers.dev origin; offline PMC tile renders without network |
| **DoD** | `docs/retros/sprint-8.md` committed |

### Dependency order

S5 → S6 (cron infra in S5 is required for S6 LLM moments). S6 → S7 (frees implementation cycles + decouples LLM-prompt review from personal-loop work). S7 ↔ S8 are loosely coupled — S8 can run partially in parallel.

---

## §D — Founder decisions (locked 2026-05-01)

| # | Decision | Status |
|---|---|---|
| 1 | Sprint 5–6 = clubs Phase 3–5 finish | ✅ **Approved** |
| 2 | `#32` domain migration | ⏸ **Deferred indefinitely** — not important for the moment |
| 3 | `#52` Anthropic key storage | ✅ **Stay localStorage** until `#56` share-flow forces multi-device, then revisit |
| 4 | `#10` split — narrow to offline PMC only | ✅ **Approved** — pure cleanup |
| 5 | `#12` Lighthouse remediation | ⏸ **Deferred** — features over polish; revisit only if score drops below 85 |
| 6 | `#56` clubs share/invite | ✅ **Own release as medium feature** (v9.7.2 in Sprint 5) |
| 7 | Komoot revisit (route generation) | ⏸ **Deferred until post-Sprint 6** — review after clubs features ship |
| 8 | Adopt §F retro/post-mortem templates + nightly routine | ✅ **Approved** — short retro after every sprint + new daily-overnight routine (see §F) |

---

## §E — Token budget projection

| Sprint | Planning + ADRs | Implementation | Verification + retro | Total daily-quota |
|---|---|---|---|---|
| 5 | 8% | 40% | 7% | ~55% |
| 6 | 6% | 35% | 7% | ~48% |
| 7 | 8% | 30% | 5% | ~43% |
| 8 | 5% | 25% | 5% | ~35% |

**Risk hotspots (where overrun usually happens):**
- **S5 implementation** — Schedule tab calendar UI is the largest unknown. Founder walkthrough mandatory before coding (Improvement #3).
- **S6 verification** — first user-facing LLM output (Circle Note); manual review tax is real. Budget verification at 12%, not 7%, if founder wants per-club preview pre-cron-fire.
- **S7 implementation** — `#52` simplified by §D-3 (key stays localStorage); should land cleaner than the original ~30h estimate.
- **Nightly retro routine (§F)** — ~1–2% of daily quota per Mon–Fri firing; ~7% additive across the week. Acceptable.

---

## §F — Process: retros + bug post-mortems + nightly routine

(Founder directive 2026-04-30 + 2026-05-01.)

### F.1 — Sprint retro template — `docs/retros/sprint-N.md`

```markdown
# Sprint N Retro — vX.Y.Z → vX.Y.Z'

**Sprint window:** YYYY-MM-DD → YYYY-MM-DD
**Closing version in prod:** vX.Y.Z' (`<commit>`)
**Author:** retro synthesis

## Headline
What shipped, at what cost (hotfix count, schema migrations, scope changes).

## What went well (3–6 bullets)

## What went badly (3–6 bullets — root cause + impact each)

## Improvements (numbered, action-oriented)
Promote durable cross-sprint rules into auto-memory at
`~/.claude/projects/.../memory/feedback_*.md` — done locally by founder
since the routine cannot write outside the repo.

## Git + version state at sprint close

## Recommended next-sprint kickoff sequence
```

**Aim:** ≤ 220 lines. Time-box: 30 min. Mandatory in every sprint's DoD.

### F.2 — Bug post-mortem template — `docs/post-mortems/v9.X.Y-<short-name>.md`

```markdown
# Post-mortem — vX.Y.Z <short name>

## Timeline (absolute UTC timestamps)
- HH:MM — vX.Y.Z deployed
- HH:MM — bug discovered (who, how)
- HH:MM — vX.Y.Z+1 hotfix shipped

## User-visible symptom
1–2 sentences.

## Root cause (file:line where possible)

## Fix
Commit hash + 2–3 line description.

## Prevention rule
One durable lesson. Add to that sprint's retro; escalate to auto-memory if it generalises.

## Smoke addition to RELEASE_CHECKLIST.md
What gets added so this regression class is caught next time.
```

**Aim:** ≤ 80 lines. Time-box: 15 min. Mandatory for any release that triggers a hotfix or rollback.

### F.3 — Nightly daily-retro routine (NEW — §D-8)

**Cadence:** Mon–Fri 22:00 Zurich (cron `0 20 * * 1-5` UTC). Skips weekends.
**Output:** `docs/retros/daily/YYYY-MM-DD.md` (~150 lines), committed + pushed to `main`.
**Roles synthesised in one doc:** Architect / Tech Lead / Developer / Strategist / CTO.

**Sections:**
1. **Day in numbers** — commits, releases cut, files changed, lines net.
2. **What shipped** — 1-line per merged commit; flag hotfixes vs feature work.
3. **Retro signals** — 3–5 cross-role bullets (regressions to watch, dispatch reliability, scope drift).
4. **3-sprint plan delta** — surface staleness in `4-sprint-plan-2026-05.md` if any items completed/shifted (read-only — does NOT mutate the plan).
5. **GitHub issue maintenance** — `gh` CLI commands the founder runs morning-of:
   - Issues to close (with `--reason completed` + `--comment`)
   - Issues to create (with `--title` + `--body`)
   - **No mutations performed by the routine itself** — Claude GitHub App not yet connected; once `/web-setup` is run, this can be upgraded to direct mutation.

**Constraints:** ≤ 5% of daily quota; Sonnet model; does not modify source, the 4-sprint plan, or CHANGELOG.

### F.4 — Existing references (don't re-invent)

- `docs/retros/sprint-1.md` — template canon (84 lines, 7 improvement rules already in auto-memory)
- Auto-memory `feedback_*.md` files (8 entries as of 2026-05-01)
- `RELEASE_CHECKLIST.md` — recurring smoke counterpart to issue tracker
- v9.6.1 OAuth, v9.6.2/v9.6.4 RSVP — Sprint 4 candidates for *retroactive* post-mortems (optional; CHANGELOG entries already capture root cause + fix in post-mortem-shaped form)

*End of plan.*
