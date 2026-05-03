# Sprint 11 Backlog

This document collects work that surfaced during the Sprint 11 prep
agents but that genuinely needs a future sprint — either because it
requires infra/external tooling that one-night agents shouldn't
fabricate, or because it's a follow-up to a fix that landed.

---

## Security backlog

Items raised by the `sprint-11-security` audit that go beyond a
single-night source review.

### S-BL-1 — Real pentest harness (sev: high — for a real sprint)

A static source review can't replace dynamic testing. A proper sprint
should add:
- A burp/zap-style intercepting proxy run against a staging worker.
- OAuth replay testing: confirm `OAUTH_STATE` KV nonces are truly
  single-use across concurrent callbacks (the source pattern looks
  right but only an actual race can prove it).
- Authn fuzzing on every `/api/*` (current `worker-authz-contract`
  test is static; an end-to-end CI step would assert "send athlete-A
  bearer to PATCH session-of-athlete-B → expect 404, never 200" with
  a real D1 setup).

**Why deferred:** needs a deployed staging worker with a clean D1,
Burp/ZAP licensing or replacement, and at least 2-3 days. Faking a
fuzzer in a one-night run is theatre.

### S-BL-2 — `/refresh` table-scan DoS surface (sev: low)

`src/worker.js:341` runs `SELECT … FROM user_connections WHERE
credentials_json LIKE '%"refresh_token":"<token>"%' LIMIT 1` on every
refresh attempt. The query is parameter-bound (no SQL injection) but
runs an unindexed table scan on a JSON-blob substring. A high-volume
scanner could soft-DoS via this surface even with rejected tokens.

**Fix:** migrate refresh_tokens to the indexed `strava_tokens` table
(already exists since v10.9.0). Remove the legacy LIKE-scan once the
hybrid migration window is over.

**Why deferred:** v10.9.0 introduced `strava_tokens` precisely so the
LIKE scan could retire. The refresh-flow migration is its own
release-shaped chunk, not a one-night patch.

### S-BL-3 — Per-IP rate limit on OAuth callback paths (sev: info)

`/callback`, `/callback-rwgps`, `/refresh` have no per-IP rate limit.
KV state-nonce makes replay safe, but a botnet could still saturate
the worker by replaying random state values, burning UUID parsing and
KV reads. Cloudflare's free-plan global request limit is the only
backstop today.

**Fix:** add `checkRateLimit(env, 'oauth-callback', ip, 30, 60)` at the
top of each callback handler.

**Why deferred:** wants real abuse signal data first — pre-emptive
rate limits often break legitimate flows on shared corporate egress
IPs. Backlog rather than guess.

### S-BL-4 — Atomic-rate-limit upgrade (sev: info)

`checkRateLimit()` does KV read-then-write, leaving a small race
window where N concurrent requests can pass before the counter
catches up. Acknowledged limitation; KV doesn't support atomic ops.

**Fix:** switch to Cloudflare's Rate Limiting product (paid Workers
plan) for hard limits on cost-runaway endpoints (`/coach`,
`/coach-ride`, `/api/plan/generate`).

**Why deferred:** plan-tier change.

### S-BL-5 — `/callback-rwgps` auth pre-condition (sev: info)

`src/routes/rwgpsRoutes.js:142` calls `resolveAthleteId(request)` in
the OAuth-callback handler, which expects a Bearer header. The OAuth
redirect from RWGPS won't carry one. Comment claims "Strava session
cookie" but the handler reads only the Authorization header. Either:
- The flow actually fails (functional bug, surfaced as the friendly
  error page) — needs a manual verify of the connect flow.
- A query-param fallback exists in the SPA that I missed.

**Fix:** trace the SPA's `/dashboard/today` → "Connect RWGPS" flow,
confirm whether the callback is reachable. If broken, switch
identity-resolution to a state-nonce binding that captures athlete_id
during `/authorize-rwgps`.

**Why deferred:** needs a working RWGPS dev account and a live test —
not a single-night source review.

### S-BL-6 — Dependency-audit CI gate (sev: info)

`apps/web` runs npm install with no `audit-level` gate in CI. A
high/critical npm advisory shipping in a transitive dep wouldn't fail
the build. Today `npm audit` reports 0 vulns (verified at audit time)
but no enforcement.

**Fix:** add `npm audit --audit-level=high` as a CI step in `.github/`
workflow (no workflow files exist in this repo today; needs the
sprint that adds CI).

**Why deferred:** the repo currently has no CI workflow files
(deploys via `scripts/deploy.sh`). CI sprint hasn't landed.

### S-BL-7 — Document security-review cadence in CONTRIBUTING.md

Currently nothing in `CONTRIBUTING.md` says "every release with a
new `/api/*` endpoint must add a contract test". The Sprint 11 audit
found the v10.11.3 cache-contract pattern is a great template
(`worker-cache-contract.test.ts`) and the new
`worker-authz-contract.test.ts` follows the same shape.

**Fix:** add a "Security review" section to `CONTRIBUTING.md` listing:
- Every new `/api/*` mutating handler must have a row in the authz
  contract test.
- Every new `/api/*` GET must be added to the cache-contract
  inventory.
- Every new admin endpoint must call `requireAdmin` first.

**Why deferred:** doc work; lands cleanest in the `sprint-11-docs`
agent's branch.

---

## Other backlog (placeholder)

The other Sprint 11 agents (`sprint-11-bugs`, `sprint-11-tests`,
`sprint-11-docs`) own their own backlog rows; this file's "security
backlog" section is the security agent's contribution. Founder may
want to merge these into a unified backlog when reviewing the four
branches.
