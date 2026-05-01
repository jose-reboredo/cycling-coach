# Sprint 3 Retro — v9.4.0 → v9.5.2

**Sprint window:** 2026-04-30 (single day; 3 phases shipped sequentially)
**Closing version in prod:** v9.5.2 (`4d951bc`)
**Author:** retro synthesis (backfilled 2026-05-01 — founder directive came at end of S4)

---

## Headline

**Sprint 3 = hardening backlog.** Three phases shipped clean: Phase 1 stability (`v9.5.0` — `#38`/`#39`/`#40`), Phase 2 security (`v9.5.1` — `#15`/`#41`/`#42`), Phase 3 a11y + UI polish (`v9.5.2` — `#43`/`#44`/`#45`/`#3`). Cost-conscious planning template (CTO-only single doc) cut planning burn ~4× vs Sprint 1.

**Cost: ~45% of daily quota across 3 releases.** Set the cost-conscious template that Sprint 4 inherited.

---

## What went well

1. **CTO-only single-doc planning template (`cto-plan.md`) cut planning cost ~4× vs Sprint 1.** No separate BA/UX/Architect rounds. One doc, one synthesis pass. Set the template for Sprint 4+.
2. **Three phases shipped sequentially with no inter-phase regressions.** The "one risk theme per release" rule from Sprint 1 retro held — Phase 1 stability didn't drag Phase 2 security; Phase 2 didn't drag Phase 3.
3. **Backlog review as a documented deliverable.** `sprint-3/backlog-review.md` (combined BA+Architect Sonnet, paired) produced 3 founder questions and a clean per-issue assessment — first time backlog hygiene was a step, not a side-task.
4. **`RELEASE_CHECKLIST.md` introduced** — recurring smoke counterpart to GitHub issues. iOS validation, header smoke, method allowlist probe — all consolidated.
5. **Phase 2 security closed Sprint 1 Improvement #1.** `#15` security headers + `#41` method allowlist + `#42` rate-limit on `/api/clubs*` = the "security CRITICALs first" rule fully retired for the audit's named items.
6. **Sub-agent dispatch had 4 successful Sonnet runs** (one per phase + the backlog review). Friction limited to 2 skill-hijack incidents in Phase 2 (workaround applied — defensive scoping).

---

## What went badly

1. **"Closes #N" hygiene missed on `f2a90f3`** (Phase 3 release). The commit referenced `(#43 #44 #45 #3)` in parentheses — those are NOT auto-close keywords on GitHub. Result: `#44`, `#45`, `#3` are still GH-open today despite shipping. Procedural slip; one hygiene-close commit pending in Sprint 5.
2. **Phase 2 `#15` introduced the latent CSP regression** that surfaced as v9.6.1's OAuth callback hang. Strict CSP `script-src 'self'` blocked the inline `/callback` script that writes Strava tokens. **Sprint 1 Improvement #1 (legacy-parity audit) failure** — the audit at `#15` merge time should have included CSP / inline-script surfaces, not just visual chrome. Cross-sprint failure that wasn't caught until v9.6.1 hotfix.
3. **Sub-agent skill-hijack happened twice in Phase 2** (Sonnet pivoting to permissions / settings.json audits instead of the requested CSP work). Defensive scoping recovered both times, but the workaround tax is real — pattern recurs in Sprint 4.
4. **No retro written at sprint close.** Founder directive came end of Sprint 4. Backfilled here.

---

## Improvements for Sprint 4 (now Sprint 5+ for forward-effect)

| # | Change | Catches |
|---|---|---|
| 1 | **Hard rule on commit-message hygiene**: every release commit MUST include explicit `Closes #N` for each issue it closes. Paren-only `(#43 #44)` does NOT auto-close. Add to `CONTRIBUTING.md`. | `#44`/`#45`/`#3` GitHub-open-but-shipped state |
| 2 | **Skill-hijack defense**: every Sonnet brief opens with "do not invoke skills/plugins; do not pivot to permissions or settings audits." First dispatch is read-only. | Phase 2 Sonnet pivots |
| 3 | **Legacy-parity audit must include CSP / inline-script surfaces**, not just visual chrome. The `/callback` inline script writing tokens to `localStorage` was load-bearing and got blocked silently. | v9.6.1 OAuth CSP regression |

---

## Git + version state at sprint close

- **Live in prod:** v9.5.2 · commit `4d951bc`
- **Main branch:** clean
- **Origin sync:** 0 ahead, 0 behind
- **Open GitHub issues:** 13 — Sprint 4 candidate: `#53` clubs expansion (the wedge); deferred-to-Sprint-5+: `#11`, `#16`, `#10`, `#5`
- **Closed in Sprint 3:** `#15`, `#38`, `#39`, `#40`, `#41`, `#42`, `#43` — `#44`/`#45`/`#3` shipped but GH-open (hygiene-close pending)

---

## Recommended Sprint 4 kickoff sequence

1. **Founder requirement walkthrough on `#53` clubs expansion** (apply Sprint 1 Improvement #3) — `#53` has wireframes + founder mid-stream notes; review them before writing plan.
2. **CTO-only template** — keep what worked.
3. **Expect ~50h scope** — clubs expansion materially outgrows the original Sprint 3 Phase 4 budget (~10h roster slice). Plan for 5 phases, not 1.
4. **Apply Sprint 3 Improvement #3 (CSP-aware legacy-parity audit) to every Sprint 4 release** — clubs work touches Worker headers + new endpoints; same regression class as `#15`.

**Estimated Sprint 4 effort:** ~50h across 5 phases (clubs expansion only). Originally-planned Sprint 4 (`#49`/`#50`/`#52`) pushes to Sprint 7.
