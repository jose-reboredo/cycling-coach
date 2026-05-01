# Sprint 4 Retro — v9.5.3 → v9.6.5

**Sprint window:** 2026-04-30 (single long day; 5 phases planned, 2 phases + post-sprint marketing rewrite shipped)
**Closing version in prod:** v9.6.5 (`920d587`)
**Author:** retro synthesis (closing 2026-05-01 — first retro written under the new founder directive)

---

## Headline

**Sprint 4 = clubs expansion (`#53`).** Planned 5 phases (~52h); shipped Phase 1 (`v9.6.0` — 4-tab shell + Overview) + Phase 2 (`v9.6.2` — Members tab + RSVP) + a post-sprint marketing rewrite (`v9.6.5` — Landing page realigned to clubs-first 3-persona direction). Phases 3–5 (Schedule tab, statistical AI moments, LLM AI moments) deferred to Sprint 5+. **Three hotfixes consumed verification budget**: `v9.6.1` OAuth callback CSP regression (Sprint 3 `#15` latent), `v9.6.3` RSVP count persistence + modal mobile clip + search input UX, `v9.6.4` RSVP rate-limit shape bug + tab typography aligned with BottomNav.

**Cost: ~70% of daily quota across 6 releases.** The verification + hotfix budget overrun (~3× the planned 7%) is the headline lesson for Sprint 5.

---

## What went well

1. **5-ADR founder approval gate (S4.1–S4.5) worked.** No founder pushback on any ADR; locked in 1 round. Pre-implementation alignment held — Sprint 1 Improvement #3 in action.
2. **Migration 0005 applied clean to remote D1.** `event_rsvps` + `users.ftp_visibility` + `club_members.trend_arrow`/`trend_updated_at`. `schema.sql` kept in sync per cumulative-schema policy.
3. **Phase 2 Members tab full implementation** shipped in one cycle: sort dropdown, search-as-you-type, role chips, NEW badge, FTP-mask server-side. UX polish caught early; v9.6.4 typography align was the only follow-up.
4. **v9.6.5 Landing rewrite** (post-sprint cleanup) reflected the clubs-first 3-persona direction. Surgical copy edits, no restructure. Build green, no regressions.
5. **Founder mid-stream feedback ("cover hero is not needed") absorbed without rework.** The Phase 1 plan included a cover hero; founder feedback caught mid-plan, slim sticky header replaced it. Pre-coding scope alignment paid off again.
6. **First retro written under the new directive.** Process bootstrapped; backfilled S2/S3 simultaneously to give Sprint 5 a complete baseline.

---

## What went badly (root cause + impact each)

1. **Three hotfixes — same root cause: Sonnet implementation, no paired verification dispatch.**
   - **`v9.6.1`**: Sprint 3 `#15` strict CSP `script-src 'self'` blocked the `/callback` inline-script that writes Strava tokens → users stuck on "Loading dashboard…" after OAuth. Cross-sprint failure; would have been caught by the legacy-parity audit Sprint 3 Improvement #3 prescribed but didn't get applied.
   - **`v9.6.2`/`v9.6.3`/`v9.6.4`**: TWO buggy uses of `if (!rl.ok)` — `checkRateLimit` returns `null` or `{retryAfter}`, never `{ok}`. `null.ok` threw TypeError, every first `POST /rsvp` returned 500, optimistic UI reverted "shows 1 then 0". `v9.6.3` shipped a LEFT-JOIN fix that was technically correct but wrong root cause — D1 query `SELECT COUNT(*) FROM event_rsvps` = 0 ever, RSVPs never persisted at all. `v9.6.4` finally fixed the rate-limit shape mismatch.
2. **`v9.6.0` SQL bugs caught pre-commit** (Sonnet wrote `SUM(a.elapsed_time)` — column doesn't exist; cutoff bind type mismatch INTEGER vs ISO-string). Pre-commit grep against `schema.sql` rule should be a routine step, not a save-by-luck.
3. **Sub-agent skill-hijack: 1+ time in Phase 1.** Sonnet pivoted to permissions audit / settings.json instead of the requested clubs work. Pattern is recurring (Sprint 3 had 2; Sprint 4 had 1+). Defensive scoping (read-only first dispatch) is the workaround but adds friction.
4. **Sprint 4 was effectively 2 phases out of 5.** Phase 3+4+5 deferred to Sprint 5/6. The original "5 phases / ~52h" estimate underestimated the verification + hotfix budget by ~50%. **Honest sizing for Sprint 5+: budget verification at 12%, not 7%, for any phase that touches new endpoints + new D1 tables.**
5. **Pre-coding scope alignment partial.** Cover hero went in (Phase 1 plan) and out (founder mid-stream feedback). Better than a full hotfix, but a 2-min user walkthrough at plan-time would have caught it before it landed in code.
6. **No bug post-mortems written for the 3 hotfixes.** The CHANGELOG entries capture root cause + fix in post-mortem-shaped form, but the dedicated `docs/post-mortems/` directory was never created. Going forward (founder directive 2026-04-30): mandatory.

---

## Improvements for Sprint 5

| # | Change | Catches |
|---|---|---|
| 1 | **Every Sonnet implementation dispatch is PAIRED with a verification dispatch in the same release window.** No exceptions for "small" changes. The verification dispatch reads the diff + smoke-tests the new surface against the spec. | `v9.6.1` OAuth + `v9.6.2`–`v9.6.4` RSVP cascade |
| 2 | **Pre-commit grep against `schema.sql` is mandatory for any SQL change.** Dispatch a separate Sonnet to grep every column referenced; fail commit if any column is missing. | `v9.6.0` `elapsed_time` hallucination |
| 3 | **Defensive scope on Sonnet sub-agents: first dispatch is read-only**; follow-up dispatch can write only after a verification of what was read. | Recurring skill-hijack pattern |
| 4 | **End-to-end smoke for any UPSERT + count-refetch feature**: smoke must validate POST → GET round-trip, not just 200 OK on POST. | `v9.6.2` "shows 1 then 0" RSVP |
| 5 | **Sprint plan must budget verification at 12% per phase that introduces new endpoints + new D1 tables.** Not 7%. | Sprint 4 hotfix-budget overrun |
| 6 | **Bug post-mortems written for any release that triggers a hotfix.** `docs/post-mortems/v9.X.Y-<short-name>.md`, ≤ 80 lines, time-box 15 min. Mandatory per founder directive. | Lack of S4 post-mortems |

---

## Git + version state at sprint close

- **Live in prod:** v9.6.5 · commit `920d587` (post-sprint marketing rewrite); Sprint 4 proper closed at v9.6.4 · `6aa70ab`
- **Main branch:** clean (1 trailing lockfile sync from earlier — non-load-bearing)
- **Origin sync:** 0 ahead, 0 behind
- **Open GitHub issues:** 13 — `#53` Phases 3–5 deferred to Sprint 5/6; `#56` clubs share/invite is new; `#49`/`#50`/`#52` originally-Sprint-4 features pushed to Sprint 7
- **Closed in Sprint 4:** `#53` Phases 1+2 (partial — full close after Phase 5 ships in Sprint 6)
- **Schema state:** Migration 0005 applied to remote D1; `event_rsvps` populated as users RSVP
- **Auto-memory feedback files (cumulative):** 8 entries — economy model, git-log-before-destructive-ops, no-temp-admin-endpoints, pre-coding-scope-alignment, pre-deploy-verification, release-ceremony, release-readme-sweep, token-scope-precheck

---

## Recommended Sprint 5 kickoff sequence

1. **Founder walkthrough of Schedule tab calendar UI** (Sprint 1 Improvement #3) — month-grid + filter sidebar is the largest UI piece since the dashboard refactor. Catch scope drift before code.
2. **ADR-S5.1 + ADR-S5.2 founder approval gate** — cron failure mode (log-and-skip, no retry) and readiness-dot threshold (CTL Δ %?) — lock in 1 round per Sprint 4 lesson.
3. **Cron-handler ADR is the load-bearing piece.** First Worker `scheduled` export in this codebase. Get the failure-mode discipline right; don't introduce queues or retries.
4. **Pair every Sonnet implementation with a verification dispatch** (Sprint 4 Improvement #1) — non-negotiable.
5. **Migration 0006 column-shape pre-CTO check** (Sprint 4 Improvement #2) — every column referenced in the new SQL gets grep-verified against `schema.sql` before commit.
6. **Hygiene-close commit early in Sprint 5**: `git commit --allow-empty -m "chore(hygiene): Closes #44 #45 #3 — work shipped in v9.5.2 (commit f2a90f3) but auto-close keyword missed"` (Sprint 3 Improvement #1). Mechanical, low-risk, gets the issue tracker correct.
7. **First post-mortem under the new directive**: write `docs/post-mortems/v9.6.1-oauth-csp.md` + `docs/post-mortems/v9.6.4-rsvp-rate-limit.md` retroactively from S4 hotfixes. Establishes the template for forward use.

**Estimated Sprint 5 effort:** ~22h (Phase 3 9h + Phase 4 7h + `#56` clubs share/invite ~6h). Verification budget bumped to 12% per Sprint 4 Improvement #5.
