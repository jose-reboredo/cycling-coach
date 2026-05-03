# Sprint 13 — Business Requirements

## Wedge

Sprint 13 delivers two real user-value items and one strategic substrate, all in service of the project's **privacy-first, BYOK, your-key-your-device** positioning:

1. **Profile is a stub.** Today's `/dashboard/you` collapses Strava connection + AI key + RWGPS status + a tiny FTP/weight/HR Max card into a flat stack. There's no place for a name, DOB, gender, location, or a consent surface. Users can't credibly *own* their account view.
2. **The static `8,000 km / X` goal bar lies.** It's an arbitrary number that doesn't reflect the user's actual pace. (#49 forecast is the targeted fix; deferred.) Sprint 13's smaller honesty fix: **#5 — show distance + elevation per bucket on the Volume chart** so users can read what's actually there without hovering.
3. **The current Anthropic-key storage is browser-only localStorage.** Each new device re-enters; no cross-device sync. Issue #52 proposed "stored encrypted at rest" but the issue itself flagged the architectural conflict. Strategy's recommendation (passphrase-derived AES-GCM) **defends the BYOK ethos** while unlocking multi-device + multi-provider + Pro-tier-substrate futures.

## Hypothesis

A credible My Account page (Personal · Performance · AI Coach · Connections · Consent placeholder) + an honest Volume chart + a properly-encrypted credentials substrate move the perceived ownership of the product from "AI tool with a profile screen" to **"my training brain"**. The credentials substrate buys cross-device sync without compromising "your key, your device" because the passphrase never leaves the device — Worker compromise yields ciphertext, not keys.

## Scope

### In scope (Sprint 13, two releases)

**v11.1.0 — Credentials substrate**
- Schema migrations 0014 (`user_credentials` table) + 0015 (`users.recovery_code_hash` + `passphrase_set_at`)
- Client encryption module `apps/web/src/lib/credentials.ts` (PBKDF2-SHA-256 600k → AES-GCM)
- Worker endpoints: `/api/me/passphrase/setup`, `/api/me/passphrase/recover`, `GET/PATCH/DELETE /api/me/credentials*`
- Setup modal (3 steps: passphrase → recovery code → confirmation)
- Recovery flow at `/account/recover` (client-side route + worker endpoint)
- Daily-use unlock prompt on AI Coach card (per-session passphrase entry; master key in React state, never persisted)
- One-time "Move existing localStorage key to encrypted storage" banner
- Static-scan contract test suite (8 invariants)
- Unit test suite (5 round-trip + edge-case tests)
- Architect ADR: `docs/post-demo-sprint/sprint-13/adr-credentials-substrate.md`

**v11.2.0 — My Account UI + #5 + housekeeping**
- Schema migration 0016 (`users` profile fields: `name, dob, gender, gender_self, city, country`)
- Worker endpoints: `GET/PATCH /api/me/profile`
- `/dashboard/you` rebuilt as 5-section My Account page (consumes Sprint 12 design system kit)
- Shared `apps/web/src/lib/validation.ts` for client + server validation constants
- Anthropic-key card with masked input + Save + Test (live `/v1/messages` 1-token ping)
- VolumeChart per-bucket distance + elevation labels (visible always; native `<title>` for unrounded value)
- Validation-drift contract test
- Extended design-system contract scope (`/dashboard/you` covered by var-resolution scan)
- README sweep
- Close GitHub #79 + #80 with shipped-in-vX.Y.Z notes

### Out of scope (deferred)

| Item | Where it goes |
|---|---|
| #49 AI year-end forecast | Future focused sprint with proper AI integration scoping |
| #56 Club Share & Invite Flow | Sprint 14+ (medium feature, not P1) |
| `managed: 1` Pro-tier server-side managed-key plumbing | Future feature; substrate ships, billing relay deferred |
| Multi-provider UI (add OpenAI / Llama / etc.) | Future feature; PK supports it |
| Data export + account deletion + consent toggles | Focused privacy sprint |
| In-app surface migration to Layer 2 tokens | Sprint 14+ |
| Argon2id rotation | Backlog (rotation-friendly via `kdf_iterations`) |
| Self-hosted fonts, Phosphor icons, form-field rebuilds | Sprint 14+ |

## Acceptance criteria

### v11.1.0 — Credentials substrate

#### AC-1.1.1 — Schema migration 0014 applied
- `user_credentials(athlete_id, provider, managed, ciphertext, iv, kdf_salt, kdf_iterations, created_at, updated_at)` exists
- Composite PK `(athlete_id, provider)`
- FK `athlete_id` → `users(athlete_id) ON DELETE CASCADE`
- Index `idx_user_credentials_athlete`
- Default `kdf_iterations = 600000`
- Cumulative `schema.sql` reflects the new table

#### AC-1.1.2 — Schema migration 0015 applied
- `users.recovery_code_hash TEXT` (nullable)
- `users.passphrase_set_at INTEGER` (nullable)

#### AC-1.1.3 — Client encryption module
- `apps/web/src/lib/credentials.ts` exports `deriveMasterKey, encryptKey, decryptKey, buildAAD, generateRecoveryCode, hashRecoveryCode` with documented signatures
- All operations use WebCrypto (no third-party crypto deps)
- AES-GCM `additionalData` is bound per call (`utf8("athlete:" + athleteId + "|provider:" + provider)`); decrypt with wrong AAD throws `OperationError`
- Recovery code is 24-char dashed `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`, alphabet excludes `0/O/1/I/L`
- 100 generated codes are all unique

#### AC-1.1.4 — Worker endpoints
- All endpoints invoke `resolveAthleteId()` before any `db.prepare()`
- All UPDATE/DELETE/SELECT statements scope by `WHERE athlete_id = ?`
- `POST /api/me/passphrase/setup` writes `users.recovery_code_hash` + `passphrase_set_at`
- `GET /api/me/credentials` returns `[{ provider, ciphertext, iv, kdf_salt, kdf_iterations, updated_at }]`; `managed=1` rows return `ciphertext: null`
- `PATCH /api/me/credentials` upserts one row keyed by `(athlete_id, provider)`
- `DELETE /api/me/credentials/:provider` removes one row
- `POST /api/me/passphrase/recover` matches incoming hash to `users.recovery_code_hash`; on match, returns `kdf_salt`, clears `recovery_code_hash`, nukes all `user_credentials.ciphertext` for the athlete
- No log line or response body exposes `passphrase`, `master_key`, `ciphertext`, or plaintext `api_key` (statically asserted)

#### AC-1.1.5 — Setup modal
- Trigger: first attempt to save an Anthropic key when `passphrase_set_at` is null
- Step 1: passphrase + confirm (must match) → `[Continue]`
- Step 2: 24-char recovery code rendered + `[Download as .txt]` (auto-trigger) + `[Copy to clipboard]` + checkbox-gated `[Encrypt my key]`
- Step 3: confirmation screen + `[Back to AI Coach]`
- Voice: sentence-case headlines; honest about the trade ("Forget the passphrase, lose the key"); no apology copy

#### AC-1.1.6 — Daily-use unlock
- Inline card on AI Coach section prompts for passphrase per browser session
- On success: master key held in React state for the session; never persisted
- On wrong passphrase: inline error "That passphrase doesn't match. Try again or use your recovery code."
- Plaintext Anthropic key never written to localStorage

#### AC-1.1.7 — Recovery flow at `/account/recover`
- Inputs: recovery code (with masked-or-plain toggle)
- On submit: server hashes + matches; on success returns `kdf_salt`, clears hash, nukes `user_credentials.ciphertext`
- Client prompts new passphrase; new recovery code generated; user redirected to AI Coach with "No keys stored — re-enter your Anthropic key" message

#### AC-1.1.8 — Migration banner for existing localStorage users
- Banner appears on AI Coach card if `localStorage.anthropicKey` exists AND `passphrase_set_at` is null
- `[Set up encryption]` button triggers the setup modal
- After setup completes, `localStorage.anthropicKey` is cleared

#### AC-1.1.9 — Tests pass
- `credentials-contract.test.ts` (8 assertions) green
- `credentials.test.ts` (5+ unit tests) green
- Existing 258-test suite unchanged

### v11.2.0 — My Account UI + #5 + housekeeping

#### AC-1.2.1 — Schema migration 0016 applied
- `users.name TEXT` (nullable, max 80 chars enforced server-side)
- `users.dob INTEGER` (nullable, ≥ 1900-01-01, ≤ today)
- `users.gender TEXT` (nullable)
- `users.gender_self TEXT` (nullable; only set when `gender = 'self-describe'`)
- `users.city TEXT` (nullable, max 64 chars)
- `users.country TEXT` (nullable, regex `^[A-Z]{2}$`)

#### AC-1.2.2 — Worker endpoints
- `GET /api/me/profile` returns `{ name, dob, gender, gender_self, city, country, ftp, weight_kg, hr_max, passphrase_set_at }`
- `PATCH /api/me/profile` validates server-side using constants from `lib/validation.ts`; returns 400 with field-level error on invalid input
- Both gated by `resolveAthleteId()` and scoped by `WHERE athlete_id = ?`

#### AC-1.2.3 — `/dashboard/you` rebuilt
- 5 sections (Personal · Performance · AI Coach · Connections · Consent placeholder)
- Each section uses Sprint 12 design-system kit (`Card`, `Eyebrow`, `Button`, `EmptyState`)
- All form fields have inline error messages on validation failure
- Save / Discard pattern per editable section
- Required fields marked `*` with `* Required` legend (per `feedback_release-ceremony.md` voice consistency)
- Mobile (375px) keeps full functionality + readability

#### AC-1.2.4 — Anthropic-key card on the AI Coach section
- Status line: "encrypted on this device · YYYY-MM-DD" (when key set) or "no key stored" (when not)
- `[Set passphrase]` button visible when `passphrase_set_at` is null
- Masked input + `[Save]` + `[Test]` buttons
- `[Test]` hits real `/v1/messages` with `max_tokens: 1, model: claude-haiku-4-5-20251001`; rate-limited client-side to 1 test per 10s
- `[Forgot passphrase?]` link → `/account/recover`
- `[Remove key]` button → `DELETE /api/me/credentials/anthropic` (destructive variant)

#### AC-1.2.5 — Consent & Data placeholder
- `EmptyState` component
- Headline: "Coming soon"
- Body: "Export your data, delete your account, manage consent settings here."
- No CTA in this release

#### AC-1.2.6 — VolumeChart per-bucket numbers (#5)
- Each weekly/monthly bar renders a label showing `<distance>km · <elevation>m`
- Visible always (not hover-gated)
- Mobile + desktop both readable
- Hover (mouse) / focus (keyboard) reveals unrounded value via native HTML `<title>`
- No JS tooltip lib added

#### AC-1.2.7 — Validation drift lock
- `lib/validation.ts` constants used by both client form (`/dashboard/you` rebuild) and server (`PATCH /api/me/profile`)
- Static-scan contract test asserts both files import from the shared module

#### AC-1.2.8 — Extended design-system contract test scope
- Var-resolution scan covers the new `/dashboard/you` page CSS
- No hex literals introduced in the rebuild

#### AC-1.2.9 — Housekeeping
- GitHub #79 closed with comment "Shipped in v9.12.2 — duration_minutes, mandatory * + legend, personal-session edit/cancel, visual differentiation, BottomNav 5-slot fix all confirmed in code 2026-05-03 during Sprint 13 brainstorming."
- GitHub #80 closed with comment "Shipped in v10.12.0 — px-based positioning + overlap-aware columns confirmed in WeekCalendarGrid.tsx + DayCalendarGrid.tsx 2026-05-03 during Sprint 13 brainstorming."

#### AC-1.2.10 — Tests pass
- Validation-drift contract test green
- Extended design-system contract scope green
- Existing test suite green
- `tsc --noEmit` exit 0
- `npm run build` green

## User stories

### As a solo rider, I want to own my account view so the app feels mine

I sign in. I go to YOU. I see Personal (name, DOB, gender, where I ride from), Performance (FTP, weight, HR Max), AI Coach (my Anthropic key, encrypted on this device), Connections (Strava, RWGPS), and Consent & Data (placeholder, but I see it's coming). I update my name, save, see "Saved." inline. The product is mine.

### As a multi-device rider, I want my Anthropic key to be portable without losing privacy

I set up my passphrase on my laptop, save my recovery code to my password manager. I open the app on my phone, enter the same passphrase, my key is right there. I never had to re-enter the key itself. The Cloudflare Worker never saw my passphrase or my master key. If a Worker breach happened tomorrow, my Anthropic key is still safe — only ciphertext leaks.

### As a privacy-conscious user, I want to know what's actually stored where

The setup modal tells me: "Your passphrase encrypts your key on your device. We never see it. Forget the passphrase, lose the key." That's the trade. I'm informed. Consent.

### As a chart user, I want to read the chart, not hover-discover

I open Volume chart. I see `40km · 800m` under each weekly bar. I don't have to hover to know. If I want the exact unrounded number, I hover and the browser tooltip shows me.

### As an existing user with a key in localStorage, I want a smooth migration

I open the AI Coach card. There's a banner: "Move your Anthropic key to encrypted storage." I click. The setup modal walks me through. After I'm done, the localStorage entry is cleared and my key is encrypted in D1. Nothing about my AI flow changes.
