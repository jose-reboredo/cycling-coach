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

## Weekly release cadence

Mondays:
1. Triage open issues, assign milestones (`v8.x.0`).
2. Move started ones into "In progress" by adding the `status:in-progress` label or assigning yourself.

Throughout the week:
3. Close issues as work merges to `main`.
4. Push to `main` → Cloudflare Workers Builds picks it up (or run `npm run deploy` locally).

End of week:
5. Bump the version in `package.json`, root `package.json`, `apps/web/package.json`, `src/worker.js` (`WORKER_VERSION`), and `apps/web/src/pages/Landing.tsx` footer.
6. Add a `## [vX.Y.Z]` entry to `CHANGELOG.md`.
7. Tag the commit: `git tag vX.Y.Z && git push --tags`.
8. The roadmap auto-updates from the now-closed issues.

## Local dev

```bash
npm run dev:all      # Vite (5173) + wrangler (8787) in parallel
```

`/roadmap` works in dev — Vite proxies it to the Worker which fetches GitHub Issues.

## Optional: GitHub auth for the Worker

By default the Worker uses anonymous GitHub API requests (60/hour rate limit per IP — plenty given the 5-min edge cache). If you ever want higher limits or to read private issues, add a `GITHUB_TOKEN` secret to the Worker:

```bash
echo -n "ghp_xxxxxxxx" | npx wrangler secret put GITHUB_TOKEN
```

The Worker auto-detects it.
