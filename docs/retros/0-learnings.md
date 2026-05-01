# Cross-Sprint Learnings (Sprint 1 → Sprint 4)

Consolidated index of durable rules from 4 sprint retros. Each rule lists origin sprint, whether it's promoted to auto-memory, and current adherence signal.

> **For Sprint 5+ kickoff:** read this first, then the next-sprint retro section in `4-sprint-plan-2026-05.md`.

---

## Process rules (durable, all in force)

| # | Rule | Origin | Auto-memory | Adherence S4 |
|---|---|---|---|---|
| 1 | **Legacy-parity audit before merging any layout-shell or security-header refactor.** Audit must include CSP / inline-script surfaces, not just visual chrome. | S1 Improvement #1, refined S3 #3 | yes (`feedback_pre-deploy-verification.md`) | ❌ broke at v9.6.1 (CSP audit missed `/callback` inline script) |
| 2 | **Mobile-viewport CI gate.** `tests/mobile-tabs.spec.ts` blocks deploy on red. Viewport 390×844 + `cc_tabsEnabled='true'` + `/dashboard` redirect + chrome assertions. | S1 Improvement #2 | no — lives in test file | ✅ holding since S2 |
| 3 | **Pre-coding user walkthrough for spec-driven UI** — 2-min preview before writing any new chips/controls/workflow, especially when BA + Architect specs disagree. | S1 Improvement #3 | yes (`feedback_pre-coding-scope-alignment.md`) | ⚠ S4 partial — cover hero went in then out mid-stream |
| 4 | **Hard rule: `git log --oneline -20` before any revert/reset/force-push.** Verify the chain. | S1 Improvement #4 | yes (`feedback_git-log-before-destructive-ops.md`) | ✅ holding since S1 |
| 5 | **Smoke what changed, not what's stable.** Per-release smoke targets the regression risk surface for THAT release. UPSERT + count-refetch features need POST → GET round-trip smoke, not just 200 OK on POST. | S1 #5 + S4 #4 | yes (`feedback_pre-deploy-verification.md`) | ❌ broke at v9.6.2 (RSVP "shows 1 then 0") |
| 6 | **Phase-shift triggers scope re-review.** When Sprint N work pulls forward Sprint N+1 features, treat as a new release, not a hotfix. | S1 #6 | no — process rule, in retros only | ✅ S3/S4 split clubs into 5 phases as separate releases |
| 7 | **`Closes #N` keyword is mandatory in release commits.** Paren-only `(#43 #44)` does NOT auto-close. | S3 #1 | no — should be in `CONTRIBUTING.md` | ❌ S3 `f2a90f3` missed — `#44`/`#45`/`#3` GH-open hygiene pending |
| 8 | **Skill-hijack defense: every Sonnet brief opens with "do not invoke skills/plugins."** First dispatch is read-only. | S3 #2 | yes (process baked into briefs) | ⚠ S4 had 1+ skill-hijack — pattern still recurring |
| 9 | **Every Sonnet implementation is PAIRED with a verification dispatch in the same release window.** Verification reads the diff + smoke-tests the new surface against the spec. | S4 #1 | new — to be added to auto-memory after S5 proves it | n/a — new for S5 |
| 10 | **Pre-commit grep against `schema.sql`** for any SQL change. Dispatch a separate Sonnet to verify every column referenced. | S4 #2 | new — to be added | n/a — new for S5 |
| 11 | **Sprint plans budget verification at 12%, not 7%, for phases that introduce new endpoints + new D1 tables.** | S4 #5 | new — process rule, in plan templates | n/a — new for S5 |
| 12 | **Bug post-mortems mandatory for any hotfix release.** `docs/post-mortems/v9.X.Y-<short-name>.md`, ≤ 80 lines, time-box 15 min. | S4 #6, founder directive 2026-04-30 | new — mandatory from S5 | n/a — first post-mortem in S5 |
| 13 | **Sprint retros mandatory in DoD.** `docs/retros/sprint-N.md`, ≤ 220 lines, time-box 30 min. | Founder directive 2026-04-30 | yes (this directory) | ✅ S2/S3/S4 backfilled 2026-05-01 |
| 14 | **Nightly autonomous code review + CTO/Strategist proposal** to Confluence as new child page under Roadmap (id `98311`). Founder approves in terminal. | Founder directive 2026-05-01 | new — see routine `trig_01WBNhonys1obaHsHPLof3ZU` | n/a — first run tonight |

---

## Recurring breach patterns

Three rules are not holding by S4 close. All three need attention in S5:

1. **Rule #1 (legacy-parity audit) and Rule #5 (smoke what changed)** — both broke same sprint (`v9.6.1` OAuth + `v9.6.2`/`v9.6.4` RSVP). Same root cause: Sonnet did the implementation, no paired verification dispatch ran. **Rule #9 (paired verification dispatch) is the new structural fix; if it holds in S5, #1 and #5 should hold by extension.**
2. **Rule #7 (`Closes #N` keyword)** — broke once in S3, hasn't recurred but the fallout (3 GH-open issues despite shipped work) is still pending. Hygiene-close commit slotted in S5 kickoff.
3. **Rule #8 (skill-hijack defense)** — recurring (S3 had 2; S4 had 1+). Defensive scoping (read-only first dispatch) recovered each time but adds friction. Watch in S5 — if it recurs again, escalate to a structural fix (e.g., a permissions wrapper around sub-agent dispatch).

---

## Per-sprint retros

- [Sprint 1](sprint-1.md) — v9.2.5 → v9.3.4. Hotfix cascade lessons. 7 improvements, all promoted.
- [Sprint 2](sprint-2.md) — v9.3.5. Mid-stream scope reset; mobile-tabs CI gate landed. 3 improvements.
- [Sprint 3](sprint-3.md) — v9.4.0 → v9.5.2. Hardening backlog (3 phases). CTO-only template proven. 3 improvements.
- [Sprint 4](sprint-4.md) — v9.5.3 → v9.6.5. Clubs Phases 1+2 + hotfix cascade. 6 improvements (largest improvement set since S1).

---

## How to use this

- **Before starting Sprint 5+ work:** scan §"Recurring breach patterns" — those are the rules most likely to break.
- **When proposing a new process rule (in any retro):** check if it overlaps with one above; refine or replace, don't accumulate duplicates.
- **When auto-memory grows beyond ~12 files:** consolidate. Memory should be load-bearing, not exhaustive.
