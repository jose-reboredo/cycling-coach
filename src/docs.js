// ============================================================
// Cycling Coach — Confluence canonical documentation source
// ============================================================
// Each entry below is a page that lives under the project homepage on
// Confluence. The /admin/document-release endpoint upserts these on every
// prod deploy.
//
// Update mechanic:
//   • Spec pages (this array): init-once. Re-pushed only when the storage
//     XHTML changes (we hash + compare via DOCS_KV). To update the
//     architecture / API / etc. doc, edit the storage value in this file
//     and ship a deploy.
//   • Roadmap page: always regenerated from GitHub Issues.
//   • Releases page: append-only — one child per WORKER_VERSION.
//
// Numeric prefix on titles is a UX hint to keep them in order on the
// homepage tree. Confluence sorts children alphanumerically by default.
// ============================================================

const STUB = (name, stepRef) => `<h1>${name}</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Placeholder — full content lands in <strong>${stepRef}</strong> (see <a href="https://github.com/jose-reboredo/cycling-coach/issues/23">issue #23</a>).</p></ac:rich-text-body></ac:structured-macro>
<p><em>This page is auto-managed. Don't edit it in Confluence — the canonical content lives in <code>src/docs.js</code> in the repo. Pushes happen on every prod deploy via <code>/admin/document-release</code>.</em></p>`;

export const SPEC_PAGES = [
  {
    slug: 'systems-architecture',
    title: '1. Systems & Architecture',
    storage: `<h1>Systems &amp; Architecture</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Authoritative picture of how Cycling Coach is built — components, data flows, deployment. <strong>Auto-managed</strong>: canonical content lives in <code>src/docs.js</code> in the repo and is upserted on every prod deploy. Don't edit in Confluence.</p></ac:rich-text-body></ac:structured-macro>

<h2>1. Overview</h2>
<p>Cycling Coach is a <strong>performance training intelligence app</strong> for serious cyclists (target persona: Marco — FTP-aware amateur, 8–12 h/week, training for a goal event). It pulls Strava activity data, computes the <strong>PMC</strong> (Performance Management Chart — CTL/ATL/TSB), surfaces structured workouts via an AI coach (Anthropic Claude), suggests routes that match today's workout, and tracks streaks / wins / volume.</p>
<p>The system is a single <strong>Cloudflare Worker</strong> serving both a <strong>React SPA</strong> (via Workers Static Assets) and a small set of dynamic API routes. State lives client-side in <code>localStorage</code> and (Strangler-Fig) in <strong>Cloudflare D1</strong> (SQLite at edge).</p>

<h2>2. Components</h2>
<table>
  <tbody>
    <tr><th>Component</th><th>Role</th><th>Tech / runtime</th><th>Source</th></tr>
    <tr><td><strong>Cloudflare Worker</strong></td><td>Edge compute: OAuth, Strava API proxy, AI proxy, webhook receiver, roadmap mirror, admin endpoints, doc-sync</td><td>Workers runtime (V8 isolate)</td><td><code>src/worker.js</code></td></tr>
    <tr><td><strong>React SPA</strong></td><td>UI: Landing, Dashboard, Privacy, What's next</td><td>React 19 + Vite + TypeScript + Tanstack Router/Query + Motion + CSS Modules</td><td><code>apps/web/src/</code></td></tr>
    <tr><td><strong>Cloudflare D1</strong></td><td>SQLite at edge: <code>users</code>, <code>user_connections</code>, <code>activities</code>, <code>daily_load</code>, <code>goals</code>, <code>training_prefs</code>, <code>ai_reports</code>, <code>ride_feedback</code>, <code>clubs</code> (Phase 2)</td><td>D1 (SQLite)</td><td><code>schema.sql</code> + <code>migrations/0001_pmc_and_events.sql</code></td></tr>
    <tr><td><strong>Cloudflare KV</strong></td><td>DOCS_KV — Confluence page-ID + content-hash cache. Future use: OAuth nonces (issue #14), training prefs (issue #11)</td><td>KV</td><td>Bound in <code>wrangler.jsonc</code></td></tr>
    <tr><td><strong>Anthropic Claude</strong></td><td>AI weekly plan (<code>/coach</code>) + per-ride verdict (<code>/coach-ride</code>) + auto-doc generation (when <code>SYSTEM_ANTHROPIC_KEY</code> set)</td><td>Sonnet 4.6 via REST</td><td>BYOK (user-provided) + optional system fallback</td></tr>
    <tr><td><strong>Strava API</strong></td><td>OAuth, athlete profile, activities, saved routes, webhooks</td><td>REST v3</td><td>External</td></tr>
    <tr><td><strong>GitHub Issues</strong></td><td>Roadmap source of truth; surfaced via <code>/roadmap</code> → <code>/whats-next</code></td><td>REST v3</td><td><code>jose-reboredo/cycling-coach</code></td></tr>
    <tr><td><strong>Confluence</strong></td><td>Project documentation; auto-updated each prod deploy</td><td>v2 REST</td><td><code>josemreboredo.atlassian.net</code> space <code>CC</code></td></tr>
  </tbody>
</table>

<h2>3. Architecture diagram</h2>
<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">text</ac:parameter><ac:plain-text-body><![CDATA[
                       ┌─────────────────────┐
                       │     Browser (UI)    │
                       │   React 19 SPA      │
                       │  cc_tokens in LS    │
                       └──────────┬──────────┘
                                  │ HTTPS (single origin)
                                  ↓
              ┌───────────────────────────────────────┐
              │  Cloudflare Worker                    │
              │  (Workers Static Assets — same origin │
              │   serves SPA + API)                   │
              │                                       │
              │  /authorize  /callback    /refresh    │
              │  /api/*      /coach       /coach-ride │
              │  /webhook    /version     /roadmap    │
              │  /admin/*  (gated by ADMIN_SECRET)    │
              └─────┬───────────┬───────────┬─────────┘
                    │           │           │
                    ↓           ↓           ↓
               ┌────────┐  ┌────────┐  ┌──────────┐
               │ Strava │  │ Claude │  │ GitHub   │
               │  API   │  │  API   │  │  Issues  │
               └────────┘  └────────┘  └──────────┘
                    ↓                       ↑
               ┌────────┐                   │
               │   D1   │ ←─ Strangler-Fig dual-write
               │(SQLite)│                   │
               └────────┘                   │
                                            │
               ┌──────────────────────┐     │
               │ Confluence Auto-Doc  │ ←───┘  (every deploy)
               │  (this Confluence)   │
               └──────────────────────┘
]]></ac:plain-text-body></ac:structured-macro>

<h2>4. Data flows</h2>

<h3>4.1 Auth flow (Strava OAuth)</h3>
<ol>
  <li>User clicks <strong>Connect</strong> → browser navigates to <code>/authorize</code>.</li>
  <li>Worker constructs the Strava OAuth URL with <code>redirect_uri = &lt;origin&gt;/callback</code>. Origin is resolved by <code>userOrigin()</code> in priority: <code>?origin=</code> query param (only honored for localhost loopbacks — security), <code>X-Forwarded-Host</code> header, fallback to <code>url.origin</code>. State param is currently base64-JSON of <code>{pwa, origin}</code>; issue #14 tracks turning this into a CSRF nonce stored in KV.</li>
  <li>User authorizes on Strava.</li>
  <li>Strava redirects to <code>/callback?code=&hellip;&state=&hellip;</code>.</li>
  <li>Worker exchanges code for <code>access_token</code> + <code>refresh_token</code> via Strava's token endpoint.</li>
  <li>Worker writes tokens to D1 <code>user_connections</code> (Strangler-Fig persist) <strong>and</strong> returns a tiny HTML page that sets <code>cc_tokens</code> in <code>localStorage</code> and redirects to <code>/dashboard</code>. (PWA-mode: returns a copy-tokens UI instead of auto-redirect.)</li>
  <li>SPA reads <code>cc_tokens</code>, attaches <code>Authorization: Bearer</code> on every <code>/api/*</code> call.</li>
</ol>
<p><strong>Token refresh:</strong> SPA's <code>ensureValidToken()</code> runs before each authed call; if <code>expires_at &lt; now + 5 min</code>, it POSTs to <code>/refresh</code>; Worker calls Strava's refresh endpoint; updated tokens write back to localStorage <em>and</em> D1.</p>

<h3>4.2 Read path (Strava data)</h3>
<ol>
  <li>SPA hooks (<code>useAthlete</code>, <code>useActivities</code>, <code>useActivityDetail</code>) call <code>/api/athlete</code> + <code>/api/athlete/activities</code> + <code>/api/activities/{id}</code> via Tanstack Query.</li>
  <li>Worker proxies the request to Strava with the Bearer token forwarded.</li>
  <li>For <code>athlete/activities</code> responses, Worker also persists each activity into D1 (<code>persistActivities()</code> — Strangler-Fig).</li>
  <li>SPA converts each Strava activity to the internal <code>MockActivity</code> shape via <code>stravaConvert.ts</code>, computing TSS / NP / primary zone using the user's FTP from <code>useAthleteProfile()</code>. If FTP is unset, falls back to a duration-based proxy (≈70 TSS/h).</li>
  <li>Derived widgets (<code>PmcStrip</code>, <code>StreakHeatmap</code>, <code>VolumeChart</code>, <code>WinsTimeline</code>, recents list) render from the converted list.</li>
</ol>

<h3>4.3 AI path (BYOK + system fallback)</h3>
<ol>
  <li>User pastes Anthropic API key into the AI Coach card → stored in <code>cc_anthropicKey</code> in localStorage.</li>
  <li>Dashboard POSTs to <code>/coach</code> (weekly plan) or <code>/coach-ride</code> (per-ride verdict) with stats + recent rides + key + sessions/week prefs.</li>
  <li>Worker validates request, forwards to Claude API (<code>x-api-key: &lt;user_key&gt;</code>).</li>
  <li>Claude returns structured JSON.</li>
  <li>Worker validates the response — for the weekly plan, it post-processes to enforce the requested session count (force-rests extra days if Claude over-prescribed).</li>
  <li>SPA caches the result in <code>cc_aiReport</code> (weekly plan) or <code>cc_rideFeedback[id]</code> (per-ride).</li>
</ol>
<p>Auto-doc generation also uses Claude when <code>SYSTEM_ANTHROPIC_KEY</code> is set as a Worker secret; otherwise the deterministic fallback runs.</p>

<h3>4.4 Roadmap path</h3>
<ol>
  <li>SPA <code>/whats-next</code> calls <code>/roadmap</code> via Tanstack Query (5-min stale-time).</li>
  <li>Worker checks <code>caches.default</code> for a 5-minute edge cache. Cache miss → calls <code>api.github.com/repos/jose-reboredo/cycling-coach/issues</code> (with <code>GITHUB_TOKEN</code> for higher rate limits — 5,000/h authenticated).</li>
  <li>Each issue is normalised by <code>normalizeGhIssue()</code> to <code>{id, number, title, body, area, priority, status, target}</code> using labels (<code>area:*</code>, <code>priority:*</code>) and milestone metadata.</li>
  <li>Cached at edge for 5 min → SPA also caches via Tanstack Query for 5 min.</li>
</ol>

<h3>4.5 Doc-sync path (Confluence)</h3>
<ol>
  <li>Local <code>npm run deploy</code> runs the chain: <code>npm run build:web &amp;&amp; wrangler deploy &amp;&amp; npm run docs:sync</code>.</li>
  <li><code>docs:sync</code> POSTs to <code>/admin/document-release</code> with <code>Authorization: Bearer $ADMIN_SECRET</code>.</li>
  <li>Worker (<code>documentRelease()</code>):
    <ul>
      <li>Cleanup: deletes legacy pages from prior structure (one-time).</li>
      <li>For each spec page in <code>SPEC_PAGES</code> (this list of canonical docs): ensures it exists, computes content hash, PUTs only if hash differs from the cached hash in <code>DOCS_KV</code>.</li>
      <li>Roadmap page: regenerated fresh from GitHub Issues.</li>
      <li>Releases page: appends a child for the current <code>WORKER_VERSION</code> if missing (idempotent).</li>
    </ul>
  </li>
  <li>Returns a JSON summary: which pages were updated/created, current roadmap counts, etc.</li>
</ol>

<h2>5. Deployment topology</h2>
<ul>
  <li><strong>Production URL:</strong> <a href="https://cycling-coach.josem-reboredo.workers.dev">cycling-coach.josem-reboredo.workers.dev</a> (single origin — both SPA and API).</li>
  <li><strong>Build:</strong> <code>npm run build:web</code> → Vite produces <code>apps/web/dist</code>.</li>
  <li><strong>Deploy:</strong> <code>wrangler deploy</code> → Worker code + the static-asset bundle uploaded as a single deployment unit (Workers Static Assets).</li>
  <li><strong>Doc-sync:</strong> <code>npm run docs:sync</code> POSTs to admin endpoint after the deploy succeeds.</li>
  <li><strong>CI:</strong> Cloudflare Workers Builds; on push to <code>main</code> the same chain runs (issue #9 — set CI build command to <code>npm run build:web</code>).</li>
</ul>
<p><strong>Run-worker-first paths</strong> (from <code>wrangler.jsonc → assets.run_worker_first</code>): <code>/api/*</code>, <code>/authorize</code>, <code>/callback</code>, <code>/refresh</code>, <code>/coach</code>, <code>/coach-ride</code>, <code>/webhook</code>, <code>/version</code>, <code>/roadmap</code>. Everything else falls through to static assets; unknown routes serve <code>index.html</code> via <code>not_found_handling: single-page-application</code> (so React Router handles client-side routing for <code>/dashboard</code>, <code>/privacy</code>, <code>/whats-next</code>).</p>

<h2>6. Environments</h2>
<table>
  <tbody>
    <tr><th>Env</th><th>URL</th><th>Tokens / secrets</th><th>Notes</th></tr>
    <tr><td><strong>Production</strong></td><td>cycling-coach.josem-reboredo.workers.dev</td><td>Cloudflare secrets (<code>STRAVA_CLIENT_SECRET</code>, <code>GITHUB_TOKEN</code>, <code>CONFLUENCE_API_TOKEN</code>, <code>CONFLUENCE_USER_EMAIL</code>, <code>ADMIN_SECRET</code>)</td><td>D1 remote, KV remote, Strava production app</td></tr>
    <tr><td><strong>Local dev</strong></td><td>localhost:5173 (SPA, Vite) + localhost:8787 (Worker, wrangler dev)</td><td><code>.dev.vars</code> for Strava + <code>.deploy.env</code> for ADMIN_SECRET (gitignored)</td><td><code>npm run dev:all</code> via concurrently; D1 local; Vite proxies <code>/api/*</code> + auth paths → Worker</td></tr>
  </tbody>
</table>

<h2>7. Versioning &amp; release cadence</h2>
<p>SemVer. Weekly cadence by default. Hotfixes (<code>v8.x.y</code> patches) ship out-of-band when needed.</p>
<p>Version stamped in three places (must stay in sync):</p>
<ul>
  <li><code>src/worker.js</code> — <code>const WORKER_VERSION</code></li>
  <li><code>package.json</code> + <code>apps/web/package.json</code></li>
  <li><code>apps/web/src/pages/Landing.tsx</code> footer</li>
</ul>
<p>Surfaced at runtime via <code>/version</code> endpoint and the landing footer.</p>
<p><strong>Release artefacts</strong> per version: a <code>## [vX.Y.Z]</code> entry in <code>CHANGELOG.md</code>, a child page on Confluence (<code>Releases / Release vX.Y.Z</code>), and a closed milestone on GitHub.</p>

<h2>8. Architectural decision log</h2>
<table>
  <tbody>
    <tr><th>Decision</th><th>Rationale</th></tr>
    <tr><td>Single Worker for SPA + API (no separate Pages project)</td><td>Single origin → no CORS, single deploy, single CI. Workers Static Assets is the modern recommended path; Pages is in maintenance mode.</td></tr>
    <tr><td>localStorage for auth tokens (no server-side session)</td><td>Zero session infrastructure. Standard for OAuth-only apps. Trade-off: vulnerable to XSS — defended by React's default escaping + planned CSP (issue #15).</td></tr>
    <tr><td>BYOK for Anthropic (no pooled key)</td><td>No per-user billing on our side. User has full control + cost transparency. ≈ $0.02/report.</td></tr>
    <tr><td>Strangler-Fig dual-write (localStorage + D1)</td><td>Migration path from browser-only to server-backed without breaking existing users. D1 will become source of truth once parity is verified.</td></tr>
    <tr><td>GitHub Issues as roadmap source of truth</td><td>Single source. Worker mirrors via <code>/roadmap</code>, SPA renders at <code>/whats-next</code>. Confluence Roadmap page also mirrors. Avoids drift across surfaces.</td></tr>
    <tr><td>Confluence as project-doc source</td><td>Stakeholder-readable. Auto-updated. Pages structured by concern (this page, APIs, Interfaces, etc.) rather than by chronology.</td></tr>
    <tr><td>CSS Modules + design tokens (no Tailwind)</td><td>Distinctive design system (PARS — Performance Dark) is too custom for utility-first; tokens-driven CSS keeps the aesthetic intact across components.</td></tr>
    <tr><td>Two-step Confluence delete (trash → purge)</td><td>v2 API requires it; first DELETE moves to trash, second DELETE with <code>?purge=true</code> permanently removes. Doc-sync swallows the second-error case (race / not-yet-trashed).</td></tr>
  </tbody>
</table>

<h2>9. Cross-references</h2>
<ul>
  <li><strong>APIs</strong> — for endpoint signatures, auth headers, request/response shapes.</li>
  <li><strong>User Interfaces</strong> — for routes, components, design tokens, accessibility posture.</li>
  <li><strong>Functional Specification</strong> — for per-feature behavior + user stories.</li>
  <li><strong>Technical Specification</strong> — for repo layout, schema, build pipeline.</li>
  <li><strong>Security</strong> — for threat model, secrets inventory, open hardening backlog.</li>
  <li><strong>Roadmap</strong> — live status of every open issue.</li>
</ul>`,
  },
  {
    slug: 'apis',
    title: '2. APIs',
    storage: `<h1>APIs</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Authoritative endpoint inventory for the Cycling Coach Worker, plus the external APIs we consume. <strong>Auto-managed</strong> — content lives in <code>src/docs.js</code>, pushed on every deploy.</p></ac:rich-text-body></ac:structured-macro>

<h2>1. Worker endpoint inventory</h2>
<table>
  <tbody>
    <tr><th>Path</th><th>Method</th><th>Auth</th><th>Purpose</th></tr>
    <tr><td><code>/authorize</code></td><td>GET</td><td>None</td><td>302 to Strava OAuth</td></tr>
    <tr><td><code>/callback</code></td><td>GET</td><td>OAuth code</td><td>Exchange code → tokens, set localStorage, redirect to /dashboard</td></tr>
    <tr><td><code>/refresh</code></td><td>POST</td><td>Refresh token in body</td><td>Refresh expired Strava access token</td></tr>
    <tr><td><code>/api/*</code></td><td>GET / POST</td><td>Bearer (Strava access token)</td><td>Generic Strava API proxy. Persists activities to D1 on the side.</td></tr>
    <tr><td><code>/coach</code></td><td>POST</td><td>BYOK (Anthropic key in body)</td><td>Generate weekly plan via Claude</td></tr>
    <tr><td><code>/coach-ride</code></td><td>POST</td><td>BYOK (Anthropic key in body)</td><td>Generate per-ride coach verdict via Claude</td></tr>
    <tr><td><code>/webhook</code></td><td>GET</td><td>Strava verify token (env)</td><td>Webhook subscription verification</td></tr>
    <tr><td><code>/webhook</code></td><td>POST</td><td>None (currently)</td><td>Strava webhook event delivery — logged only (issue #17)</td></tr>
    <tr><td><code>/version</code></td><td>GET</td><td>None</td><td>Health + version JSON</td></tr>
    <tr><td><code>/roadmap</code></td><td>GET</td><td>None</td><td>GitHub Issues mirror, 5-min edge cache</td></tr>
    <tr><td><code>/admin/document-release</code></td><td>POST</td><td><code>Authorization: Bearer $ADMIN_SECRET</code></td><td>Confluence doc-sync</td></tr>
  </tbody>
</table>

<h2>2. Endpoint detail</h2>

<h3>2.1 <code>GET /authorize</code></h3>
<p>Builds the Strava OAuth URL and 302s the browser to it. Encodes <code>{pwa, origin}</code> into the OAuth <code>state</code> param so <code>/callback</code> can route the user back to the right host (works for Vite dev on :5173 even though the Worker runs at :8787).</p>
<table><tbody>
<tr><th>Query params</th><td><code>?origin=&lt;localhost-only&gt;</code> (optional, dev-only), <code>?pwa=1</code> (optional)</td></tr>
<tr><th>Response</th><td>302 Location: <code>https://www.strava.com/oauth/authorize?client_id=...&amp;redirect_uri=...&amp;state=...</code></td></tr>
<tr><th>Errors</th><td>None expected; if <code>STRAVA_CLIENT_ID</code> missing, Strava returns the error.</td></tr>
</tbody></table>

<h3>2.2 <code>GET /callback</code></h3>
<p>Strava redirects here after OAuth approval. We exchange the auth code for tokens, persist to D1 (Strangler-Fig), and return HTML that drops <code>cc_tokens</code> into <code>localStorage</code> and redirects to <code>/dashboard</code>.</p>
<table><tbody>
<tr><th>Query params</th><td><code>?code=&lt;strava_code&gt;</code>, <code>?state=&lt;b64-json&gt;</code></td></tr>
<tr><th>Response</th><td>HTML with inline JS — sets <code>localStorage.cc_tokens</code>, redirects to <code>/dashboard</code> (or, in PWA mode, shows copy-tokens UI)</td></tr>
<tr><th>Errors</th><td>Renders <code>errorPage()</code> with Strava's error message if exchange fails</td></tr>
</tbody></table>

<h3>2.3 <code>POST /refresh</code></h3>
<table><tbody>
<tr><th>Body</th><td><code>{ refresh_token: string }</code></td></tr>
<tr><th>Response</th><td><code>{ access_token, refresh_token, expires_at, athlete? }</code> (Strava's token response)</td></tr>
<tr><th>Side effect</th><td>If <code>data.athlete?.id</code> present, updates <code>user_connections</code> in D1</td></tr>
<tr><th>Errors</th><td><code>{ error: &lt;message&gt; }</code> with status 500 on fetch failure</td></tr>
</tbody></table>

<h3>2.4 <code>GET /api/*</code> (Strava proxy)</h3>
<p>Generic forwarder to <code>https://www.strava.com/api/v3/&lt;path&gt;&lt;query&gt;</code>. Path is whatever follows <code>/api/</code>.</p>
<table><tbody>
<tr><th>Headers</th><td><code>Authorization: Bearer &lt;access_token&gt;</code> (forwarded)</td></tr>
<tr><th>Response</th><td>Whatever Strava returns; status, body, content-type passed through</td></tr>
<tr><th>Side effect</th><td>If <code>stravaPath === 'athlete/activities'</code>, parses the JSON array and persists each row to D1 via <code>persistActivities()</code></td></tr>
<tr><th>Common subpaths</th><td><code>athlete</code> (profile), <code>athlete/activities</code> (list), <code>activities/{id}</code> (detail with splits + segments), <code>athlete/routes</code> (saved routes — issue #8)</td></tr>
<tr><th>Errors</th><td>401 if <code>Authorization</code> header missing; otherwise Strava's error pass-through</td></tr>
</tbody></table>

<h3>2.5 <code>POST /coach</code></h3>
<p>Generates the weekly plan. Worker constructs a coach prompt, forwards to Claude with the user's <code>api_key</code>, validates the response (enforces session count), returns to caller.</p>
<table><tbody>
<tr><th>Body</th><td><code>{ athlete: {firstname}, stats: {...}, recent: [...rides], api_key: string, prefs: { sessions_per_week: 1..7 } }</code></td></tr>
<tr><th>Response</th><td><code>{ summary, strengths[], areasToImprove[], weeklyPlan: {monday..sunday}, sessions_per_week, motivation, _adjusted? }</code></td></tr>
<tr><th>Errors</th><td><code>{ error, invalid_key? }</code> with 401 (no key) / 5xx (Claude or parse error)</td></tr>
</tbody></table>

<h3>2.6 <code>POST /coach-ride</code></h3>
<table><tbody>
<tr><th>Body</th><td><code>{ ride: {name, distance_km, duration_min, ...}, athlete: {firstname}, context: {totalRides, ...}, api_key }</code></td></tr>
<tr><th>Response</th><td><code>{ verdict, feedback, next }</code></td></tr>
<tr><th>Errors</th><td>Same shape as <code>/coach</code></td></tr>
</tbody></table>

<h3>2.7 <code>GET /webhook</code></h3>
<p>Strava webhook subscription verification. Strava sends <code>?hub.mode=subscribe&amp;hub.verify_token=...&amp;hub.challenge=...</code> when first registering the webhook. We echo back the challenge if the verify token matches <code>STRAVA_VERIFY_TOKEN</code>.</p>
<table><tbody>
<tr><th>Response (success)</th><td><code>{ "hub.challenge": "&lt;echoed&gt;" }</code></td></tr>
<tr><th>Response (fail)</th><td><code>403 Forbidden</code></td></tr>
<tr><th>Note</th><td>Issue #19 — env var has insecure source-code fallback</td></tr>
</tbody></table>

<h3>2.8 <code>POST /webhook</code></h3>
<p>Strava webhook event delivery. Currently just logs the event and returns 200 OK fast (Strava expects &lt;2 s response).</p>
<table><tbody>
<tr><th>Response</th><td>Always <code>200 OK</code> with body <code>"OK"</code></td></tr>
<tr><th>Note</th><td>Issue #17 — no source verification. Once D1 actions are wired to webhook events, this becomes critical.</td></tr>
</tbody></table>

<h3>2.9 <code>GET /version</code></h3>
<table><tbody>
<tr><th>Response</th><td><code>{ service: "Cycling Coach", version: "v8.x.y", build_date: "YYYY-MM-DD", status: "ok" }</code></td></tr>
<tr><th>Use</th><td>Health check, deploy verification, version pinning in deploy scripts</td></tr>
</tbody></table>

<h3>2.10 <code>GET /roadmap</code></h3>
<p>Public read of the GitHub Issues for this repo, normalised. 5-minute edge cache.</p>
<table><tbody>
<tr><th>Response</th><td><code>{ repo, fetched_at, count, items: [{id, number, title, body, url, area, priority, type, status, target, closed_at, updated_at}, ...] }</code></td></tr>
<tr><th>Cache</th><td>5 min via Cloudflare's <code>caches.default</code>; <code>X-Cache: HIT|MISS</code> header</td></tr>
<tr><th>GitHub auth</th><td>If <code>GITHUB_TOKEN</code> is set, used for higher rate limit (5 k/h vs 60/h); otherwise anonymous</td></tr>
</tbody></table>

<h3>2.11 <code>POST /admin/document-release</code></h3>
<p>Confluence doc-sync. Admin-gated.</p>
<table><tbody>
<tr><th>Headers</th><td><code>Authorization: Bearer $ADMIN_SECRET</code> required</td></tr>
<tr><th>Response</th><td><code>{ version, date, spec_pages: [{slug, id, status}], legacy_removed: [], roadmap: {id, count, open, shipped}, releases_parent: {id}, release_entry: {id, title, status} }</code></td></tr>
<tr><th>Errors</th><td>401 (missing/wrong auth), 503 (Confluence secrets unset), 500 (unexpected)</td></tr>
</tbody></table>

<h2>3. External APIs we consume</h2>

<h3>3.1 Strava REST v3</h3>
<table><tbody>
<tr><th>Base</th><td><code>https://www.strava.com/api/v3</code></td></tr>
<tr><th>Auth</th><td>OAuth 2.0 authorization-code grant; access_token (6 h) + refresh_token (long-lived)</td></tr>
<tr><th>Endpoints we use</th><td><code>oauth/authorize</code>, <code>oauth/token</code>, <code>athlete</code>, <code>athlete/activities</code>, <code>activities/{id}</code>, <code>athlete/routes</code></td></tr>
<tr><th>Rate limits</th><td>100 req / 15 min, 1 000 / day per app (overall); per-athlete unspecified</td></tr>
<tr><th>Webhook</th><td>Push events for activity create / update / delete; verification via <code>hub.verify_token</code></td></tr>
</tbody></table>

<h3>3.2 Anthropic Claude</h3>
<table><tbody>
<tr><th>Base</th><td><code>https://api.anthropic.com/v1/messages</code></td></tr>
<tr><th>Auth</th><td>API key via <code>x-api-key</code> header; <code>anthropic-version: 2023-06-01</code></td></tr>
<tr><th>Models</th><td><code>claude-haiku-4-5-20251001</code> (per-ride feedback, weekly plan); <code>claude-sonnet-4-6</code> (auto-doc generation when enabled)</td></tr>
<tr><th>Cost (BYOK)</th><td>≈ \$0.02 per weekly plan, &lt; \$0.01 per ride verdict</td></tr>
</tbody></table>

<h3>3.3 GitHub REST v3</h3>
<table><tbody>
<tr><th>Base</th><td><code>https://api.github.com</code></td></tr>
<tr><th>Auth</th><td>PAT in CF Worker secret <code>GITHUB_TOKEN</code> (<code>public_repo</code> scope sufficient)</td></tr>
<tr><th>Endpoints we use</th><td><code>repos/{owner}/{repo}/issues</code> (read for /roadmap, write for admin bootstrap), <code>repos/{owner}/{repo}/labels</code>, <code>repos/{owner}/{repo}/milestones</code>, <code>repos/{owner}/{repo}/issues/{n}/comments</code>, <code>repos/{owner}/{repo}/commits</code>, <code>raw.githubusercontent.com/{owner}/{repo}/main/CHANGELOG.md</code></td></tr>
<tr><th>Rate limits</th><td>60/h anonymous, 5 000/h authenticated</td></tr>
</tbody></table>

<h3>3.4 Confluence Cloud REST v2</h3>
<table><tbody>
<tr><th>Base</th><td><code>https://josemreboredo.atlassian.net/wiki/api/v2</code></td></tr>
<tr><th>Auth</th><td>HTTP Basic via <code>email:api_token</code> base64; secrets stored as Worker secrets</td></tr>
<tr><th>Endpoints we use</th><td><code>spaces?keys=CC</code>, <code>pages</code> (POST), <code>pages/{id}</code> (GET / PUT / DELETE), <code>pages/{id}/children</code></td></tr>
<tr><th>Body format</th><td><code>representation: "storage"</code> (XHTML)</td></tr>
<tr><th>Notes</th><td>v2 delete is two-step: DELETE → trash, then DELETE <code>?purge=true</code> for permanent removal. Worker handles both.</td></tr>
</tbody></table>

<h2>4. Caching strategy</h2>
<table>
  <tbody>
    <tr><th>Resource</th><th>Cache layer</th><th>TTL</th></tr>
    <tr><td>Static assets (SPA bundle, fonts, icons)</td><td>Cloudflare edge + service worker (cache-first)</td><td>1 year (immutable hashed filenames)</td></tr>
    <tr><td>Index HTML</td><td>Service worker (network-first, fallback to last-cached)</td><td>n/a (network-first)</td></tr>
    <tr><td><code>/roadmap</code></td><td>Cloudflare <code>caches.default</code> + Tanstack Query on client</td><td>5 min each</td></tr>
    <tr><td>Strava API responses</td><td>Tanstack Query on client only</td><td>5 min stale-time</td></tr>
    <tr><td><code>/api/activities/{id}</code></td><td>Tanstack Query (<code>staleTime: Infinity</code>)</td><td>Forever per session (never changes after upload)</td></tr>
    <tr><td>Confluence page IDs (after first creation)</td><td>DOCS_KV</td><td>Forever (key only, not content)</td></tr>
    <tr><td>Confluence content hashes (skip-PUT-if-unchanged)</td><td>DOCS_KV</td><td>Forever</td></tr>
  </tbody>
</table>

<h2>5. Error envelope conventions</h2>
<p>JSON endpoints return <code>{ error: "&lt;message&gt;" }</code> with a non-2xx status. AI endpoints additionally return <code>{ error, invalid_key: boolean }</code> so the client can prompt for re-entry of the API key. Strava-proxy errors pass through Strava's body and status untouched.</p>

<h2>6. CORS posture</h2>
<p>All Worker responses currently set <code>Access-Control-Allow-Origin: *</code>. <strong>Issue #16</strong> tracks locking down <code>/coach</code> and <code>/coach-ride</code> to an allowlist; the other endpoints are either gated by <code>Authorization</code> (so CORS isn't the security boundary) or genuinely public reads.</p>`,
  },
  {
    slug: 'interfaces',
    title: '3. User Interfaces',
    storage: `<h1>User Interfaces</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>SPA route map, design system (PARS — Performance Dark), component inventory, breakpoints, accessibility posture. <strong>Auto-managed</strong> — content lives in <code>src/docs.js</code>.</p></ac:rich-text-body></ac:structured-macro>

<h2>1. Routes</h2>
<table>
  <tbody>
    <tr><th>Path</th><th>Page</th><th>Auth</th><th>Purpose</th></tr>
    <tr><td><code>/</code></td><td><code>Landing</code></td><td>Public</td><td>Marketing surface — hero, FOR/NOT-FOR, features, pricing, final CTA, footer</td></tr>
    <tr><td><code>/dashboard</code></td><td><code>Dashboard</code> (or <code>ConnectScreen</code> if no tokens)</td><td>Auth-gated client-side</td><td>The product — PMC, today's workout, AI Coach, routes, recents, etc.</td></tr>
    <tr><td><code>/privacy</code></td><td><code>Privacy</code></td><td>Public</td><td>Privacy / data-handling explanation</td></tr>
    <tr><td><code>/whats-next</code></td><td><code>WhatsNext</code></td><td>Public</td><td>Live mirror of the GitHub Issues roadmap</td></tr>
  </tbody>
</table>
<p>Auth-gating: <code>/dashboard</code> reads <code>cc_tokens</code> from <code>localStorage</code>. If absent (and no <code>?demo=1</code>) → renders <code>ConnectScreen</code>. If present but the API returns 401 → <code>clearTokens()</code> + ConnectScreen.</p>

<h2>2. Design system — PARS (Performance Dark)</h2>

<h3>2.1 Aesthetic direction</h3>
<p>Dark cycling-computer canvas. Molten-orange accent. Geist + Geist Mono (sibling pair drawn for instruments). Square-ish radii (max 16 px) — instrument-coded, not bubble-shaped. Earned shadows; mostly 1-px lines. Glow reserved for accent moments. Distinct from Strava's light + serif marketing identity.</p>

<h3>2.2 Tokens (single source of truth)</h3>
<p>Defined in <code>apps/web/src/design/tokens.ts</code> and mirrored to <code>tokens.css</code> as CSS custom properties. Components consume via <code>var(--*)</code>.</p>
<table>
  <tbody>
    <tr><th>Group</th><th>Tokens</th></tr>
    <tr><td>Surface</td><td><code>--c-canvas</code> #0a0a0c · <code>--c-surface</code> #16181d · <code>--c-surface-elev</code> #1f232a · <code>--c-surface-pressed</code> #252a33 · <code>--c-surface-overlay</code></td></tr>
    <tr><td>Text</td><td><code>--c-text</code> #f0f1f3 · <code>--c-text-muted</code> #7d8290 · <code>--c-text-faint</code> #454a55</td></tr>
    <tr><td>Line</td><td><code>--c-line</code> · <code>--c-line-strong</code> (1-px borders mostly)</td></tr>
    <tr><td>Accent</td><td><code>--c-accent</code> #ff4d00 (molten orange) · <code>--c-accent-deep</code> · <code>--c-accent-soft</code> · <code>--c-accent-glow</code></td></tr>
    <tr><td>Coggan + Strava 7-zone palette</td><td><code>--c-z1</code> recovery #3b8ce8 · <code>--c-z2</code> endurance #4ade80 · <code>--c-z3</code> tempo #facc15 · <code>--c-z4</code> threshold #fb923c · <code>--c-z5</code> VO₂ #ef4444 · <code>--c-z6</code> anaerobic #a855f7 · <code>--c-z7</code> neuromuscular #6b21a8</td></tr>
    <tr><td>Status</td><td><code>--c-success</code> #22c55e · <code>--c-warn</code> #f59e0b · <code>--c-danger</code> #ef4444 (each with <code>-soft</code> background variant)</td></tr>
    <tr><td>Strava brand</td><td><code>--c-strava</code> #fc4c02 — used <em>only</em> for Strava-specific UI</td></tr>
    <tr><td>Spacing</td><td>4-px base scale — <code>--s-1</code> 4 px → <code>--s-32</code> 128 px (mobile-first)</td></tr>
    <tr><td>Radius</td><td><code>--r-xs</code> 2 → <code>--r-xl</code> 16 (square-ish)</td></tr>
    <tr><td>Shadows</td><td><code>--sh-sm</code> · <code>--sh-md</code> · <code>--sh-lg</code> · <code>--sh-glow</code> (accent moments) · <code>--sh-inner</code></td></tr>
    <tr><td>Motion durations</td><td><code>--d-instant</code> 50 ms · <code>--d-fast</code> 150 ms · <code>--d-base</code> 220 ms · <code>--d-slow</code> 420 ms · <code>--d-lazy</code> 720 ms · <code>--d-ring</code> 1200 ms (synced PMC ring fills)</td></tr>
    <tr><td>Easings</td><td><code>--e-out</code>, <code>--e-in-out</code>, <code>--e-back</code> (overshoot for ring fills), <code>--e-sharp</code></td></tr>
    <tr><td>Hit targets</td><td><code>--hit-min</code> 44 px (a11y) · <code>--hit-comfy</code> 48 · <code>--hit-big</code> 56</td></tr>
    <tr><td>Z-index scale</td><td><code>--z-base</code> 0 → <code>--z-toast</code> 700 (no magic numbers in components)</td></tr>
  </tbody>
</table>
<p><strong>Reduced motion:</strong> <code>@media (prefers-reduced-motion: reduce)</code> zeros every motion duration in <code>tokens.css</code> — single guard, never per-component.</p>

<h3>2.3 Type scale</h3>
<p>Two families: <strong>Geist</strong> (UI) + <strong>Geist Mono</strong> (numerals — every metric reads like a head-unit). Inter is gone. Mono drives all numerical data: km, BPM, watts, TSS, NP, W/kg, time-of-day. Type scale spans <code>t-mono-xs</code> (11 px) → <code>t-mono-5xl</code> (120 px) and same for <code>t-sans-*</code>.</p>

<h2>3. Component inventory</h2>

<h3>3.1 Atomic</h3>
<ul>
  <li><code>Button</code> — primary / secondary / ghost / strava variants; <code>withArrow</code> prop animates an arrow on hover</li>
  <li><code>Pill</code> — small chip with optional dot (<code>tone</code>: neutral / accent / success / warn / danger)</li>
  <li><code>Eyebrow</code> — mono uppercase tracked label, optional rule prefix</li>
  <li><code>BikeMark</code> — linework cyclist glyph, currentColor</li>
  <li><code>ZonePill</code> — Coggan/Strava zone chip with glow dot (Z1–Z7)</li>
  <li><code>Container</code> — single source of horizontal rhythm (4 widths)</li>
  <li><code>Card</code> — surface primitive with optional 3-px accent rule on the left</li>
  <li><code>GrainOverlay</code> — film-noise SVG fractal for hero atmosphere</li>
</ul>

<h3>3.2 Chrome</h3>
<ul>
  <li><code>TopBar</code> — sticky brand bar (marketing or app variant)</li>
  <li><code>BottomNav</code> — mobile-only authed tab bar (Today · Train · Rides · You)</li>
  <li><code>UserMenu</code> — avatar-pill popover: Sync now · Edit profile · Revoke at Strava ↗ · Disconnect Strava</li>
</ul>

<h3>3.3 Data display</h3>
<ul>
  <li><code>StatTile</code> — number + unit + eyebrow, sized sm/md/lg, zone-tinted</li>
  <li><code>PmcStrip</code> — CTL · ATL · TSB at-a-glance with 7-day deltas</li>
  <li><code>ProgressRing</code> — Motion-animated SVG ring (overshoot easing)</li>
  <li><code>WorkoutCard</code> — today's session with proportional zone stripe + meta + start CTA</li>
  <li><code>VolumeChart</code> — distance + elevation bars, weekly/monthly toggle, last 12 buckets</li>
  <li><code>StreakHeatmap</code> — 12 weeks × 7 days, today pulses, 5 intensity buckets</li>
  <li><code>WinsTimeline</code> — last-90-days PR feed with star prefix</li>
</ul>

<h3>3.4 Feature panels</h3>
<ul>
  <li><code>AiCoachCard</code> — 3-state: BYOK setup → sessions/week picker + Generate → full plan render</li>
  <li><code>RideFeedback</code> — inline coach-verdict panel under each ride</li>
  <li><code>RideDetail</code> — lazy-loaded expansion (Strava description, photo, polyline SVG, stats grid, splits, segments, "Open on Strava ↗")</li>
  <li><code>RoutesPicker</code> — surface + start-address filter; ranked saved routes (mock today, real from <code>/api/athlete/routes</code> per issue #8)</li>
  <li><code>GoalEventCard</code> — display + inline editor (name, type, date, distance, elevation, location, A/B/C priority)</li>
  <li><code>OnboardingModal</code> — first-run capture of FTP / weight / HR max with live W/kg readout + classification</li>
</ul>

<h3>3.5 Pages</h3>
<ul>
  <li><code>Landing</code>, <code>Dashboard</code>, <code>Privacy</code>, <code>WhatsNext</code></li>
  <li><code>ConnectScreen</code> — auth-gate fallback shown when <code>/dashboard</code> has no tokens</li>
  <li><code>LoadingScreen</code> — first-fetch spinner + status copy</li>
</ul>

<h2>4. Responsive breakpoints</h2>
<p>Mobile-first; design baseline 375 px.</p>
<ul>
  <li><code>--breakpoint-sm</code> 375 px (iPhone Mini portrait — design baseline)</li>
  <li><code>--breakpoint-md</code> 414 px (iPhone Pro Max portrait)</li>
  <li><code>--breakpoint-lg</code> 768 px (iPad portrait / large phone landscape)</li>
  <li><code>--breakpoint-xl</code> 1024 px (iPad landscape) — BottomNav hides at this point</li>
  <li><code>--breakpoint-xxl</code> 1280 px (desktop minimum)</li>
  <li><code>--breakpoint-xxxl</code> 1536 px (wide desktop)</li>
</ul>

<h2>5. Motion language</h2>
<ul>
  <li>Page-load: 200 ms fade + 8 px translate-up, staggered (<code>fade-up-1</code>, <code>fade-up-2</code>, etc.)</li>
  <li>PMC ring fills: <code>--d-ring</code> 1200 ms with <code>--e-back</code> overshoot</li>
  <li>Number count-ups synced with ring fills</li>
  <li>Bottom nav: <code>active</code> swap is instant; tap state has subtle scale transform</li>
  <li>UserMenu popover: <code>--d-fast</code> 150 ms with scale-from-top-right</li>
  <li>Reduced-motion guard zeros every duration via media-query in <code>tokens.css</code></li>
</ul>

<h2>6. Accessibility posture</h2>
<table>
  <tbody>
    <tr><th>Concern</th><th>State</th></tr>
    <tr><td>Hit targets ≥ 44 × 44 px</td><td>Enforced via <code>--hit-min</code> token; verified on all interactive controls</td></tr>
    <tr><td>Reduced motion</td><td>Honored via <code>@media (prefers-reduced-motion)</code> in <code>tokens.css</code></td></tr>
    <tr><td>Keyboard navigation</td><td>Tab order works; focus-visible styles via the design-system. Not full audit yet.</td></tr>
    <tr><td>Color contrast</td><td>Dark canvas + bright text → high contrast. Mono numerals on cards: not yet measured against WCAG AA. Audit pending.</td></tr>
    <tr><td>Screen-reader landmarks</td><td><code>&lt;main&gt;</code>, <code>&lt;nav aria-label&gt;</code>, semantic headings used. Not full audit.</td></tr>
    <tr><td>Skip-to-content link</td><td>Not present yet</td></tr>
    <tr><td>Lighthouse mobile</td><td>Issue #12 tracks getting all routes ≥ 90</td></tr>
  </tbody>
</table>

<h2>7. PWA shell</h2>
<p>Manifest (<code>apps/web/public/manifest.webmanifest</code>) declares standalone display, theme-color <code>#08090b</code>, three home-screen shortcuts (Today, Train, Rides). Service worker (<code>apps/web/public/sw.js</code>): cache-first for static assets, network-first for navigation, never-cache for <code>/api/*</code> + auth + admin paths. Offline navigation falls back to the cached SPA shell. iOS home-screen install supported.</p>`,
  },
  {
    slug: 'functional-spec',
    title: '4. Functional Specification',
    storage: `<h1>Functional Specification</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>What the app does, for whom, and why — feature catalog with user stories grounded in the target persona. <strong>Auto-managed</strong> — content lives in <code>src/docs.js</code>.</p></ac:rich-text-body></ac:structured-macro>

<h2>1. Persona — Marco</h2>
<table><tbody>
<tr><th>Field</th><th>Value</th></tr>
<tr><th>Name</th><td>Marco — "the performance-driven amateur"</td></tr>
<tr><th>Age / location</th><td>38 / Zürich</td></tr>
<tr><th>Profession</th><td>Senior consultant. Disposable income, design-literate.</td></tr>
<tr><th>Training</th><td>8–12 h/week. Power meter, smart trainer, HR strap.</td></tr>
<tr><th>Goals</th><td>Gran Fondos in spring/summer (e.g. Etape du Tour). Alpine routes. Occasional local races.</td></tr>
<tr><th>Data fluency</th><td>Tracks FTP, TSS, CTL/ATL, w/kg, training zones. Reads numbers like prose.</td></tr>
<tr><th>Current stack</th><td>Strava (daily), TrainingPeaks (plans), Zwift (indoor), Komoot (routes), Garmin Connect.</td></tr>
<tr><th>Wears</th><td>Rapha, Castelli, Pas Normal Studios. Notices typography. Notices bad UI immediately.</td></tr>
<tr><th>Pains</th><td>Apps that look like spreadsheets. "Fitness" apps designed for casual users. Dashboards that bury the one metric he actually wants.</td></tr>
<tr><th>Wants</th><td>At-a-glance training status. "What do I do today?" answered instantly. Visible progression toward his goal event. A tool that respects his commitment level.</td></tr>
<tr><th>Emotional driver</th><td><strong>Identity.</strong> He <em>is</em> a cyclist. The app should feel like gear, not like SaaS.</td></tr>
</tbody></table>

<h2>2. Feature catalog</h2>

<h3>2.1 Onboarding (FTP / weight / HR max)</h3>
<table><tbody>
<tr><th>Trigger</th><td>First-run on <code>/dashboard</code> after auth, when <code>cc_athleteProfile</code> is absent and the user hasn't dismissed onboarding.</td></tr>
<tr><th>Behavior</th><td>Modal overlay (full-screen on mobile). Three numeric inputs: FTP (W), weight (kg), HR max (bpm). Live W/kg readout + classification ("cat-3 / committed amateur" etc.) as the user types. Validation: FTP 50–600, weight 30–200, HR 100–230.</td></tr>
<tr><th>Data</th><td>Persists to <code>cc_athleteProfile</code> in localStorage. Will sync to D1 <code>users.ftp_w / weight_kg / hr_max</code> once issue #11 ships.</td></tr>
<tr><th>Side effects</th><td>FTP unlocks real TSS / NP / zone classification across the dashboard. PMC strip switches from duration-proxy to real PMC math. W/kg quick-stat tile populates.</td></tr>
<tr><th>Reopen</th><td>Avatar pill → User menu → "Edit profile" — re-renders the modal with current values pre-filled.</td></tr>
<tr><th>Skip path</th><td>"I'll set this later" stores <code>cc_onboardingDismissed=true</code>; modal stays closed until reopened from User menu.</td></tr>
</tbody></table>

<h3>2.2 Dashboard hero (greeting · PMC strip · quick stats)</h3>
<table><tbody>
<tr><th>Trigger</th><td>Dashboard route renders after auth + first activities fetch.</td></tr>
<tr><th>Behavior</th><td>Italic greeting ("Morning, Marco.") + form interpretation ("Form is productive. TSB at -3 — ready for a hard session today."). PMC strip with CTL · ATL · TSB and 7-day deltas. Quick-stat row: Week TSS, Week hours, FTP, W/kg.</td></tr>
<tr><th>Data</th><td>PMC computed client-side from real activities + FTP via <code>computePmcDelta()</code>. Quick stats derived from the last 7 days of activities.</td></tr>
<tr><th>Note</th><td>If FTP is unset, TSS is a duration-based proxy and the page shows a "TSS proxy until FTP is set" hint.</td></tr>
</tbody></table>

<h3>2.3 Goal event card</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered on Dashboard hero fold (right side / below on mobile).</td></tr>
<tr><th>Behavior</th><td>Display mode: event name, type (Gran Fondo / Race / TT / Crit / Volume / Tour), date countdown, distance, elevation, A/B/C priority. Edit mode: inline form with all fields + Save / Clear.</td></tr>
<tr><th>Data</th><td><code>cc_goalEvent</code> in localStorage. Will move to D1 <code>goals</code> table (event_* extensions are in schema v2).</td></tr>
</tbody></table>

<h3>2.4 Yearly km goal ring</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered on Dashboard hero fold.</td></tr>
<tr><th>Behavior</th><td>SVG ring fills to current YTD km / target. Center shows YTD km in mono. Below: percent of target + projected year-end at current pace.</td></tr>
<tr><th>Status</th><td>Currently <strong>not editable</strong> — target is a hardcoded 8 000 km. Issue #4 tracks making it user-set with optional AI-suggested default.</td></tr>
</tbody></table>

<h3>2.5 Today's workout</h3>
<table><tbody>
<tr><th>Trigger</th><td>Dashboard renders the today section right after the hero.</td></tr>
<tr><th>Behavior</th><td>If an AI plan exists, picks today's day-of-week from <code>weeklyPlan</code> and shows the workout text. If no plan, shows a sample <code>WorkoutCard</code> with a "generate plan to see your real workout" hint.</td></tr>
<tr><th>Side effects</th><td>"Start workout" button currently shows a placeholder alert (Wahoo / Zwift pairing — future).</td></tr>
</tbody></table>

<h3>2.6 AI Coach (weekly plan)</h3>
<table><tbody>
<tr><th>Trigger</th><td>User taps "Generate weekly plan" in the AI Coach card.</td></tr>
<tr><th>Behavior</th><td>Three states: (1) no API key → setup form with link to <code>console.anthropic.com</code>; (2) key + no report → sessions-per-week picker (1–7) + Generate button; (3) report exists → render Strengths / Areas to improve / 7-day plan with today's row pulsing / motivation closing.</td></tr>
<tr><th>Data</th><td>Stats + last 10 rides + sessions/week posted to <code>/coach</code>. Result cached in <code>cc_aiReport</code>. Sessions-per-week picker also drives a hint copy ("Balanced — tempo, easy, and long. Recommended starting point.").</td></tr>
<tr><th>BYOK</th><td>User pastes their own Anthropic API key. Stored in <code>cc_anthropicKey</code>. ≈ \$0.02 per generated plan. Skip-AI works fine — every other feature still functions.</td></tr>
</tbody></table>

<h3>2.7 Per-ride AI verdict</h3>
<table><tbody>
<tr><th>Trigger</th><td>"Get coach verdict" button on any ride row in Recents.</td></tr>
<tr><th>Behavior</th><td>POSTs to <code>/coach-ride</code> with the ride payload + athlete context + user's API key. Inline panel renders verdict (italic accent), feedback (paragraph), next-time suggestion (warn-bordered sub-box).</td></tr>
<tr><th>Data</th><td>Cached in <code>cc_rideFeedback[id]</code> — re-opening the same ride is instant.</td></tr>
</tbody></table>

<h3>2.8 Streak heatmap</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered in the momentum section.</td></tr>
<tr><th>Behavior</th><td>12 weeks × 7 days grid. Each cell is one day; intensity scales 0–4 with ride count. Today's cell pulses in accent. Header shows current streak / best streak / total days ridden.</td></tr>
<tr><th>Data</th><td>Built client-side via <code>buildStreak()</code> from activity dates.</td></tr>
</tbody></table>

<h3>2.9 Wins timeline</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered in the momentum section, side-by-side with streak heatmap on desktop.</td></tr>
<tr><th>Behavior</th><td>Last 90 days of rides where <code>pr_count &gt; 0</code>, sorted newest-first, capped at 6. Each row: ★ + ride name + zone pill + km / duration / relative date + PR-count badge.</td></tr>
</tbody></table>

<h3>2.10 Volume chart</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered after momentum.</td></tr>
<tr><th>Behavior</th><td>Distance (orange) + elevation (green) bars per bucket. Toggle: weekly / monthly. Last 12 buckets. Header shows total km + total m for visible window.</td></tr>
<tr><th>Issue</th><td>#5 — currently only shows km value under each bar; users want both km AND m surfaced numerically.</td></tr>
</tbody></table>

<h3>2.11 Routes picker</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered after AI Coach. Surface + start-address picker at top.</td></tr>
<tr><th>Behavior</th><td>Surface filter (Tarmac / Gravel / Any → currently mismatched with Strava's Any/Paved/Dirt — issue #6). Start-address text input. List of saved routes ranked against today's plan.</td></tr>
<tr><th>Scoring</th><td>0–100 from four signals: distance fit (40), zone overlap (30), surface fit (20), starred bonus (10). Today's target derived from AI plan via <code>deriveTarget()</code>.</td></tr>
<tr><th>Status</th><td>Today uses <code>MOCK_ROUTES</code> — not the user's actual saved routes. Issues #6 + #8 track replacing with <code>/api/athlete/routes</code> + AI-generated route briefs.</td></tr>
</tbody></table>

<h3>2.12 Recents — list + ride detail</h3>
<table><tbody>
<tr><th>Trigger</th><td>Always rendered last on dashboard. Tapping a ride name expands inline detail.</td></tr>
<tr><th>Behavior</th><td>Last 8 rides with zone pill + relative date + PR-count + Indoor pill (when virtual). Tap → row expands, lazy-fetches <code>/api/activities/{id}</code>, renders description + photo + decoded route polyline (SVG) + full stats grid + best efforts + segment efforts + km splits + "Open on Strava ↗".</td></tr>
<tr><th>Caching</th><td>Tanstack Query <code>staleTime: Infinity</code> — ride detail never changes after upload.</td></tr>
<tr><th>Per-ride coach</th><td>"Get coach verdict" button below stats — see 2.7.</td></tr>
</tbody></table>

<h3>2.13 Connect / Disconnect</h3>
<table><tbody>
<tr><th>Connect</th><td>Landing CTA + ConnectScreen (rendered when no tokens). <code>connectUrl()</code> appends <code>?origin=window.location.origin</code> so dev redirects loopback correctly.</td></tr>
<tr><th>Disconnect</th><td>Avatar pill → User menu → "Disconnect Strava". Calls <code>clearTokens()</code> + <code>queryClient.clear()</code> + redirects to <code>/</code>. Local-only — does not revoke the OAuth grant on Strava.</td></tr>
<tr><th>Revoke</th><td>User menu → "Revoke at Strava ↗" — opens <code>strava.com/settings/apps</code> in a new tab so the user can fully drop the OAuth grant.</td></tr>
</tbody></table>

<h3>2.14 What's next page (roadmap)</h3>
<table><tbody>
<tr><th>Trigger</th><td>Footer link on Landing → <code>/whats-next</code>.</td></tr>
<tr><th>Behavior</th><td>Live mirror of GitHub Issues. Three sections — In progress / Open / Shipped — with priority + status pills, area tag, target version. Cards link out to the GitHub issue. Live-vs-fallback pill, last-updated stamp, manual Refresh button.</td></tr>
<tr><th>Data</th><td><code>useRoadmap()</code> hook → <code>/roadmap</code> Worker endpoint → GitHub Issues API. 5-min edge cache + 5-min Tanstack stale-time.</td></tr>
</tbody></table>

<h2>3. User stories (Marco's voice)</h2>
<ol>
  <li>"As Marco, I want to see CTL / ATL / TSB at a glance so I know if I'm fresh or fried — without three taps."</li>
  <li>"As Marco, I want today's workout to match my form, not a generic plan that ignores yesterday."</li>
  <li>"As Marco, I want to tap a recent ride and see splits + segments without leaving the app."</li>
  <li>"As Marco, I want my goal event visible at the top so the days-out countdown is unavoidable."</li>
  <li>"As Marco, I want my routes picker to know that today is a 1 h 15 sweet-spot session — not list every saved route."</li>
  <li>"As Marco, I want a coach verdict on a ride that uses real numbers, not generic encouragement."</li>
  <li>"As Marco, I want my AI key in my own pocket — no shared bills, no surprise SaaS subscription."</li>
  <li>"As Marco, I want offline access to the dashboard so my morning espresso ritual works without coverage."</li>
  <li>"As Marco, I want the app to feel like gear, not like a SaaS dashboard."</li>
</ol>

<h2>4. Pricing model</h2>
<p>Free, forever. Bring your own Anthropic key. Per-user costs:</p>
<ul>
  <li>App: \$0 (no subscription)</li>
  <li>Strava data: \$0 (their API)</li>
  <li>AI coaching: ≈ \$0.02 per generated weekly plan; &lt; \$0.01 per ride verdict</li>
  <li>Estimated total: &lt; \$0.50 / month for most riders</li>
</ul>
<p>Skip AI entirely → \$0. Every other feature works without it.</p>

<h2>5. Out of scope (explicit non-goals)</h2>
<ul>
  <li><strong>Casual fitness audience.</strong> "How many calories did I burn?" is not the question this app answers.</li>
  <li><strong>Social / kudos / leaderboards.</strong> That's Strava's job. We surface your data without ranking it against others.</li>
  <li><strong>Gamification, badges, streaks-as-rewards.</strong> The streak heatmap is data, not dopamine.</li>
  <li><strong>Multi-bike fleet management, gear tracking.</strong> Not yet — the data model supports it but no UI surfaces it.</li>
  <li><strong>Indoor-only workout libraries.</strong> Zwift / TrainerRoad own that space.</li>
  <li><strong>Coach-to-athlete messaging.</strong> Not in scope — single-athlete tool.</li>
</ul>`,
  },
  {
    slug: 'technical-spec',
    title: '5. Technical Specification',
    storage: `<h1>Technical Specification</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Repo layout, stack details, schema, build pipeline, state management, performance budget. <strong>Auto-managed</strong> — content lives in <code>src/docs.js</code>.</p></ac:rich-text-body></ac:structured-macro>

<h2>1. Repo structure</h2>
<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">text</ac:parameter><ac:plain-text-body><![CDATA[
cycling-coach/
├── src/
│   ├── worker.js                  # Cloudflare Worker — routes, OAuth, proxies, doc-sync
│   └── docs.js                    # Canonical Confluence spec content (this file's source)
├── apps/web/                      # React SPA
│   ├── index.html                 # PWA meta + Geist preconnect
│   ├── package.json
│   ├── vite.config.ts             # Build config + dev proxy → :8787
│   ├── tsconfig.json              # TypeScript strict
│   ├── biome.json                 # Lint + format
│   ├── public/
│   │   ├── manifest.webmanifest   # PWA manifest
│   │   ├── icon.svg + icon-maskable.svg
│   │   └── sw.js                  # Service worker
│   └── src/
│       ├── main.tsx               # React root + RouterProvider + QueryClient + SW register
│       ├── design/
│       │   ├── tokens.ts          # Design tokens (TS source of truth)
│       │   ├── tokens.css         # CSS variables on :root
│       │   └── reset.css
│       ├── components/            # 18+ components (atomic + composed)
│       ├── hooks/                 # useApiKey, useAthleteProfile, useGoalEvent,
│       │                          # useTrainingPrefs, useAiReport, useRideFeedback,
│       │                          # useRoadmap, useStravaData, useActivityDetail
│       ├── lib/
│       │   ├── api.ts             # Strava client (proxied via Worker)
│       │   ├── auth.ts            # token storage + refresh
│       │   ├── coachApi.ts        # /coach + /coach-ride client
│       │   ├── coachUtils.ts      # stats / recent computation for AI
│       │   ├── connectUrl.ts      # OAuth deep-link builder
│       │   ├── format.ts          # km, time, date helpers
│       │   ├── mockMarco.ts       # Demo data (Marco persona, 90 d of rides)
│       │   ├── mockRoutes.ts
│       │   ├── pmc.ts             # CTL/ATL/TSB exponential moving avg + delta
│       │   ├── polyline.ts        # Google polyline decoder
│       │   ├── roadmap.ts         # Static seed (fallback for /whats-next)
│       │   ├── storage.ts         # Typed localStorage wrapper (cc_* prefix)
│       │   ├── stravaConvert.ts   # Strava → MockActivity mapper
│       │   ├── streak.ts          # Streak + heatmap math
│       │   ├── volume.ts          # Weekly/monthly bucketing
│       │   ├── wins.ts            # PR extraction
│       │   └── zones.ts           # Coggan + Strava 7-zone power model
│       ├── pages/                 # Landing, Dashboard, Privacy, WhatsNext,
│       │                          # ConnectScreen, LoadingScreen
│       └── routes/                # Tanstack Router file-based routes
├── migrations/                    # D1 schema migrations
│   └── 0001_pmc_and_events.sql    # v2 schema (FTP, TSS columns, daily_load, events)
├── scripts/
│   ├── bootstrap-issues.sh        # Initial GitHub labels + milestones + backlog
│   └── file-v8.4.0-issues.sh
├── schema.sql                     # D1 v1 schema
├── wrangler.jsonc                 # CF Worker config + assets + bindings
├── package.json                   # Root scripts: dev, build:web, deploy, docs:sync
├── CHANGELOG.md
├── CONTRIBUTING.md                # Workflow + Confluence integration setup
├── README.md
├── .deploy.env                    # GITIGNORED — local mirror of ADMIN_SECRET
└── .dev.vars                      # GITIGNORED — Strava client id/secret for dev
]]></ac:plain-text-body></ac:structured-macro>

<h2>2. Stack</h2>
<table>
  <tbody>
    <tr><th>Layer</th><th>Tech</th><th>Version</th></tr>
    <tr><td>Frontend framework</td><td>React</td><td>19</td></tr>
    <tr><td>Build tool</td><td>Vite</td><td>6.x</td></tr>
    <tr><td>Language</td><td>TypeScript (strict)</td><td>5.7</td></tr>
    <tr><td>Routing</td><td>Tanstack Router</td><td>1.95 (file-based)</td></tr>
    <tr><td>Data fetching</td><td>Tanstack Query</td><td>5.62</td></tr>
    <tr><td>Animation</td><td>Motion (Framer Motion fork)</td><td>11.15</td></tr>
    <tr><td>Styling</td><td>CSS Modules + design tokens (no Tailwind)</td><td>n/a</td></tr>
    <tr><td>Lint / format</td><td>Biome</td><td>1.9</td></tr>
    <tr><td>Worker runtime</td><td>Cloudflare Workers</td><td>via wrangler 4.85</td></tr>
    <tr><td>Database</td><td>Cloudflare D1 (SQLite)</td><td>edge</td></tr>
    <tr><td>Edge cache</td><td>Cloudflare <code>caches.default</code> + KV (DOCS_KV)</td><td>n/a</td></tr>
    <tr><td>AI</td><td>Anthropic Claude Sonnet/Haiku 4.x</td><td>via REST</td></tr>
    <tr><td>Fonts</td><td>Geist + Geist Mono</td><td>via Google Fonts</td></tr>
  </tbody>
</table>

<h2>3. Build pipeline</h2>
<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">bash</ac:parameter><ac:plain-text-body><![CDATA[
# Local dev (two processes via concurrently)
npm run dev:all
# → wrangler dev on :8787 (Worker + D1 local + .dev.vars)
# → vite dev on :5173 (proxies /api, /authorize, /callback, etc. → :8787)

# Production deploy (full chain)
source .deploy.env
npm run deploy
# → npm run build:web    (Vite produces apps/web/dist)
# → wrangler deploy      (Worker + assets uploaded)
# → npm run docs:sync    (POST /admin/document-release)
]]></ac:plain-text-body></ac:structured-macro>
<p>Cloudflare Workers Builds CI runs the same chain on push to <code>main</code> (issue #9 — set CI build command to <code>npm run build:web</code>).</p>

<h2>4. D1 data model</h2>
<table>
  <tbody>
    <tr><th>Table</th><th>Key columns</th><th>Used by</th></tr>
    <tr><td><code>users</code></td><td><code>athlete_id</code> PK · <code>firstname / lastname / profile_url / raw_athlete_json</code> · <em>v2 columns:</em> <code>ftp_w / weight_kg / hr_max / ftp_set_at</code></td><td>Persisted on OAuth callback; FTP read for TSS math (issue #8)</td></tr>
    <tr><td><code>user_connections</code></td><td><code>id, athlete_id, source='strava', credentials_json, last_sync_at</code></td><td>OAuth tokens (Strangler-Fig — localStorage is still source of truth client-side)</td></tr>
    <tr><td><code>activities</code></td><td><code>id, athlete_id, sport_type, start_date_local, distance, moving_time, total_elevation_gain, average_speed, average_heartrate, pr_count, strava_id UNIQUE, primary_source, *_raw_json, synced_at</code> · <em>v2 columns:</em> <code>duration_s, average_watts, np_w, if_pct, tss, primary_zone</code></td><td>Persisted on every <code>/api/athlete/activities</code> proxy</td></tr>
    <tr><td><code>daily_load</code> <em>(v2)</em></td><td><code>(athlete_id, date)</code> PK · <code>tss_sum, ctl, atl, tsb, computed_at</code></td><td>PMC rollup — populated by backfill (issue #8) + nightly recompute (TBD)</td></tr>
    <tr><td><code>goals</code></td><td><code>id, athlete_id, goal_type, target_value, target_unit, target_date, title</code> · <em>v2 columns:</em> <code>event_name, event_type, event_distance_km, event_elevation_m, event_location, event_priority</code></td><td>Yearly km goal + event-day countdown (issue #4)</td></tr>
    <tr><td><code>training_prefs</code></td><td><code>athlete_id</code> PK · <code>sessions_per_week, surface_pref, start_address, updated_at</code></td><td>AI Coach prompts + Routes picker (issue #11 — D1 sync)</td></tr>
    <tr><td><code>ai_reports</code></td><td><code>id, athlete_id, generated_at, sessions_per_week, surface_pref, report_json, prompt_version, model_used</code></td><td>Cached AI weekly plans (server-side, complement to localStorage)</td></tr>
    <tr><td><code>ride_feedback</code></td><td><code>activity_id</code> PK · <code>athlete_id, feedback_json, generated_at, prompt_version, model_used</code></td><td>Per-ride AI verdicts (server-side cache)</td></tr>
    <tr><td><code>clubs / club_members / club_goals</code></td><td>Phase 2 — schema present, no UI yet</td><td>Future: collective goals</td></tr>
  </tbody>
</table>
<p>Schema v1: <code>schema.sql</code>. Schema v2 migration: <code>migrations/0001_pmc_and_events.sql</code> (applied to local + remote D1 in issue #7).</p>

<h2>5. Client-side state</h2>

<h3>5.1 localStorage keys (all <code>cc_*</code> prefix)</h3>
<table>
  <tbody>
    <tr><th>Key</th><th>Shape</th><th>Used by</th></tr>
    <tr><td><code>cc_tokens</code></td><td><code>{access_token, refresh_token, expires_at}</code></td><td><code>auth.ts</code> — Strava OAuth tokens</td></tr>
    <tr><td><code>cc_anthropicKey</code></td><td><code>string</code> (sk-ant-…)</td><td><code>useApiKey()</code> — BYOK</td></tr>
    <tr><td><code>cc_athleteProfile</code></td><td><code>{ftp, weight, hrMax, set_at}</code></td><td><code>useAthleteProfile()</code> — onboarding output</td></tr>
    <tr><td><code>cc_onboardingDismissed</code></td><td><code>boolean</code></td><td>Suppresses onboarding modal post-skip</td></tr>
    <tr><td><code>cc_aiReport</code></td><td><code>AiReport</code></td><td><code>useAiReport()</code> — last weekly plan</td></tr>
    <tr><td><code>cc_rideFeedback</code></td><td><code>{ [rideId]: RideFeedback }</code></td><td><code>useRideFeedback()</code> — per-ride verdicts</td></tr>
    <tr><td><code>cc_trainingPrefs</code></td><td><code>{sessions_per_week, surface_pref, start_address}</code></td><td><code>useTrainingPrefs()</code></td></tr>
    <tr><td><code>cc_goalEvent</code></td><td><code>GoalEvent</code></td><td><code>useGoalEvent()</code> — Etape du Tour etc.</td></tr>
  </tbody>
</table>

<h3>5.2 Tanstack Query keys</h3>
<ul>
  <li><code>['athlete']</code> — <code>useAthlete()</code>, 5-min stale-time</li>
  <li><code>['activities']</code> — <code>useActivities()</code>, 5-min stale-time, 200 per page</li>
  <li><code>['activity', id]</code> — <code>useActivityDetail()</code>, <code>staleTime: Infinity</code> (ride data immutable post-upload)</li>
  <li><code>['roadmap']</code> — <code>useRoadmap()</code>, 5-min stale-time, fallback to static seed</li>
</ul>

<h2>6. TypeScript posture</h2>
<p><code>tsconfig.json</code> — strict on. <code>noUnusedLocals</code>, <code>noUnusedParameters</code>, <code>noFallthroughCasesInSwitch</code>, <code>noUncheckedIndexedAccess</code> all enabled. <code>verbatimModuleSyntax</code> for cleaner imports. Path alias <code>~/*</code> → <code>src/*</code>.</p>
<p>Worker (<code>src/worker.js</code>) is plain JS — no TS. Bundle config in <code>wrangler.jsonc</code>.</p>

<h2>7. Bundle composition</h2>
<table>
  <tbody>
    <tr><th>Chunk</th><th>Size (gzip)</th><th>Loaded on</th></tr>
    <tr><td><code>index.js</code> (main)</td><td>~58 KB</td><td>Every route</td></tr>
    <tr><td><code>router.js</code></td><td>~32 KB</td><td>Every route</td></tr>
    <tr><td><code>connectUrl.js</code> (Motion vendored here)</td><td>~21 KB</td><td>Most pages</td></tr>
    <tr><td><code>motion.js</code></td><td>~19 KB</td><td>Pages that import Motion</td></tr>
    <tr><td><code>dashboard.js</code></td><td>~26 KB</td><td>/dashboard only</td></tr>
    <tr><td><code>query.js</code></td><td>~10 KB</td><td>Every authed route</td></tr>
    <tr><td><code>privacy.js</code> · <code>whats-next.js</code></td><td>~2–4 KB each</td><td>Per-route</td></tr>
  </tbody>
</table>
<p>Total first-paint: ~150 KB gzipped. Lighthouse mobile audit pending — issue #12 tracks getting all routes to ≥ 90.</p>

<h2>8. Performance considerations</h2>
<ul>
  <li><strong>Code-split per route</strong> via Vite's rollup config (<code>manualChunks</code>) — react-vendor / router / query / motion split out.</li>
  <li><strong>Service worker</strong> caches static assets (1-year immutable) and the SPA shell (network-first + offline fallback).</li>
  <li><strong>Geist + Geist Mono</strong> loaded via Google Fonts with <code>display=swap</code> + preconnect.</li>
  <li><strong>Strava activity detail</strong> Tanstack-Query-cached forever (<code>staleTime: Infinity</code>) — re-opening the same ride is instant.</li>
  <li><strong>PMC + streak + wins + volume</strong> all derived client-side from the same activity list — no extra round-trips.</li>
  <li><strong>Roadmap</strong> double-cached (5-min edge + 5-min Tanstack).</li>
</ul>

<h2>9. Testing</h2>
<p>Currently no automated tests. Smoke tests are manual via <code>npm run dev:all</code> + cURL probes. <strong>Planned</strong> (no issue filed yet): Vitest for <code>lib/*</code> pure functions (PMC math, zone classification, polyline decoding, mock-data shaping); Playwright for the auth + onboarding + AI flows.</p>

<h2>10. Local dev quick reference</h2>
<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">bash</ac:parameter><ac:plain-text-body><![CDATA[
# Clone + install
git clone git@github.com:jose-reboredo/cycling-coach.git
cd cycling-coach
npm install
cd apps/web && npm install && cd -

# Configure secrets locally
cp .dev.vars.example .dev.vars
# Edit .dev.vars: paste your Strava STRAVA_CLIENT_ID + STRAVA_CLIENT_SECRET

# Run both servers
npm run dev:all
# → http://localhost:5173 (SPA, Vite)
# → http://localhost:8787 (Worker, wrangler)

# Apply schema migration to local D1
npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql

# Deploy to prod
source .deploy.env
npm run deploy
]]></ac:plain-text-body></ac:structured-macro>`,
  },
  {
    slug: 'security',
    title: '6. Security',
    storage: `<h1>Security</h1>
<ac:structured-macro ac:name="info"><ac:rich-text-body><p>Threat model, secrets inventory, auth flow, current defences, open hardening backlog. <strong>Auto-managed</strong> — content lives in <code>src/docs.js</code>.</p></ac:rich-text-body></ac:structured-macro>

<h2>1. Threat model</h2>
<table>
  <tbody>
    <tr><th>Asset</th><th>Sensitivity</th><th>Where it lives</th><th>Attacker goal</th></tr>
    <tr><td><strong>Strava OAuth tokens</strong></td><td>High — full read of activity history</td><td>Browser localStorage (<code>cc_tokens</code>) + D1 <code>user_connections</code></td><td>Steal to read victim's rides</td></tr>
    <tr><td><strong>Anthropic API key (BYOK)</strong></td><td>Medium — costs the victim money</td><td>Browser localStorage (<code>cc_anthropicKey</code>)</td><td>Spam Claude on victim's account, drain credits</td></tr>
    <tr><td><strong>Athlete profile</strong> (FTP, weight, HR)</td><td>Low — personal but not financial</td><td>localStorage (<code>cc_athleteProfile</code>) + D1 <code>users</code></td><td>Curiosity / social engineering only</td></tr>
    <tr><td><strong>Strava CLIENT_SECRET</strong></td><td>Critical — lets attacker impersonate our app</td><td>Cloudflare Worker secret</td><td>Steal any user's tokens / spoof OAuth</td></tr>
    <tr><td><strong>GitHub PAT</strong></td><td>Medium — write access to issues, labels, milestones</td><td>Cloudflare Worker secret</td><td>Spam roadmap, mis-close issues, vandalize backlog</td></tr>
    <tr><td><strong>Confluence API token</strong></td><td>Low — write to one space only</td><td>Cloudflare Worker secret</td><td>Vandalize project docs</td></tr>
    <tr><td><strong>ADMIN_SECRET</strong></td><td>High — gates all <code>/admin/*</code> endpoints</td><td>CF Worker secret + local <code>.deploy.env</code> (gitignored)</td><td>Trigger arbitrary admin operations (close issues, edit Confluence)</td></tr>
    <tr><td><strong>SYSTEM_ANTHROPIC_KEY</strong> (optional)</td><td>Medium — system-owned Claude usage</td><td>CF Worker secret</td><td>Burn through our credits if leaked</td></tr>
  </tbody>
</table>

<h2>2. Authentication flow</h2>
<p>OAuth 2.0 authorization-code grant against Strava. See <strong>Systems &amp; Architecture · §4.1</strong> for the full sequence. Highlights:</p>
<ul>
  <li>State param round-trips PWA + origin metadata as base64-JSON. <strong>Issue #14</strong>: not yet a CSRF nonce; replay/CSRF risk exists today.</li>
  <li>Tokens stored client-side in <code>localStorage</code> (XSS exposure — see §6).</li>
  <li>Tokens dual-written to D1 <code>user_connections</code> (Strangler-Fig migration toward server-side session).</li>
  <li>Refresh: <code>ensureValidToken()</code> in <code>auth.ts</code> auto-refreshes when token has &lt; 5 min remaining.</li>
  <li>Disconnect: <code>clearTokens()</code> + <code>queryClient.clear()</code> on the client. <strong>Does not</strong> revoke the OAuth grant on Strava — user must revoke at <code>strava.com/settings/apps</code> (linked in User menu).</li>
</ul>

<h2>3. Secrets inventory</h2>
<table>
  <tbody>
    <tr><th>Secret</th><th>Where</th><th>Used by</th><th>Rotation policy</th></tr>
    <tr><td><code>STRAVA_CLIENT_ID</code></td><td>CF Worker var (not secret)</td><td><code>/authorize</code></td><td>Never (public Strava app id)</td></tr>
    <tr><td><code>STRAVA_CLIENT_SECRET</code></td><td>CF Worker secret</td><td><code>/callback</code>, <code>/refresh</code></td><td>Per Strava advice; not on schedule</td></tr>
    <tr><td><code>STRAVA_VERIFY_TOKEN</code></td><td>CF Worker secret (optional, with insecure fallback — <strong>issue #19</strong>)</td><td><code>/webhook</code> GET subscription verification</td><td>Rotate when leaked; today has hardcoded source-code fallback</td></tr>
    <tr><td><code>GITHUB_TOKEN</code></td><td>CF Worker secret</td><td><code>/roadmap</code>, <code>/admin/*</code> doc-sync, GitHub-API helpers</td><td>90-day Atlassian-style PAT — needs renewal alerting</td></tr>
    <tr><td><code>CONFLUENCE_API_TOKEN</code></td><td>CF Worker secret</td><td><code>/admin/document-release</code></td><td>Per Atlassian advice</td></tr>
    <tr><td><code>CONFLUENCE_USER_EMAIL</code></td><td>CF Worker secret (could be var)</td><td>Confluence Basic auth</td><td>n/a</td></tr>
    <tr><td><code>ADMIN_SECRET</code></td><td>CF Worker secret + local <code>.deploy.env</code> (gitignored)</td><td><code>requireAdmin()</code> on all <code>/admin/*</code></td><td>Manual rotation if leaked. Use <code>openssl rand -hex 32</code> when generating.</td></tr>
    <tr><td><code>SYSTEM_ANTHROPIC_KEY</code> (optional)</td><td>CF Worker secret</td><td>Auto-doc Claude calls (when set)</td><td>Per Anthropic advice</td></tr>
  </tbody>
</table>

<h2>4. CORS posture</h2>
<table>
  <tbody>
    <tr><th>Endpoint</th><th>Current</th><th>Risk</th><th>Status</th></tr>
    <tr><td><code>/api/*</code></td><td><code>*</code></td><td>Low — Authorization header is the gate</td><td>OK</td></tr>
    <tr><td><code>/roadmap</code>, <code>/version</code></td><td><code>*</code></td><td>None — public read</td><td>OK</td></tr>
    <tr><td><code>/coach</code>, <code>/coach-ride</code></td><td><code>*</code></td><td>Medium — third-party page can POST with leaked api_key</td><td>Issue #16</td></tr>
    <tr><td><code>/admin/*</code></td><td><code>*</code></td><td>Low — gated by ADMIN_SECRET regardless</td><td>OK (gate is in app, not browser)</td></tr>
    <tr><td><code>/authorize</code>, <code>/callback</code>, <code>/refresh</code>, <code>/webhook</code></td><td><code>*</code></td><td>Various</td><td>Reviewed alongside #16</td></tr>
  </tbody>
</table>

<h2>5. Security headers</h2>
<p>None currently set. <strong>Issue #15</strong> tracks adding:</p>
<ul>
  <li><code>Content-Security-Policy</code> — strict policy with allowlists for fonts.googleapis, Anthropic, Strava, GitHub</li>
  <li><code>Strict-Transport-Security</code> — HSTS with 1-year max-age</li>
  <li><code>X-Frame-Options: DENY</code> (clickjack)</li>
  <li><code>X-Content-Type-Options: nosniff</code></li>
  <li><code>Referrer-Policy: strict-origin-when-cross-origin</code></li>
  <li><code>Permissions-Policy: camera=(), microphone=(), geolocation=()</code></li>
</ul>

<h2>6. localStorage XSS exposure</h2>
<p>Strava tokens, Anthropic API key, and athlete profile all live in <code>localStorage</code>. Any XSS sink in the React code would leak everything to the attacker. Current defences:</p>
<ul>
  <li><strong>React's default escaping</strong> — all rendered text auto-escaped.</li>
  <li><strong>Zero <code>dangerouslySetInnerHTML</code> usage</strong> in the codebase (verified via grep). Markdown bodies (e.g. roadmap items) rendered as plain text.</li>
  <li><strong>Strict TypeScript</strong> — no <code>any</code> in component props (mostly).</li>
  <li><strong>Planned CSP</strong> (issue #15) — third defence layer on top.</li>
</ul>
<p>Documented as a known trade-off; <strong>issue #22</strong> tracks publishing a <code>SECURITY.md</code> with the full threat model.</p>

<h2>7. Rate limiting</h2>
<p>None currently applied to Worker endpoints. <strong>Issue #18</strong> tracks introducing Cloudflare's Workers Rate Limiting binding for <code>/coach</code> and <code>/coach-ride</code> (per-IP and per-athlete-id). <code>/roadmap</code> is naturally rate-limited by its 5-min edge cache.</p>

<h2>8. /admin auth</h2>
<p><code>requireAdmin()</code> verifies <code>Authorization: Bearer $ADMIN_SECRET</code> on every <code>/admin/*</code> endpoint. Without the env var set, returns 503; with wrong/missing header, 401. Length-checked compare (Worker runtime doesn't expose <code>timingSafeEqual</code>, but admin endpoints are low-traffic enough that timing attacks aren't the bar).</p>
<p><strong>Issue #21</strong> tracks formalising this as a documented pattern (was previously dependent on developer discipline — temp endpoints could be left live by mistake). Now that <code>requireAdmin()</code> is in place, even a forgotten endpoint requires the secret.</p>

<h2>9. Webhook source verification</h2>
<p>Currently no source verification on <code>POST /webhook</code> — anyone can hit it and we'll log it. Bounded impact (handler does not write to D1). <strong>Issue #17</strong> tracks IP-allowlist or path-secret defence before D1 actions get wired to webhook events.</p>

<h2>10. Logging hygiene</h2>
<p><code>observability.logs.persist: true</code> in <code>wrangler.jsonc</code>. Currently no <code>api_key</code> redaction in error paths. <strong>Issue #20</strong> tracks adding a <code>redactSensitive()</code> helper that strips <code>api_key</code>, <code>access_token</code>, <code>refresh_token</code> from any logged message.</p>

<h2>11. Open hardening backlog</h2>
<table>
  <tbody>
    <tr><th>#</th><th>Title</th><th>Priority</th><th>Milestone</th></tr>
    <tr><td>14</td><td>OAuth state is predictable JSON, not a CSRF nonce</td><td>high</td><td>v8.4.0</td></tr>
    <tr><td>15</td><td>Add security headers to all Worker responses</td><td>high</td><td>v8.4.0</td></tr>
    <tr><td>16</td><td>Lock down CORS on /coach + /coach-ride</td><td>medium</td><td>v8.4.0</td></tr>
    <tr><td>17</td><td>/webhook POST has no source verification</td><td>medium</td><td>v8.5.0</td></tr>
    <tr><td>18</td><td>Rate-limit /coach + /coach-ride</td><td>medium</td><td>v8.5.0</td></tr>
    <tr><td>19</td><td>STRAVA_VERIFY_TOKEN insecure fallback</td><td>low</td><td>v8.5.0</td></tr>
    <tr><td>20</td><td>Redact api_key from logged errors</td><td>low</td><td>v8.5.0</td></tr>
    <tr><td>21</td><td>/admin/* explicit auth (partially shipped via requireAdmin)</td><td>low</td><td>v8.5.0</td></tr>
    <tr><td>22</td><td>Document threat model in SECURITY.md</td><td>low</td><td>v8.5.0</td></tr>
  </tbody>
</table>
<p>Live issue status: see the <strong>Roadmap</strong> page.</p>

<h2>12. Disclosure policy</h2>
<p>This is a single-maintainer hobby project. To report a security issue confidentially: open a <a href="https://github.com/jose-reboredo/cycling-coach/security/advisories/new">GitHub Security Advisory</a> (preferred — private until resolved) or DM the maintainer on Strava. We don't run a bug-bounty program; please be patient with response times.</p>`,
  },
];

// Pages from earlier doc structure to be cleaned up on first run after the
// refactor. Removed via Confluence API (purge=true). Safe — these were
// auto-generated stubs with no manual edits.
export const LEGACY_PAGES_TO_REMOVE = [
  'Functional documentation',
  'Technical documentation',
];
