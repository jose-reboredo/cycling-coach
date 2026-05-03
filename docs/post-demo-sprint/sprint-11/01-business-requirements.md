# Sprint 11 — Business Requirements

**Source:** Founder request 2026-05-03: "after this release we can consider the sprint 10 as closed. its housekeeping time, clean code, improve security and performance test, penetration test, run smoke test and regression tests, improve confluence page and readme in git hub. we have so many interactions i want all roles to review their part and fix everything from CTO to strategics, the app is start to be functionally mature and i want you to work alone tonight and find a perfect documentation."
**Wedge:** Internal. Code health + founder confidence + documentation quality.

## Hypothesis

After 38+ releases over Sprints 1-10, the codebase is functionally mature but operationally rough:
- Security has not had a dedicated audit pass.
- Test coverage is thin (42 tests, all narrow scope) — Sprint 9-10's hotfix cluster wouldn't have happened with proper contract tests.
- Documentation lags the product — README "Current release: v10.6.0" while prod was v10.12.0; Confluence claimed 12 tables when 17 existed; Recent releases trail stops at v9.12.x.
- Two user-reported reliability bugs (Zurich routes drift + Path of Gods hike recommendation) need root-cause + fix.

If we run four parallel autonomous workstreams overnight (founder authorized "work alone tonight"), each on its own branch in an isolated worktree, the founder can review + merge in the morning. No prod deploys overnight; v10.12.0 is the last prod cut before the morning review.

## In scope (and the honest counter-offer to founder's "all of it")

What the founder asked for (paraphrased): "all roles review their part" + clean code + security test + performance test + pentest + smoke + regression + Confluence + README + the two named bugs.

What I counter-offered (and the founder accepted):

| Workstream | Scope | Branch | Effort |
|---|---|---|---:|
| Bugs | Zurich-Positano hike + Zurich-anchor drift; root-cause + fix + tests | `sprint-11-bugs` | ~6h |
| Security | SQL / authn / authz / CORS / secrets audit + PR-ready fixes for high+crit | `sprint-11-security` | ~5h |
| Tests | +30 API contract guards (static-scan + unit) | `sprint-11-tests` | ~4h (target — landed at +158 actual) |
| Docs | README rewrite + Confluence payload upgrade + IA proposal | `sprint-11-docs` | ~4h |

**Skipped tonight (called out, not silently dropped):**
- Real perf testing (k6/wrk + baseline) — backlog'd.
- Real pentest (needs a harness) — the security pass is a tech-lead audit, not a pentest.
- Multi-role review across 38 releases (2-week task) — honest version is the tech-lead pass each agent did.
- Documenting all sprints (5-10 + the template) — added 2026-05-03 morning (this set of docs).

## Acceptance criteria

A founder reviewing in the morning:
1. Four branches on origin, each with its own SPRINT_11_*_REPORT.md. ✅
2. Tests staying green at every merge (verified at each step). ✅
3. v10.13.0 cut + deployed + smoke verified. ✅
4. Backlog file consolidates anything that needs a real sprint. ✅ (`SPRINT_11_BACKLOG.md`).
5. Sprint planning + retro docs for every prior sprint. ✅ (this doc set, 2026-05-03 morning).

## Out of scope / explicit deferrals

- **Route generation reliability** — shipped code in v10.13.0 (centroid gate, type filter, anchor filter) but founder reported the user-visible problem persists. Deferred to **Sprint 12** with explicit instruction to do an end-to-end redesign + fixture-based harness, not another targeted patch.
- **Performance testing** — backlog.
- **Real pentest** — backlog.
- **Encrypted-at-rest token storage for RWGPS** — backlog (security audit flagged this).
- **Items 4 + 5 from v10.12.0** (Today inline route shortcut + AI plan repeat-group integration) — already deferred at Sprint 10 close.

## Process directives

- **All commits land on `sprint-11-*` branches, not main.** Founder merges in the morning. ✅ (founder ran the four merges + cut v10.13.0).
- **No prod deploys overnight.** ✅ (v10.12.0 was the last; v10.13.0 deployed in the morning after merge review).
- **Each fix = separate commit** so founder can cherry-pick or revert. ✅
- **Anything I can't credibly fix overnight** goes to `SPRINT_11_BACKLOG.md` with severity + suggested owner. ✅
- **Sprint planning + retro for every sprint, going forward.** Locked as a memory rule (`feedback_sprint-documentation-mandatory.md`) and the 4-doc template at `docs/post-demo-sprint/_sprint-template.md`.
