# Release Checklist — Cadence Club

Manual QA + housekeeping run on every prod release (after `npm run deploy`).

Created 2026-04-30 from the Sprint-3 backlog review (`docs/post-demo-sprint/sprint-3/backlog-review.md`) — items here are the "do every release" checklist counterpart to the GitHub-tracked feature/bug backlog.

---

## Per-release checks

### 1. Smoke gates (automated where possible)

- [ ] `/version` returns the new version
- [ ] Mobile-tabs Playwright spec runs green against prod (`E2E_TARGET_PROD=1 npx playwright test mobile-tabs.spec.ts` from `apps/web/`)
- [ ] Auth gates regression check — `/coach`, `/coach-ride`, `/api/routes/saved`, `/api/routes/discover`, `/api/clubs` all return `401` without a Strava bearer
- [ ] `X-Forwarded-Host: evil.com` on `/authorize` still redirects to Strava with our prod redirect_uri (origin-allowlist working — `#34`)
- [ ] Security headers present on a Worker response and a static asset (`curl -I /version` and `curl -I /icon.svg` both show CSP/HSTS/X-Frame-Options/etc. — `#15`)
- [ ] DELETE/PUT/PATCH on `/api/<random>` return 405 (method allowlist working — `#41`)

### 2. iOS Add-to-Home-Screen validation (formerly part of `#10`, now lives here)

Run on a real iPhone (not Simulator) after each release that touches the SPA shell, manifest, or service worker:

- [ ] Open `https://cycling-coach.josem-reboredo.workers.dev` in iOS Safari
- [ ] Share menu → Add to Home Screen → Add
- [ ] Tap the home-screen icon — app opens in **standalone** mode (no browser chrome, no Safari UI)
- [ ] Splash colour matches the dark canvas (`#0a0a0c`) — no white flash
- [ ] App icon on the home screen renders correctly (no fallback initial)
- [ ] `/dashboard` flow works end-to-end (Strava OAuth, BYOK key entry, Generate plan)
- [ ] If anything regresses, file a fresh issue (the `#10` umbrella now tracks the offline PMC tile only — see `https://github.com/jose-reboredo/cycling-coach/issues/10`)

### 3. Backlog hygiene

- [ ] Any "Closes #N" keywords in the release commits resulted in the corresponding issue being auto-closed on push
- [ ] CHANGELOG.md entry added; README.md "What's new" updated; both in the same release-cut commit
- [ ] Confluence release entry auto-created (deploy logs the new entry id)
- [ ] No `.DS_Store` / accidental files in the release commit (use targeted `git add` rather than `git add -A`)

---

## When to file a new issue vs add to this list

- **Per-release manual QA** → add to this checklist (e.g. iOS validation, browser smoke)
- **Time-bounded feature/bug work** → file a GitHub issue with sprint slot
- **Backlog item with a "trigger" condition** (like `#31` log rate-limit, `#8` TSS backfill) → keep in GitHub but with the trigger documented in the body

The checklist exists to keep recurring manual work from cluttering the issue tracker — and the issue tracker exists to keep one-shot work from rotting in this file.
