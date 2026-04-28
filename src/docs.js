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
    storage: STUB('APIs', 'Step B2'),
  },
  {
    slug: 'interfaces',
    title: '3. User Interfaces',
    storage: STUB('User Interfaces', 'Step B3'),
  },
  {
    slug: 'functional-spec',
    title: '4. Functional Specification',
    storage: STUB('Functional Specification', 'Step B4'),
  },
  {
    slug: 'technical-spec',
    title: '5. Technical Specification',
    storage: STUB('Technical Specification', 'Step B5'),
  },
  {
    slug: 'security',
    title: '6. Security',
    storage: STUB('Security', 'Step B6'),
  },
];

// Pages from earlier doc structure to be cleaned up on first run after the
// refactor. Removed via Confluence API (purge=true). Safe — these were
// auto-generated stubs with no manual edits.
export const LEGACY_PAGES_TO_REMOVE = [
  'Functional documentation',
  'Technical documentation',
];
