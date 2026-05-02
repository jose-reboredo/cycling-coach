# Sprint 11 Prep — Autonomous Overnight Run

**Kicked off:** 2026-05-02 evening (Sprint 10 closed at v10.12.0)
**Reviewer:** Founder (Jose), morning of 2026-05-03

Four parallel agents, each on its own branch, running in isolated git worktrees so they don't trample each other. None of them deploys to prod. Founder merges what looks good in the morning.

## Branches to review

| Branch | Scope | Expected deliverable |
|---|---|---|
| `sprint-11-bugs` | Two named user-visible bugs | Code fix + new tests + `SPRINT_11_BUGS_REPORT.md` |
| `sprint-11-security` | SQL / authn / authz audit | Findings doc `SPRINT_11_SECURITY_REPORT.md` + PR-ready fixes for high/critical |
| `sprint-11-tests` | API contract regression suite | +30 tests across `/api/*` (happy / 401 / 403) |
| `sprint-11-docs` | README + Confluence rewrite to Merkle quality | New README sections + expanded `/admin/document-release` payload |

## How to review

```bash
# fetch all four branches
git fetch origin

# diff each one off main
git log --oneline main..origin/sprint-11-bugs
git log --oneline main..origin/sprint-11-security
git log --oneline main..origin/sprint-11-tests
git log --oneline main..origin/sprint-11-docs

# read the report file from each branch (top-level of repo)
git show origin/sprint-11-bugs:SPRINT_11_BUGS_REPORT.md
# (etc.)
```

When merging: cherry-pick or PR — each branch is meant to be reviewable independently. If two touch the same file (e.g. bugs + security both editing `src/worker.js`), the second-merged branch will need a manual rebase. Most cuts deliberately don't overlap.

## What's NOT in this run (deliberate)

- **No prod deploy.** v10.12.0 is the last prod deploy of the night.
- **No `main` commits.** All work is on the four `sprint-11-*` branches.
- **No real perf testing or pentest.** Both need real tooling + baseline; one-night versions would be theater. Findings on these surfaces are flagged into `SPRINT_11_BACKLOG.md` for a future sprint.
- **No multi-role review choreography.** I did one tech-lead pass and surfaced top-N issues per area. The literal "every role reviews their part across 38 releases" is 2 weeks of work; the honest version is what each agent delivers.
