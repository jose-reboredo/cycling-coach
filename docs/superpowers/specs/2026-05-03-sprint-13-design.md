# Sprint 13 — Design Spec

**Date:** 2026-05-03
**Status:** Approved (brainstorming flow complete; ready for writing-plans)
**Sprint type:** User-value feature delivery
**Releases planned:** 2 — `v11.1.0` (credentials substrate) + `v11.2.0` (My Account UI + #5 + housekeeping)
**Total budget:** ~17.5h across 2 days
**Authors:** Brainstormed via the orchestrator (Architect / Security / Strategy consultations on Opus); locked by founder.

---

## 1. Sprint charge

Sprint 13 ships **two GitHub-tracked P1 feature items + one P2 polish item + housekeeping**, focused on user value:

- **#52** — Expand `/dashboard/you` into a full My Account page (personal data, Anthropic API key with proper encryption, consent placeholder)
- **#5** — Volume chart shows distance + elevation numbers per bucket
- **#79** + **#80** — close on GitHub (already shipped in v9.12.2 / v10.12.0; confirmed via code inspection during brainstorming)

Two strategic gains beyond the visible features:
1. **Credentials substrate** — passphrase-derived AES-GCM encryption + `user_credentials` table, multi-provider-ready, Pro-tier-substrate-ready (`managed: 1` flag)
2. **First in-app surface** to consume the v11.0.0 design system end-to-end (early signal for Sprint 14+ in-app token migration)

## 2. Why this sprint exists (wedge)

Two real user-value gaps the backlog flagged:

1. **Profile is a stub.** Today's `/dashboard/you` collapses Strava connection + AI key + RWGPS status + a tiny FTP/weight/HR Max card into a flat stack. There's no place for a name, DOB, gender, location, or a consent surface. The "BYOK / your key, your device" voice is undermined by the user not actually owning a coherent account view.
2. **Static `8,000 km / X` goal bar lies.** Users hit it and see an arbitrary number. (#49 forecast is the targeted fix; deferred to a later sprint to keep Sprint 13 single-themed.)

**Hypothesis:** a credible My Account page + an honest volume chart move the perceived ownership of the product from "AI tool with a profile screen" to "training brain that's mine". The credentials substrate (passphrase-derived encryption) **defends the BYOK ethos** while unlocking cross-device sync, multi-provider, and a clean Pro-tier substrate without architectural debt.

## 3. Decisions locked at sprint open (2026-05-03)

| # | Decision | Rationale |
|---|---|---|
| 1 | Two releases (v11.1.0 substrate + v11.2.0 UI), not one bundled cut | Per `feedback_pre-coding-scope-alignment.md`: each release ≤ 1 risk theme. Substrate = secrets handling; UI = profile/page. |
| 2 | Anthropic-key storage = passphrase-derived AES-GCM (Strategy's option C, not Architect's B or Security's A) | Strategy's case for unlocking multi-device + multi-provider + Pro-tier substrate without breaking BYOK ethos. Worker compromise yields ciphertext, not keys. |
| 3 | KDF = PBKDF2-SHA-256, 600k iterations | WebCrypto-native on Workers + browsers. No WASM dep. NIST SP 800-132 (2023) compliant. `kdf_iterations` column allows future Argon2id rotation. |
| 4 | Recovery code = 6×4 alphanumeric dashed (`X7K2-PQ9R-MN4T-VC3H-J8L1-WD5E`) | No 2KB wordlist bundle. Compact. Phone-typeable. |
| 5 | Setup modal trigger = first attempt to save an Anthropic key (not at sign-in or first AI use) | Contextual — modal fires when encryption is needed. Existing localStorage path stays valid until then per `feedback_additive-foundation-migrations.md`. |
| 6 | My Account page replaces `/dashboard/you` (no new route) | Preserves BottomNav 5-slot anchor. Per the issue title: "Expand Edit Profile". |
| 7 | "Test key" button hits real `/v1/messages` ping (model: claude-haiku-4-5-20251001, max_tokens: 1) | Cost ~$0.0001/test; validates live key + balance + rate limits. No new attack surface (existing AI-call proxy path). |
| 8 | Consent & Data section ships as **honest placeholder**, not implemented | Implementation needs a focused privacy sprint (data export + account deletion + consent toggles). Placeholder is per the empty-state voice rule. |
| 9 | Recovery flow nukes ciphertexts (old master key gone with passphrase) | The ciphertext is unrecoverable garbage under the new master key. Cleaner to clear than retain dangling rows. |

## 4. Architecture — credentials substrate (v11.1.0)

### 4.1 Schema migrations (additive)

```sql
-- migrations/0014_user_credentials.sql
CREATE TABLE user_credentials (
  athlete_id        INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  provider          TEXT    NOT NULL,        -- 'anthropic' | 'openai' | 'local-llama' | …
  managed           INTEGER NOT NULL DEFAULT 0,  -- 0 = BYOK ciphertext; 1 = server-managed (Pro-tier substrate)
  ciphertext        BLOB,                    -- AES-GCM ciphertext; NULL when managed=1
  iv                BLOB,                    -- 12-byte per-row IV
  kdf_salt          BLOB,                    -- 16-byte per-user salt (same value across rows for one user)
  kdf_iterations    INTEGER NOT NULL DEFAULT 600000,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  PRIMARY KEY (athlete_id, provider)
);

CREATE INDEX idx_user_credentials_athlete ON user_credentials(athlete_id);
```

```sql
-- migrations/0015_user_recovery_meta.sql
ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;        -- SHA-256 of the recovery code
ALTER TABLE users ADD COLUMN passphrase_set_at  INTEGER;    -- timestamp; gates the AI flow
```

### 4.2 Trust boundary + key flow

The passphrase **never** leaves the device. The master key (PBKDF2-derived from passphrase + per-user salt) **never** leaves the device. The Worker stores ciphertext + IV in D1 and proxies the AI call with the user's plaintext API key in the request body — same path as today's localStorage flow, no new attack surface.

A Worker compromise (RCE / supply-chain / careless admin endpoint) leaks **ciphertext only**. Deriving plaintext keys requires the passphrase, which the Worker never sees. This is the architectural property Strategy's option C buys; it's the reason we picked it.

### 4.3 Non-negotiable controls (Security)

1. Passphrase **never** in request body, logs, or error responses.
2. Master key **never** server-side. Decryption happens in the browser; plaintext API key is sent only to the AI-call request body.
3. Worker has **no decrypt path** for `user_credentials.ciphertext`.
4. Ciphertext + plaintext **banned from all log lines and error responses** — locked by static-scan contract test.
5. Per-row 12-byte random IV (one per provider save). Per-user 16-byte random salt (one per user, set at first passphrase).
6. **AAD (Additional Authenticated Data) bound per call.** AES-GCM `additionalData = utf8("athlete:" + athlete_id + "|provider:" + provider)`. Prevents ciphertext-replay across users (User A's ciphertext can't be successfully decrypted against User B's row, even if the master key were the same). Locked by unit test: decrypt with wrong AAD → throws `OperationError`.
7. CSP + response headers unchanged from current baseline (no new third-party origins required).
8. Recovery code hash uses SHA-256 (single-shot value, low entropy budget; bcrypt overkill).

### 4.4 Worker endpoints

| Method | Path | Body | Effect |
|---|---|---|---|
| `POST` | `/api/me/passphrase/setup` | `{ kdf_salt, recovery_code_hash, passphrase_set_at }` | Writes `users.recovery_code_hash` + `passphrase_set_at`; the next `/credentials` write uses the salt the client derived from |
| `GET` | `/api/me/credentials` | — | Returns `[{ provider, ciphertext, iv, kdf_salt, kdf_iterations, updated_at }]`; rows with `managed=1` return `ciphertext: null` |
| `PATCH` | `/api/me/credentials` | `{ provider, ciphertext, iv }` | Upserts one row |
| `DELETE` | `/api/me/credentials/:provider` | — | Deletes one provider's ciphertext |
| `POST` | `/api/me/passphrase/recover` | `{ recovery_code }` | Server hashes incoming code; on match, returns `kdf_salt` + clears `recovery_code_hash` + nukes all `user_credentials.ciphertext` rows |
| `GET` | `/api/me/profile` | — | Returns `{ name, dob, gender, gender_self, city, country, ftp, weight_kg, hr_max, passphrase_set_at }` |
| `PATCH` | `/api/me/profile` | `{ name?, dob?, gender?, gender_self?, city?, country?, ftp?, weight_kg?, hr_max? }` | Validates server-side; updates row |

All gated by `resolveAthleteId()` (existing authn pattern). Authz implicit via `WHERE athlete_id = ?` (existing authz pattern, locked by Sprint 11 `worker-authz-contract.test.ts`).

### 4.5 Client encryption module

`apps/web/src/lib/credentials.ts` — public exports:

```ts
export async function deriveMasterKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey>
export async function encryptKey(masterKey: CryptoKey, plaintext: string, aad: Uint8Array): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }>
export async function decryptKey(masterKey: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array, aad: Uint8Array): Promise<string>
export function buildAAD(athleteId: number, provider: string): Uint8Array  // utf8("athlete:" + athleteId + "|provider:" + provider)
export function generateRecoveryCode(): string                  // 24-char `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`, alphabet excludes 0/O/1/I/L
export async function hashRecoveryCode(code: string): Promise<string>  // SHA-256 hex
```

Pure module; no React, no router, no fetch. Easy to unit-test.

## 5. UX — passphrase setup + recovery flows (v11.1.0)

> **Vocabulary update (added 2026-05-03 post-v11.1.0 ship per founder feedback):** All user-facing copy in v11.2.0 onwards uses "password" instead of "passphrase", "lock"/"unlock" instead of "encrypt"/"decrypt", and "backup code" instead of "recovery code". The substrate naming (component files, DB columns, endpoint paths, internal variables, code comments) stays unchanged — only what users *see* is rewritten. v11.1.0 ships with the original vocabulary; v11.2.0 sweeps it. See AC-1.2.11 in `docs/post-demo-sprint/sprint-13/01-business-requirements.md` for the full before/after table.

### 5.1 First-time passphrase setup (3-step modal)

**Step 1 — Set passphrase**
- Headline: "Set your passphrase"
- Body: "Your Anthropic key needs a passphrase. We use it to encrypt the key on your device — neither Cadence Club nor Cloudflare can read it. Forget the passphrase, lose the key (recovery code on the next step)."
- Inputs: passphrase (masked, required) + confirm passphrase (masked, required, must match)
- CTA: `[Continue]` (disabled until both fields valid)

**Step 2 — Save recovery code**
- Headline: "Save your recovery code"
- Body: "Write this down. We can't recover it for you. This code resets your passphrase on a lost device — without it, you re-enter your Anthropic key from scratch."
- Code rendered in mono, large, dashed format
- Buttons: `[Download as .txt]` (auto-trigger on click, filename `cadence-club-recovery-code.txt`) + `[Copy to clipboard]`
- Checkbox: "I've saved it somewhere safe." (gates the next button)
- CTA: `[Encrypt my key]` (disabled until checkbox is checked)

**Step 3 — Done**
- Headline: "Encrypted"
- Body: "Your key is on your device, encrypted with your passphrase. Re-enter on each new device or use the recovery code."
- CTA: `[Back to AI Coach]`

Voice: sentence-case headlines; honest about the trade ("Forget the passphrase, lose the key"); no apology copy.

### 5.2 Daily-use unlock — passphrase prompt

Each new browser session that needs the master key prompts once:
- Inline card on the AI Coach section: "Enter your passphrase to use AI features."
- Single passphrase input + `[Unlock]` button.
- On success: derive master key (held in React component state for the session; never persisted) → fetch ciphertext → decrypt → cache plaintext key in `useState` (memory only) for AI calls.
- On wrong passphrase: AES-GCM auth tag mismatch surfaces as `OperationError` → inline error: "That passphrase doesn't match. Try again or use your recovery code."

The plaintext key never touches localStorage in the new flow. It lives in React state for the session, and gets garbage-collected when the tab closes.

### 5.3 Recovery flow (`/account/recover`)

- Headline: "Lost your passphrase?"
- Body: "Enter your recovery code. We'll set up a new passphrase. You'll need to re-enter any encrypted keys (Anthropic, etc.) once."
- Inputs: recovery code (masked-or-plain toggle)
- CTA: `[Recover]`
- On submit:
  1. `POST /api/me/passphrase/recover` with the code.
  2. Server hashes + compares to `users.recovery_code_hash`. On match: returns `kdf_salt`, clears `recovery_code_hash`, nukes `user_credentials.ciphertext` rows.
  3. Client prompts new passphrase + confirm.
  4. Client derives new master key (same salt). Generates new recovery code. Step 2 of the setup modal repeats.
  5. User redirected to AI Coach card; "No keys stored — re-enter your Anthropic key" message.

### 5.4 "Move existing localStorage key to encrypted storage" prompt (one-time, additive migration)

For users who already had a key in localStorage pre-Sprint-13:
- On next visit to AI Coach card *only* if `localStorage.anthropicKey` exists AND `passphrase_set_at` is null:
- Inline banner: "Move your Anthropic key to encrypted storage." with `[Set up encryption]` button → triggers Section 5.1 setup modal.
- After setup completes, the key is encrypted to D1 and `localStorage.anthropicKey` is cleared.

Until the user runs this migration, the existing localStorage path keeps working. Per `feedback_additive-foundation-migrations.md`.

## 6. UX — My Account page (v11.2.0)

### 6.1 Page structure

`/dashboard/you` becomes a 5-section vertical stack:

```
№ 01 — PERSONAL
  Name *           [text]
  Date of birth    [date]
  Gender           [select: prefer not to say · woman · man · non-binary · self-describe]
  Self-describe    [text · only when gender='self-describe']
  City             [text]
  Country          [select · ISO 3166 alpha-2]
  Save / Discard

№ 02 — PERFORMANCE
  FTP *            [number, watts]
  Weight *         [number, kg]
  HR Max *         [number, bpm]
  Caption: "Used by PMC, plan generation, and zone math."
  Save / Discard

№ 03 — AI COACH (Anthropic)
  Status           [encrypted on this device · YYYY-MM-DD]
  [if no passphrase] [Set passphrase] → opens setup modal
  Anthropic key    [masked input + Save · Test]
  Forgot passphrase?  [link → /account/recover]
  Remove key       [DELETE /api/me/credentials/anthropic]

№ 04 — CONNECTIONS
  Strava           [Connected as <Strava name> · YYYY-MM-DD]    [Disconnect]
  Ride with GPS    [Not connected]                              [Connect]

№ 05 — CONSENT & DATA  (placeholder)
  EmptyState component:
    "Coming soon"
    "Export your data, delete your account, manage consent settings here."
    No CTA in this release.
```

### 6.2 Component reuse

All from the v11.0.0 design system (Sprint 12 kit). Zero new components.

- `Card tone="elev" pad="md"` per section
- `Eyebrow rule tone="accent"` for `№ 0X` section labels
- `Button variant="primary"` on Save; `secondary` on Discard; `ghost` on Disconnect; `link` on "Forgot passphrase?"; `destructive` on Remove key
- `EmptyState` for the Consent & Data section

### 6.3 Validation — shared constants

`apps/web/src/lib/validation.ts` — shared between client form + server endpoint:

```ts
export const PROFILE_LIMITS = {
  name: { max: 80 },
  dob: { minYear: 1900 },
  city: { max: 64 },
  country: { regex: /^[A-Z]{2}$/ },         // ISO 3166 alpha-2
  ftp: { min: 50, max: 600 },
  weight_kg: { min: 30, max: 200 },
  hr_max: { min: 100, max: 230 },
} as const;
```

Static-scan contract test asserts the same constants live in `lib/validation.ts` and are imported by both `apps/web/src/routes/dashboard.you.tsx` and `src/worker.js`.

## 7. UX — #5 Volume chart per-bucket numbers (v11.2.0)

`apps/web/src/components/VolumeChart/`:

- Each weekly/monthly bar renders a label below or above showing `<distance>km · <elevation>m`.
- Mobile (375px): single-line abbreviated, e.g. `40km · 800m`. Desktop: same, slightly larger via the existing type scale.
- Hover (desktop) / focus (keyboard) reveals the unrounded value via the native HTML `<title>` element — no JS tooltip lib, free keyboard accessibility.
- Visible always, not hover-gated, per `senior-pro-markers.md`: numbers on a chart should be readable, not discoverable.

Effort: ~2h.

## 8. Test strategy + verification gates

### 8.1 v11.1.0 — credentials substrate

**New static-scan contract tests** (`apps/web/src/lib/__tests__/credentials-contract.test.ts`):

| Assertion | Why |
|---|---|
| `user_credentials` table declared in `schema.sql` (cumulative) and `migrations/0014_user_credentials.sql` | Migration discipline |
| `users.recovery_code_hash` + `users.passphrase_set_at` declared in `schema.sql` and `migrations/0015_user_recovery_meta.sql` | Same |
| `apps/web/src/lib/credentials.ts` exports `deriveMasterKey`, `encryptKey`, `decryptKey`, `generateRecoveryCode`, `hashRecoveryCode` with documented signatures | Public API lock |
| Worker source contains zero log lines or response bodies that could leak `ciphertext`, `passphrase`, `master_key`, `api_key` (regex scan over `src/worker.js`) | Security non-negotiable |
| Worker `/api/me/credentials*` + `/api/me/passphrase/*` handlers all invoke `resolveAthleteId()` before any `db.prepare()` | Authn pattern |
| Worker `/api/me/credentials*` UPDATE/DELETE/SELECT statements all carry `WHERE athlete_id = ?` | Authz pattern |
| `kdf_iterations` default = 600000 in migration; client uses same constant from `lib/credentials.ts` | Drift lock |
| Credentials helpers contain no `localStorage` writes that would leak the master key | Trust-boundary invariant |

**New unit tests** (`apps/web/src/lib/__tests__/credentials.test.ts`):

- Round-trip: derive → encrypt → decrypt → equal plaintext
- Wrong passphrase → decrypt throws `OperationError`
- Recovery-code generation: 24 chars, dashed `4-4-4-4-4-4`, alphabet excludes `0/O/1/I/L`, 100 generated codes are all unique
- Hash-recovery-code is deterministic (same input → same hex)
- `kdf_iterations` rotation: ciphertext encrypted at 600k decrypts when consumer uses the iteration count from the row

### 8.2 v11.2.0 — My Account UI

- Extend the Sprint 12 design-system contract test scope to include `/dashboard/you` rebuild — the var-resolution scan should cover the new page CSS.
- Validation drift test: `lib/validation.ts` constants used by both the form and the worker handler.
- Manual visual smoke at desktop 1280×800 + mobile 375×812.
- Console: 0 errors.

### 8.3 Release gates

```
v11.1.0 release gate (T3 — full ceremony):
  ✓ Architect ADR for the credentials substrate (committed alongside the migration as adr-credentials-substrate.md)
  ✓ Static-scan contract tests green (credentials-contract.test.ts)
  ✓ Unit tests green (credentials.test.ts)
  ✓ tsc --noEmit exit 0
  ✓ build green
  ✓ Phase 5 parity audit: no in-app surface regression from new schema
  ✓ Manual smoke: setup → save → reload → decrypt; recover → ciphertext nuke → re-encrypt
  ✓ README sweep
  ✓ CHANGELOG entry
  ✓ Founder approval gate before deploy

v11.2.0 release gate (T2 — lean ceremony):
  ✓ Extended design-system contract tests green
  ✓ Validation-drift contract test green
  ✓ tsc --noEmit exit 0
  ✓ build green
  ✓ Visual smoke at desktop + 375px mobile (My Account page + VolumeChart numbers)
  ✓ A11y check: form fields keyboard-navigable; error states announced (aria-live polite)
  ✓ README sweep (Routes table updates `/dashboard/you` description; Components table)
  ✓ CHANGELOG entry
  ✓ Founder approval gate before deploy
  ✓ Close GitHub #79 + #80 with shipped-in-vX.Y.Z notes (housekeeping)
```

## 9. Risk register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| PBKDF2 600k iterations feel slow on low-end devices | Medium | Low | Setup-modal copy explains "Encrypting…"; ~250ms is acceptable; metric-collect post-ship if complaints |
| User loses passphrase + recovery code | High over time | Medium (lost convenience, key re-enter required) | Modal copy is honest; recovery code download + copy + checkbox-gated; .txt download auto-triggers on click |
| Worker compromise → master key still safe (passphrase-derived, not server-bound) | Low | Low (ciphertext-only leak; not exploitable without passphrase) | Trust boundary holds even under Worker RCE — that's the property the choice buys |
| Schema migration breaks an in-flight user mid-deploy | Low | Medium | Additive-only migration; existing rows unaffected; new columns nullable |
| Anthropic key Test button costs accumulate | Low | Low | $0.0001/test; rate-limit to 1 test per 10s on the client side |
| `/dashboard/you` rebuild regresses an existing flow | Low | Medium | Phase 5 parity audit + 375px mobile smoke before deploy |
| Forgotten passphrase leaves dangling ciphertext | Low | Low | Recovery flow nukes ciphertext cleanly; no garbage retained |
| The "Move your existing key" migration banner is missed | Low | Low | Banner persists until acted on; user keeps using localStorage flow until they migrate |

## 10. Memory rules in scope

- `feedback_pre-coding-scope-alignment.md` — two releases, ≤ 1 risk theme each
- `feedback_additive-foundation-migrations.md` — schema migrations are additive; existing localStorage flow stays valid until passphrase setup
- `feedback_static-scan-contracts.md` — new credentials-contract test suite extends the pattern from worker-cache / authn / authz contracts
- `feedback_pre-deploy-verification.md` — Phase 5 parity audit before each release
- `feedback_release-readme-sweep.md` — README sweep in each release commit
- `feedback_release-ceremony.md` — single-day push per release; founder approval gates respected
- `feedback_economy-model.md` — Opus for the role consultations (Architect, Security, Strategy) + judgment moments; Sonnet for mechanical edits
- `feedback_sprint-documentation-mandatory.md` — 4-doc sprint shape (00-summary + 01-business-requirements + 02-architecture-changes + 03-cto-review)

## 11. Open questions surfaced for the next sprint

- **Argon2id rotation** — when the WASM bundle cost falls or a future sprint needs the stronger primitive, the `kdf_iterations` + future `kdf_algo` columns make this a clean rotation. Backlog item.
- **`managed: 1` Pro-tier flow** — Strategy's substrate is in place; the actual server-side managed-key plumbing (Anthropic billing relay, Stripe webhook, etc.) is a future-sprint feature. Not Sprint 13.
- **Multi-provider rollout** — `(athlete_id, provider)` PK supports it; the UI surface for adding OpenAI / Llama / etc. is a future-sprint feature. Not Sprint 13.
- **Data export + account deletion** — the Consent & Data section ships as honest placeholder; implementation = a focused privacy sprint.

## 12. References

- Issue: [#52](https://github.com/jose-reboredo/cycling-coach/issues/52) — Expand Edit Profile into full My Account page
- Issue: [#5](https://github.com/jose-reboredo/cycling-coach/issues/5) — Volume chart distance + elevation per bucket
- Issue: [#79](https://github.com/jose-reboredo/cycling-coach/issues/79) — v9.12.2 polish bundle (close as shipped)
- Issue: [#80](https://github.com/jose-reboredo/cycling-coach/issues/80) — Schedule calendar event blocks misaligned (close as shipped in v10.12.0)
- Memory: [`reference_master-ways-of-working.md`](../../../../.claude/projects/-Users-josereboredo-cycling-coach-cycling-coach/memory/reference_master-ways-of-working.md)
- Sprint folder: [`docs/post-demo-sprint/sprint-13/`](../../post-demo-sprint/sprint-13/)
