# Sprint 13 — Architecture Changes (Planned)

Status: **planned**. This document is the design-time plan; the shipped section will be filled at each release close.

## Schema

Two migrations land in v11.1.0; one in v11.2.0. All additive per `feedback_additive-foundation-migrations.md`.

### Migration 0014 — `user_credentials` table (v11.1.0)

```sql
CREATE TABLE user_credentials (
  athlete_id        INTEGER NOT NULL REFERENCES users(athlete_id) ON DELETE CASCADE,
  provider          TEXT    NOT NULL,
  managed           INTEGER NOT NULL DEFAULT 0,
  ciphertext        BLOB,
  iv                BLOB,
  kdf_salt          BLOB,
  kdf_iterations    INTEGER NOT NULL DEFAULT 600000,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  PRIMARY KEY (athlete_id, provider)
);

CREATE INDEX idx_user_credentials_athlete ON user_credentials(athlete_id);
```

Composite PK = multi-provider future is a row insert, not a migration. `managed=1` is the Pro-tier substrate (server-side managed key; ciphertext NULL).

### Migration 0015 — recovery metadata on `users` (v11.1.0)

```sql
ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE users ADD COLUMN passphrase_set_at  INTEGER;
```

Recovery is account-level (lives on `users`), not provider-level (would live on `user_credentials`).

### Migration 0016 — profile fields on `users` (v11.2.0)

```sql
ALTER TABLE users ADD COLUMN name        TEXT;
ALTER TABLE users ADD COLUMN dob         INTEGER;
ALTER TABLE users ADD COLUMN gender      TEXT;
ALTER TABLE users ADD COLUMN gender_self TEXT;
ALTER TABLE users ADD COLUMN city        TEXT;
ALTER TABLE users ADD COLUMN country     TEXT;
```

All nullable. Existing rows unaffected.

## Endpoints

All gated by `resolveAthleteId()` (existing authn). All scoped by `WHERE athlete_id = ?` (existing authz). Locked by extending `worker-authn-contract.test.ts` + `worker-authz-contract.test.ts` with the new endpoint paths.

### v11.1.0

| Method | Path | Body / Returns |
|---|---|---|
| `POST` | `/api/me/passphrase/setup` | `{ kdf_salt, recovery_code_hash, passphrase_set_at }` → `{ ok: true }` |
| `GET` | `/api/me/credentials` | → `[{ provider, ciphertext, iv, kdf_salt, kdf_iterations, updated_at }]`; `managed=1` rows return `ciphertext: null` |
| `PATCH` | `/api/me/credentials` | `{ provider, ciphertext, iv }` → `{ ok: true }` (upsert) |
| `DELETE` | `/api/me/credentials/:provider` | → `{ ok: true }` |
| `POST` | `/api/me/passphrase/recover` | `{ recovery_code }` → `{ kdf_salt }` on match (also clears `recovery_code_hash` + nukes ciphertexts); else 401 |

### v11.2.0

| Method | Path | Body / Returns |
|---|---|---|
| `GET` | `/api/me/profile` | → `{ name, dob, gender, gender_self, city, country, ftp, weight_kg, hr_max, passphrase_set_at }` |
| `PATCH` | `/api/me/profile` | partial body of any subset of profile fields → `{ ok: true }` or 400 with field-level errors |

## Frontend — credentials substrate (v11.1.0)

### Module: `apps/web/src/lib/credentials.ts`

Pure module; no React, no router, no fetch. Easy to unit-test.

```ts
export async function deriveMasterKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey>
export async function encryptKey(masterKey: CryptoKey, plaintext: string, aad: Uint8Array): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }>
export async function decryptKey(masterKey: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array, aad: Uint8Array): Promise<string>
export function buildAAD(athleteId: number, provider: string): Uint8Array
export function generateRecoveryCode(): string
export async function hashRecoveryCode(code: string): Promise<string>
```

AAD (Additional Authenticated Data) is `utf8("athlete:" + athleteId + "|provider:" + provider)` — bound per call so User A's ciphertext can't be replay-decrypted against User B's row even under master-key reuse.

### Hook: `apps/web/src/hooks/usePassphrase.ts`

Holds the master key in React state for the session. Exposes:

```ts
function usePassphrase(): {
  unlocked: boolean
  unlock: (passphrase: string) => Promise<void>
  lock: () => void                                  // forgets the master key
  encrypt: (plaintext: string) => Promise<{ ciphertext, iv }>
  decrypt: (ciphertext, iv) => Promise<string>
}
```

The master key never persists anywhere — page reload = re-enter passphrase.

### UX surfaces (v11.1.0)

- **`SetupPassphraseModal`** — 3-step modal triggered by AI Coach card on first key save (or by the migration banner)
- **`PassphraseUnlockCard`** — inline replacement for the AI Coach card body when the user has a key set but hasn't unlocked this session
- **`/account/recover`** — full-page route for recovery flow (file: `apps/web/src/routes/account.recover.tsx`)
- **`MigrationBanner`** — one-time banner on AI Coach card when `localStorage.anthropicKey` exists + `passphrase_set_at` is null

## Frontend — My Account UI (v11.2.0)

### Page: `apps/web/src/routes/dashboard.you.tsx` (rebuilt in place)

Five sections, vertical stack, Sprint 12 design system:

1. Personal — name, DOB, gender, gender_self (conditional), city, country
2. Performance — FTP, weight_kg, HR Max
3. AI Coach — encrypted-key status + Anthropic key surface (consumes credentials hook)
4. Connections — Strava + RWGPS (existing surfaces, restructured)
5. Consent & Data — `EmptyState` placeholder

### Module: `apps/web/src/lib/validation.ts`

```ts
export const PROFILE_LIMITS = {
  name: { max: 80 },
  dob: { minYear: 1900 },
  city: { max: 64 },
  country: { regex: /^[A-Z]{2}$/ },
  ftp: { min: 50, max: 600 },
  weight_kg: { min: 30, max: 200 },
  hr_max: { min: 100, max: 230 },
} as const;

export const PROFILE_GENDERS = ['prefer-not-to-say', 'woman', 'man', 'non-binary', 'self-describe'] as const;
```

Imported by both `routes/dashboard.you.tsx` (client form) and `src/worker.js` (server validation). Drift-prevention via static-scan contract test.

### Component change — `VolumeChart` (#5)

`apps/web/src/components/VolumeChart/VolumeChart.tsx`:
- Each bar renders a `<span>` label showing `<distance>km · <elevation>m` (rounded; native `<title>` element exposes unrounded)
- Mobile + desktop both readable; type scale from existing tokens
- No new component; minor presentational change

## Trust boundary + threat model

- The Cloudflare Worker is the trust boundary; runs Strava OAuth, routes AI calls, persists `user_credentials.ciphertext`.
- Worker has **no decrypt path** — neither the passphrase nor the master key ever cross the network boundary.
- D1 backups + CF support engineer admin access exist; under the chosen design they reveal **ciphertext only** (the master key is passphrase-derived in the browser).
- A compromised Worker (RCE, supply-chain) leaks ciphertexts but not master keys (the master key is client-derived and never present in the Worker isolate). This is the core property option C buys vs option B.
- Anthropic billing-by-key = leaked key = direct $$ damage. The chosen design ensures key plaintext is never persisted server-side; only present in the browser session and in the AI-call request body (proxy-only, not persisted, not logged).

## Test strategy

### New static-scan contract test — `credentials-contract.test.ts` (v11.1.0)

| # | Assertion |
|---|---|
| 1 | `user_credentials` table declared in `schema.sql` (cumulative) and `migrations/0014_user_credentials.sql` |
| 2 | `users.recovery_code_hash` + `users.passphrase_set_at` declared in `schema.sql` and `migrations/0015_user_recovery_meta.sql` |
| 3 | `apps/web/src/lib/credentials.ts` exports the documented signatures |
| 4 | Worker source has zero log lines or response bodies that could leak `ciphertext`, `passphrase`, `master_key`, `api_key` (regex scan) |
| 5 | Worker `/api/me/credentials*` + `/api/me/passphrase/*` handlers all invoke `resolveAthleteId()` before any `db.prepare()` |
| 6 | Worker `/api/me/credentials*` UPDATE/DELETE/SELECT statements all carry `WHERE athlete_id = ?` |
| 7 | `kdf_iterations` default = 600000 in migration; client uses same constant from `lib/credentials.ts` |
| 8 | Credentials helpers contain no `localStorage` writes that would leak the master key |

### New unit tests — `credentials.test.ts` (v11.1.0)

| # | Test |
|---|---|
| 1 | Round-trip: derive → encrypt(aad) → decrypt(aad) → equal plaintext |
| 2 | Wrong passphrase → decrypt throws `OperationError` (AES-GCM auth tag failure) |
| 3 | Wrong AAD → decrypt throws `OperationError` (User A's ciphertext + User B's AAD = no plaintext) |
| 4 | Recovery-code generation: 24 chars, dashed `4-4-4-4-4-4`, alphabet excludes `0/O/1/I/L`, 100 generated codes are all unique |
| 5 | `hashRecoveryCode` is deterministic: same input → same hex |
| 6 | `kdf_iterations` rotation: ciphertext encrypted at 600k decrypts when consumer uses the iteration count from the row |

### Validation-drift contract test (v11.2.0)

Asserts `lib/validation.ts` is imported by both `routes/dashboard.you.tsx` and `src/worker.js`; no inline range constants in either file.

### Extended design-system contract scope (v11.2.0)

The Sprint 12 var-resolution scan extends to include `apps/web/src/routes/dashboard.you.module.css` (the rebuilt page CSS) once the page lands.

### Manual visual smoke (per release)

| Surface | Viewport | Outcome |
|---|---|---|
| **v11.1.0** | | |
| AI Coach card → setup modal | 1280×800 | 3-step flow renders; recovery code download triggers; checkbox gates the encrypt button |
| AI Coach card → unlock | 1280×800 | wrong-passphrase shows inline error; right-passphrase decrypts |
| `/account/recover` | 1280×800 | recovery code accepts / rejects; new passphrase setup completes |
| Migration banner | 1280×800 | shows when `localStorage.anthropicKey` present + `passphrase_set_at` null; dismisses on encryption |
| **v11.2.0** | | |
| `/dashboard/you` | 1280×800 | 5 sections render with proper hierarchy; forms validate inline |
| `/dashboard/you` | 375×812 | mobile parity confirmed |
| VolumeChart | 1280×800 | per-bucket numbers readable; native `<title>` exposes unrounded |
| VolumeChart | 375×812 | numbers readable on narrow viewport |

### Verification per release

```
v11.1.0 release gate (T3 — full ceremony):
  ✓ Architect ADR committed (adr-credentials-substrate.md)
  ✓ credentials-contract.test.ts green
  ✓ credentials.test.ts green
  ✓ tsc --noEmit exit 0
  ✓ build green
  ✓ Phase 5 parity audit (no in-app surface regression)
  ✓ Manual smoke: setup → save → reload → decrypt; recover → ciphertext nuke → re-encrypt
  ✓ README sweep
  ✓ CHANGELOG entry
  ✓ Founder approval gate

v11.2.0 release gate (T2 — lean ceremony):
  ✓ Validation-drift contract test green
  ✓ Extended design-system contract scope green
  ✓ tsc --noEmit exit 0
  ✓ build green
  ✓ Visual smoke at desktop + 375px mobile
  ✓ A11y check: keyboard nav + aria-live error announcements
  ✓ README sweep (Routes table /dashboard/you description; Components table)
  ✓ CHANGELOG entry
  ✓ Founder approval gate
  ✓ GitHub #79 + #80 closed with shipped-in-vX.Y.Z notes
```

## Infra

### Package additions

None required. WebCrypto is native; no third-party crypto deps.

### CSP

Unchanged. No new third-party origins.

### Worker secrets

None added or removed. The credentials substrate is per-user passphrase-derived; no master cipher key in Workers Secrets is needed (which is the architectural property the design buys).

### Observability

- New endpoints log only `{ method, path, athlete_id, status }` — never `ciphertext`, `passphrase`, `master_key`, or `api_key`.
- 4xx error responses include only the validation field name + reason (e.g. `{ field: 'dob', error: 'must be after 1900-01-01' }`) — no echoed values.
- Existing `safeWarn` patterns continue to apply.

## Risk register (mirror of design spec §9 for sprint-folder readers)

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| PBKDF2 600k iterations feel slow on low-end devices | Medium | Low | Setup-modal copy; metric-collect post-ship if complaints |
| User loses passphrase + recovery code | High over time | Medium (lost convenience) | Honest copy; recovery-code download + copy + checkbox-gated; auto-trigger .txt |
| Worker compromise → master key still safe | Low | Low (ciphertext-only leak) | Trust boundary holds even under Worker RCE |
| Schema migration breaks an in-flight user mid-deploy | Low | Medium | Additive-only migration; nullable columns |
| Anthropic key Test button costs accumulate | Low | Low | $0.0001/test; client-side rate-limit 1/10s |
| `/dashboard/you` rebuild regresses an existing flow | Low | Medium | Phase 5 parity audit + 375px mobile smoke |
| Forgotten passphrase leaves dangling ciphertext | Low | Low | Recovery flow nukes ciphertexts cleanly |
| Migration banner missed by an existing localStorage user | Low | Low | Banner persists until acted on; existing localStorage flow keeps working |
