# Architecture Changes — Sprint 2
**Author:** Architect
**Date:** 2026-04-30
**Inputs:** `sprint-2/01-business-requirements.md`, `sprint-1/02-architecture-changes.md`
**Issues addressed:** FB-R1, FB-R2 (regressions) + carry-forward #49, #50, #52

---

## §A. FB-R1 — postJson() auth fix (frontend-only)

**Root cause:** `postJson()` in `apps/web/src/lib/coachApi.ts:89` sends only `Content-Type`. The
`/coach` and `/coach-ride` bearer gate (introduced in v9.3.0 to close CRITICAL #33) therefore
rejects every request with 401. The gate is correct and must stay.

### A.1 CoachError extension

Current (`coachApi.ts:81-86`):

```js
export class CoachError extends Error {
  invalidKey: boolean;
  constructor(message: string, invalidKey = false) {
    super(message);
    this.invalidKey = invalidKey;
  }
}
```

New — add `stravaExpired` flag alongside `invalidKey`:

```js
export class CoachError extends Error {
  invalidKey: boolean;
  stravaExpired: boolean;
  constructor(message: string, invalidKey = false, stravaExpired = false) {
    super(message);
    this.invalidKey = invalidKey;
    this.stravaExpired = stravaExpired;
  }
}
```

### A.2 postJson() diff

Current (`coachApi.ts:89-103`):

```js
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  ...
}
```

New:

```js
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const tokens = await ensureValidToken();          // from auth.ts:49
  if (!tokens) {
    throw new CoachError('strava-session-expired', false, true);
  }
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.access_token}`,
    },
    body: JSON.stringify(body),
  });
  ...
}
```

`ensureValidToken` is already exported from `apps/web/src/lib/auth.ts:49` — no new token-read
path (satisfies IR-R1).

### A.3 Caller sites that need to branch on stravaExpired

| File | Line(s) | Current branch | Required addition |
|---|---|---|---|
| `apps/web/src/hooks/useAiReport.ts` | 42-44 | `err.invalidKey` → `setInvalidKey` | Add: if `err.stravaExpired` → surface "reconnect Strava" CTA (see IR-R2: reuse `<ConnectScreen />` or existing `connect-strava` CTA) |
| `apps/web/src/hooks/useRideFeedback.ts` | 49-50 | only sets error message | Add: branch on `err.stravaExpired` same as above |
| `apps/web/src/components/AiCoachCard/AiCoachCard.tsx` | 123-153 | renders `invalidKey` hint at line 153 | Add parallel `stravaExpired` prop + render a "Reconnect Strava" link (mirrors `invalidKey` pattern at line 153) |

The `stravaExpired` branch pattern directly mirrors the existing `invalidKey` branch — no novel
UI component needed (satisfies IR-R2).

### A.4 Test addition

Add to `apps/web/src/lib/coachApi.test.ts` (create if absent):

```js
// Vitest unit — postJson throws with stravaExpired when ensureValidToken returns null
vi.mock('./auth', () => ({ ensureValidToken: vi.fn().mockResolvedValue(null) }));

test('postJson throws CoachError with stravaExpired=true when tokens are null', async () => {
  await expect(generateWeeklyReport({ ...minimalArgs })).rejects.toMatchObject({
    stravaExpired: true,
    invalidKey: false,
  });
});
```

No worker change. Bearer gate on `/coach` + `/coach-ride` is NOT touched (AC-R1 respected).

---

## §B. FB-R2 — You-tab API key hint copy fix (frontend-only)

**Root cause:** `dashboard.you.tsx:142-144` replaced the legacy copy from `AiCoachCard.tsx:90`,
dropping the "Your key stays in this browser" reassurance and the "Get a key →" link. Persona C
cannot complete BYOK setup without this guidance.

### B.1 JSX diff — dashboard.you.tsx:142-144

Current:

```tsx
<p className={styles.apiKeyHint}>
  Bring your own Anthropic key to generate a weekly training plan. Each plan ≈ $0.02.
</p>
```

New (mirrors `AiCoachCard.tsx:89-91`):

```tsx
<p className={styles.apiKeyHint}>
  AI coaching is bring-your-own-key. Each plan costs ≈ $0.02. Your key stays in this browser.{' '}
  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
    Get a key →
  </a>
</p>
```

This block is rendered only when no key is currently set (the surrounding conditional already
gates on key absence — per BA acceptance criteria, no change needed to the show/hide logic).

### B.2 CSS — TabShared.module.css

Current `.apiKeyHint` rule (`TabShared.module.css:351-354`):

```css
.apiKeyHint {
  font: italic 400 13px/1.5 var(--font-sans);
  color: var(--c-text-faint);
}
```

The rule has no `a` sub-selector, so the link will inherit `var(--c-text-faint)` with no
underline. Add a minimal extension:

```css
.apiKeyHint a {
  color: var(--c-accent);
  text-decoration: underline;
}
.apiKeyHint a:hover {
  opacity: 0.8;
}
```

Append immediately after the closing `}` of `.apiKeyHint`. No other rules touched.

---

## §C. Sprint 2 feature carry-forward (#49, #50, #52)

The three Sprint 1 features are fully specified in `docs/post-demo-sprint/03-architecture-changes.md`.
Do NOT re-spec here — reference only.

| Feature | Sprint 1 architect spec section | Carries to Sprint 2 |
|---|---|---|
| **#50** — annual goal data model + planning | §B.1 (reuse `goals` table, `goal_type='annual_km'`), §C.6 (`PUT /api/goals/annual`), §B-SQL (no new migration; `goals` table already exists) | yes — ships first |
| **#49** — AI year-end forecast | §C.1 (`GET /api/forecast`), §E (Haiku model, KV cache, webhook trigger), §B (reads `goals` table written by #50) | yes — ships after #50 |
| **#52** — You-tab profile expansion | §B.2 (Migration 0003: `users.sex`, `users.country` via Strava sync), §C.4 (`GET /api/athlete` passthrough extended), §B-SQL (Migration 0003 SQL) | yes — ships last |

### §C.4 callout — legacy-parity audit before #52 merges

Per Sprint 1 retro improvement #1: before merging the You-tab expansion (#52), run a
legacy-parity audit comparing `Dashboard.tsx`'s existing profile-edit flow against the new You-tab
content. The FB-R2 regression (missing link + copy) was caused by a component migration that
silently dropped content. A checklist diff of every rendered field and interactive element in the
old profile section vs the new You-tab will catch similar gaps before they ship.

Dependency order confirmed: **#50 → #49 → #52**.

---

## §D. Risk + dependency notes

- **Bearer gate stays.** `postJson` fix is additive (reads token, attaches header). Existing
  `/coach` and `/coach-ride` body shapes are unchanged — no caller-side breakage.
- **FB-R1 and FB-R2 are pure frontend.** No worker deploys, no schema changes, no migration
  needed for either regression fix.
- **Migration 0003** ships in Sprint 2 alongside #52. Apply to remote D1 after `schema.sql` +
  `db/README.md` updates are committed (per Sprint 1 arch spec §B-SQL).
- **No new endpoints** for the regression fixes. New endpoints for features (#49/#50/#52) are
  fully specified in the Sprint 1 architect doc — see §C above.
- **Sprint 2 effort estimate:**

| Work item | Estimate |
|---|---|
| FB-R1 (`postJson` fix + `CoachError` + caller branches + test) | ~3h |
| FB-R2 (copy diff + CSS) | ~1h |
| #50 annual goal (per Sprint 1 arch §C.6 + §B.1) | ~8h |
| #49 AI forecast (per Sprint 1 arch §E + §C.1) | ~12h |
| #52 You-tab expansion (per Sprint 1 arch §B.2 + §C.4 + legacy audit) | ~18h |
| **Total** | **~42h** |
