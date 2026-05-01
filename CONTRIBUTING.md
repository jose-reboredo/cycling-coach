# Contributing — workflow

Cycling Coach is a single-maintainer project on a **weekly release** cadence. The roadmap visible at <https://cycling-coach.josem-reboredo.workers.dev/whats-next> is driven entirely by GitHub Issues. There is no separate spreadsheet, kanban, or doc.

## How issues drive the roadmap

```
GitHub Issues  ─┐
                ├─►  Worker /roadmap  ──►  /whats-next page
[5-min cache]  ─┘    (apps/web)
```

1. You (or anyone) opens an issue at <https://github.com/jose-reboredo/cycling-coach/issues>.
2. The Cloudflare Worker's `/roadmap` endpoint proxies the GitHub REST API, normalises the issues, and caches the response at the edge for **5 minutes**.
3. The React `/whats-next` page fetches `/roadmap` via Tanstack Query (also 5-min stale-time on the client).
4. Within ~5 minutes of any change on GitHub, `/whats-next` reflects it.

The static `apps/web/src/lib/roadmap.ts` file is now a **fallback seed** only — used when the live endpoint is unreachable or returns no items.

## Issue conventions

The Worker reads the following from each issue:

| Source | What it becomes |
|---|---|
| Title | Card title |
| Body (first paragraph, ≤ 280 chars) | Card body |
| Label `priority:high\|medium\|low` | Priority pill |
| Label `area:dashboard\|design-system\|auth\|db\|backend\|ci\|pwa\|perf\|routes` | Area tag |
| Label `type:feature\|bug\|chore` | (reserved for future filters) |
| Label `status:in-progress` *or* any assignee | Status: `In progress` |
| Issue state `closed` | Status: `Shipped` |
| Otherwise | Status: `Open` |
| Milestone title (e.g. `v8.3.0`) | Target version |

PRs are filtered out automatically.

## Bootstrapping the labels + milestones + initial backlog

Run once after first clone (requires `gh` CLI authed):

```bash
brew install gh
gh auth login
./scripts/bootstrap-issues.sh
```

The script is idempotent — re-running won't duplicate labels, milestones, or issues.

## Release-naming convention (locked 2026-05-01)

Strict semver — three segments, `MAJOR.MINOR.PATCH`:

| Bump | When | Reset | Example |
|---|---|---|---|
| **MAJOR** | One of the 5 triggers below | MINOR + PATCH → 0 | `9.x.x` → `10.0.0` |
| **MINOR** | Feature release | PATCH → 0 | `9.7.0` → `9.8.0` |
| **PATCH** | Hotfix or in-release polish to the same feature theme | — | `9.8.0` → `9.8.1` |

**Read the third digit as "this feature has had N hotfixes."** A version like `9.10.2` says the 10th feature release in the 9.x line has had 2 hotfixes.

### MAJOR (`X.0.0`) triggers — any ONE qualifies

CTO call. Conservative on purpose; loose criteria dilute what `vX.0.0` means.

1. **New architectural system** — replaces or fundamentally extends current stack (real-time presence via WebSockets/Durable Objects; native mobile replacing PWA; multi-platform integration beyond Strava; multi-tenant infrastructure).
2. **Breaking data-model change** — schema migration that requires a new D1 database, drops or renames primary tables, or migrates to a different storage layer. *Additive `ALTER TABLE ADD COLUMN` migrations stay MINOR per cumulative-schema policy.*
3. **Public-launch milestone** — Beta exit / GA, first paid tier, press launch, domain migration to `cadenceclub.cc` (#32). The kind of event a press release would describe.
4. **Breaking API change** — versioned API (`/api/v2/`), removal of public endpoints, contract-incompatible response shapes. *Additive endpoints / new optional response fields stay MINOR.*
5. **Strategic persona pivot** — primary persona changes (not adding personas; swapping which one drives the roadmap).

### MINOR (`X.Y.0`) — feature release

Adding capabilities, new endpoints, new components, schema columns, redesigns, copy rewrites — all MINOR even when substantial. Example: AI moments (Sprint 6) is MINOR because it's evolution, not breaking.

### PATCH (`X.Y.Z`) — hotfix or polish

Bug fixes, CSS hardening, regressions, in-flight visual refinements to the same feature theme. Examples: `9.7.4` and `9.7.5` were PATCH because they refined the v9.7.3 event model release without adding new features.

### Anti-patterns

- **Don't** use PATCH for new features (was the v9.7.0 → v9.7.5 mistake — corrected at v9.8.0)
- **Don't** bump MAJOR for marketing reasons alone — the trigger needs to be present
- **Don't** stack hotfixes inside a feature release (each hotfix gets its own PATCH bump for traceability — preserves the post-mortem audit trail per the founder retro directive 2026-04-30)

## Weekly release cadence

Mondays:
1. Triage open issues, assign milestones.
2. Move started ones into "In progress" by adding the `status:in-progress` label or assigning yourself.

Throughout the week:
3. Close issues as work merges to `main`. Use the `Closes #N` keyword in commit messages — paren-only `(#N)` does NOT auto-close (Sprint 3 retro Improvement #1).
4. Push to `main` → Cloudflare Workers Builds picks it up (or run `npm run deploy` locally).

End of week (or per-feature, depending on cadence):
5. Bump the version in `package.json`, root `package.json`, `apps/web/package.json`, `src/worker.js` (`WORKER_VERSION`), and `apps/web/src/lib/version.ts`. Also update `README.md` "Current release" line.
6. Add a `## [vX.Y.Z]` entry to `CHANGELOG.md`.
7. Tag the commit: `git tag vX.Y.Z && git push --tags`.
8. The roadmap auto-updates from the now-closed issues.

## Local dev

```bash
npm run dev:all      # Vite (5173) + wrangler (8787) in parallel
```

`/roadmap` works in dev — Vite proxies it to the Worker which fetches GitHub Issues.

## Confluence auto-doc on every deploy (issue #23)

Every prod deploy auto-updates four pages in your Confluence space (`CC`, homepage `262256`):

```
Cycling Coach (homepage)
├── Releases             ← append-only, one child per release
├── Functional documentation     ← regenerated each deploy
├── Technical documentation      ← regenerated each deploy
└── Roadmap                      ← live mirror of /roadmap (GitHub Issues)
```

### How it works

```
npm run deploy
  ├─ npm run build:web                   build the SPA
  ├─ wrangler deploy                     ship Worker + assets
  └─ npm run docs:sync                   POST /admin/document-release
                                         ↓
                                         Worker:
                                         1. Reads CHANGELOG.md from raw.githubusercontent
                                         2. Pulls last 30 commits from GitHub
                                         3. Pulls open-issue counts directly from GitHub
                                         4. (Optional) calls Claude to write functional + technical narratives
                                         5. PUTs to Confluence pages via the v2 REST API
                                         6. Appends a Releases/v8.x.y child if missing
```

The endpoint is admin-gated by `Authorization: Bearer $ADMIN_SECRET`. Without the header → 401.

### Required Worker secrets

| Secret | What | How to set |
|---|---|---|
| `ADMIN_SECRET` | gates `/admin/*` endpoints | already set; mirror in `.deploy.env` for `npm run deploy` |
| `CONFLUENCE_API_TOKEN` | Atlassian API token | `wrangler secret put CONFLUENCE_API_TOKEN` then paste from <https://id.atlassian.com/manage-profile/security/api-tokens> |
| `CONFLUENCE_USER_EMAIL` | your Atlassian-account email | `wrangler secret put CONFLUENCE_USER_EMAIL` |
| `GITHUB_TOKEN` | for issue + commit reads | already set (`public_repo` scope sufficient) |
| `SYSTEM_ANTHROPIC_KEY` *(optional)* | enables AI-written functional + technical narratives | `wrangler secret put SYSTEM_ANTHROPIC_KEY` — if absent, deterministic fallback runs |

Non-secret config lives in `wrangler.jsonc → vars`:
- `CONFLUENCE_BASE_URL = "https://josemreboredo.atlassian.net"`
- `CONFLUENCE_SPACE_KEY = "CC"`
- `CONFLUENCE_HOMEPAGE_ID = "262256"`

### `.deploy.env` (local-only, gitignored)

`npm run docs:sync` reads `$ADMIN_SECRET` from the env. To make `npm run deploy` work without re-typing:

```bash
source .deploy.env
npm run deploy
```

The `.deploy.env` template is created automatically on first integration setup; don't commit it.

### Manually re-running the doc sync

```bash
source .deploy.env
curl -fsS -X POST \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  https://cycling-coach.josem-reboredo.workers.dev/admin/document-release | jq
```

Returns a summary of which pages were updated/created, the open/shipped issue counts, and whether Claude or the deterministic fallback was used.

### Why deterministic fallback?

The `documentRelease` function works without any LLM — when `SYSTEM_ANTHROPIC_KEY` is unset, it generates the four pages from the deterministic inputs (CHANGELOG entry, commit list, roadmap data). The Roadmap page is *always* deterministic (it's a structured table from GitHub data). Only the Functional + Technical narratives benefit from Claude.

---

## Optional: GitHub auth for the Worker

By default the Worker uses anonymous GitHub API requests (60/hour rate limit per IP — plenty given the 5-min edge cache). If you ever want higher limits or to read private issues, add a `GITHUB_TOKEN` secret to the Worker:

```bash
echo -n "ghp_xxxxxxxx" | npx wrangler secret put GITHUB_TOKEN
```

The Worker auto-detects it.

## Security

For threat model, defences in place, and how to report a vulnerability, see [`SECURITY.md`](./SECURITY.md).
