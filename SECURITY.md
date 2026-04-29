# Security

This document describes the threat model and active defences for Cycling Coach.

## Threat model

Cycling Coach is a single-user-per-browser web app deployed on Cloudflare Workers Static Assets. The Worker proxies the Strava OAuth flow + Anthropic Claude API and persists a normalized activities mirror in Cloudflare D1.

### Assets at risk

| Asset | Where it lives | Sensitivity |
|---|---|---|
| Strava access + refresh tokens (`cc_tokens`) | Browser localStorage + Cloudflare D1 (`user_connections.access_token` / `refresh_token`) | High — grants read access to the user's Strava activity feed |
| Anthropic API key (`cc_anthropicKey`) | Browser localStorage only | High — bring-your-own-key; spend tied to the user's Anthropic account |
| Athlete profile (`cc_athleteProfile`: FTP, weight, HR max) | Browser localStorage + Cloudflare D1 (`users.ftp_w`, `weight_kg`, `hr_max`) | Low — fitness metadata |
| OAuth `state` parameter | URL → Cloudflare KV (planned) | Medium — single-use nonce that prevents OAuth flow hijacking |
| `STRAVA_VERIFY_TOKEN` | Cloudflare Worker secret | Medium — gates webhook subscription registration |
| `STRAVA_WEBHOOK_PATH_SECRET` | Cloudflare Worker secret + the registered Strava webhook URL | High — gates webhook event acceptance |
| `ANTHROPIC_API_KEY` (optional fallback) | Cloudflare Worker secret | High — would be billed to the project if used |
| `GITHUB_TOKEN` | Cloudflare Worker secret | Medium — gives the Worker read-write access to the project repo for issue management |
| `ADMIN_SECRET` | Cloudflare Worker secret + `.deploy.env` | Medium — gates `/admin/*` Worker routes |

### Attack vectors considered

1. **XSS** — anyone exfiltrates localStorage tokens. Mitigated by React's default escaping (zero `dangerouslySetInnerHTML` usage today) + planned strict CSP (issue #16 Phase 2 follow-up).
2. **OAuth state CSRF** — attacker tricks user into completing OAuth with attacker's `code`, victim's browser stores attacker's tokens. Mitigation: replace deterministic JSON state with `crypto.randomUUID()` + KV-stored nonce (issue #15, deferred).
3. **Webhook spoofing** — third party POSTs fake events to `/webhook`. Mitigation (planned for v8.5.1, see #17): path-based shared secret (`/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>`); the Worker registers only the secret URL with Strava when multi-user approval lands. Wrong path returns **404** (OWASP guidance — don't leak existence of the canonical path to attackers). Not yet shipped on `main`.
4. **Cost runaway via /coach proxy** — script obtains user's `api_key` and spams Claude. Mitigation: Cloudflare Rate Limiting binding gates `/coach` and `/coach-ride` per IP + per athlete-id.
5. **Log exfiltration** — `observability.logs.persist: true` retains all `console.*` output. If a request handler logs body content, secrets land in persistent logs. Mitigation: every `console.*` call in the Worker is wrapped via `safeLog/Warn/Error`, which runs `redactSensitive()` over string + serialized-object args. Patterns redacted: `api_key=`, `sk-ant-*`, `access_token=`, `refresh_token=`.
6. **Webhook verify-token leak in source** — pre-v8.5.1 the Worker had a hardcoded fallback `'cycling-coach-verify'`. Anyone reading the source on GitHub knew it. Mitigation: webhook GET is now fail-closed — returns 503 if `STRAVA_VERIFY_TOKEN` is missing from Worker secrets.
7. **Admin endpoint exposure** — `/admin/*` routes (`document-release`, formerly `file-audit-issues`, etc.) handle high-impact operations. Mitigation: `requireAdmin()` checks `Authorization: Bearer ${ADMIN_SECRET}` on every call.

## Shipped defences (live on `main` today)

This section reflects only what is currently in the `main` branch. Items in flight (post-`main`-merge, pre-v8.5.1-deploy) live under "Planned defences" below.

- **Worker-side**
  - `requireAdmin` (`Authorization: Bearer ${ADMIN_SECRET}`) on every `/admin/*` route — since v8.3.0.
  - `redactSensitive` wraps high-risk `console.*` call sites (5 of 12 sites — webhook event log + 4 D1 error/parse paths). Patterns redacted: `api_key=`, `sk-ant-*`, `access_token=`, `refresh_token=`. Status/count logs like `[D1] Persisted N activities` are left as raw `console.log` because they don't interpolate untrusted data. Commit `16fff43`.
  - Fail-closed `STRAVA_VERIFY_TOKEN` check — webhook GET returns 503 if the secret is not configured. No hardcoded fallback in source. Commit `16fff43`.
- **Browser-side**
  - React's default escaping (zero `dangerouslySetInnerHTML` usage).
  - `localStorage` reads / writes wrapped in `try / catch` so corrupt entries can't crash the app.
  - PWA service worker `NEVER_CACHE` excludes `/api/*`, `/authorize`, `/callback`, `/refresh`, `/coach*`, `/webhook`, `/version`, `/admin/*`, `/roadmap` from caching.
- **Transport**
  - HTTPS-only via Cloudflare. PWA `manifest.webmanifest` declares `start_url: /` over the workers.dev origin.

## Planned defences (v8.5.1 release, not yet on `main`)

- **Webhook path-secret** (#17) — `/webhook/<env.STRAVA_WEBHOOK_PATH_SECRET>` becomes the canonical webhook URL. Legacy `/webhook` and any `/webhook/<wrong-secret>` return **404** (OWASP — no info leak about path existence). Code path will land in v8.5.1; **webhook re-registration with Strava is deferred** until multi-user API approval (single-user mode today, no active webhook to migrate).
- **KV-based rate-limit on `/admin/document-release`** (#18) — 5 attempts per minute per IP. Returns 429 with `Retry-After` header on threshold; failed attempts logged with source IP for monitoring. Uses `DOCS_KV` namespace (Free-plan-compatible). Defends against `ADMIN_SECRET` leak and runaway-loop bugs in CI.

## Deferred / out of scope

- **Cloudflare-native rate-limit binding for `/api/*` and `/coach` + `/coach-ride`** — requires Workers Paid plan; **deferred indefinitely** while on Free. The cost-runaway risk for `/coach` (#4 above) is therefore mitigated **only at the user side** (the user safeguards their BYOK Anthropic key); Worker-side enforcement is not on the roadmap.
- **OAuth state nonce** — replace deterministic JSON state with `crypto.randomUUID()` + KV-backed single-use nonce (mitigates attack vector #2). Not yet filed as a tracked issue.
- **Strict CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`** on all Worker responses — see issue #15.
- **CORS lockdown** on `/coach` + `/coach-ride` (replace `Access-Control-Allow-Origin: *` with allowlist) — see issue #16.
- **httpOnly cookie storage** for Strava tokens — longer-term refactor, requires session-cookie story in the Worker.
- **D1-backed audit log for `/admin/*`** — write each call (caller IP, route, result) for after-the-fact incident response.

## Deploy runbook (operator actions before each release)

The shipped defences above require Worker secrets to be set before the v8.5.1 deploy:

```bash
# Generate strong random values
echo -n "$(openssl rand -hex 32)" | npx wrangler secret put STRAVA_VERIFY_TOKEN
echo -n "$(openssl rand -hex 32)" | npx wrangler secret put STRAVA_WEBHOOK_PATH_SECRET
```

After multi-user Strava API approval lands, register the webhook with the new path:

```bash
# Replace <secret> with the value of STRAVA_WEBHOOK_PATH_SECRET
curl -X POST "https://www.strava.com/api/v3/push_subscriptions" \
  -F client_id=<STRAVA_CLIENT_ID> \
  -F client_secret=<STRAVA_CLIENT_SECRET> \
  -F callback_url="https://cycling-coach.josem-reboredo.workers.dev/webhook/<secret>" \
  -F verify_token=<STRAVA_VERIFY_TOKEN>
```

Until that registration runs, the new `/webhook/<secret>` path is dormant — no harm, just ready.

## Disclosure policy

Reporting a vulnerability:

1. **Preferred** — open a private GitHub Security Advisory at `https://github.com/jose-reboredo/cycling-coach/security/advisories/new`.
2. **Alternative** — email the maintainer (see git log).

Please do not publicly disclose the issue until a fix has been deployed. We aim to triage within 7 days and to ship a fix or mitigation within 30 days for High-severity issues.

## Verification

To verify these defences after a deploy:

```bash
# Webhook fail-closed (without secret set, should return 503)
curl -i "https://cycling-coach.josem-reboredo.workers.dev/webhook?hub.mode=subscribe&hub.verify_token=anything"

# Admin endpoint gated (without bearer, should return 401)
curl -i -X POST "https://cycling-coach.josem-reboredo.workers.dev/admin/document-release"

# Logs scanned for secrets — Cloudflare dashboard → Workers → cycling-coach → Logs
#   filter: "sk-ant-"  → expected: no matches
#   filter: "api_key=" → expected: no matches (or only "[redacted]")
```
