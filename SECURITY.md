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
3. **Webhook spoofing** — third party POSTs fake events to `/webhook`. Mitigation: path-based shared secret (`/webhook/<secret>`); the Worker only registered the secret URL with Strava. Wrong path returns 403.
4. **Cost runaway via /coach proxy** — script obtains user's `api_key` and spams Claude. Mitigation: Cloudflare Rate Limiting binding gates `/coach` and `/coach-ride` per IP + per athlete-id.
5. **Log exfiltration** — `observability.logs.persist: true` retains all `console.*` output. If a request handler logs body content, secrets land in persistent logs. Mitigation: every `console.*` call in the Worker is wrapped via `safeLog/Warn/Error`, which runs `redactSensitive()` over string + serialized-object args. Patterns redacted: `api_key=`, `sk-ant-*`, `access_token=`, `refresh_token=`.
6. **Webhook verify-token leak in source** — pre-v8.5.1 the Worker had a hardcoded fallback `'cycling-coach-verify'`. Anyone reading the source on GitHub knew it. Mitigation: webhook GET is now fail-closed — returns 503 if `STRAVA_VERIFY_TOKEN` is missing from Worker secrets.
7. **Admin endpoint exposure** — `/admin/*` routes (`document-release`, formerly `file-audit-issues`, etc.) handle high-impact operations. Mitigation: `requireAdmin()` checks `Authorization: Bearer ${ADMIN_SECRET}` on every call.

## Defences in place (v8.5.1+)

- **Worker-side** — `requireAdmin` on all `/admin/*` routes; `redactSensitive` wraps all logging; fail-closed `STRAVA_VERIFY_TOKEN` check; path-secret webhook URL; rate-limit gate on `/coach` + `/coach-ride`.
- **Browser-side** — React escaping; localStorage with `try/catch` so corrupt entries can't crash the app; PWA service worker excludes `/api/*`, `/authorize`, `/callback`, `/refresh`, `/coach*`, `/webhook`, `/version`, `/admin/*`, `/roadmap` from caching.
- **Transport** — HTTPS-only via Cloudflare. PWA `manifest.webmanifest` declares `start_url: /` over the workers.dev origin.

## Future considerations

- OAuth state nonce via KV (issue #15) — replaces deterministic JSON state.
- Strict CSP (issue #16) — `default-src 'self'`, allow-list for `connect-src` (Strava + Anthropic + GitHub), `script-src 'self'`.
- HSTS + clickjack headers (`X-Frame-Options: DENY`, `Referrer-Policy`) on every response.
- Migrate Strava tokens from localStorage to httpOnly cookies once the Worker has a session-cookie story (longer-term refactor).
- Audit logs for `/admin/*` invocations — write each call to D1 with caller IP + result.

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
