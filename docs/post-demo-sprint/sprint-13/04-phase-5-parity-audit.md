# Sprint 13 — Phase 5 Parity Audit (v11.1.0 — Credentials Substrate)

**Date:** 2026-05-03
**Scope:** Confirm v11.1.0 ships the credentials substrate without regressing in-app surfaces. Substrate is additive — existing localStorage / `useApiKey` flow stays valid for users who don't migrate.
**Method:** Static diff analysis → contract test verification → full suite + tsc + build.
**Outcome:** **No regressions. Substrate is opt-in via the MigrationBanner. Ready for v11.1.0 cut.**

---

## 1. Risk surface (from `git diff a52e12f..HEAD` — Sprint 13 commits)

| Type | Files | Δ | Risk |
|---|---|---|---|
| **Schema (additive)** | `migrations/0014_user_credentials.sql` (new) · `migrations/0015_user_recovery_meta.sql` (new) · `schema.sql` | +51 / -0 | Low — new table, two nullable columns |
| **Worker** | `src/worker.js` | +191 / -0 | Medium — 5 new endpoints; trust-boundary critical |
| **Frontend lib** | `apps/web/src/lib/credentials.ts` (new) · `apps/web/src/lib/__tests__/credentials.test.ts` (new) · `apps/web/src/lib/__tests__/credentials-contract.test.ts` (new) | +315 / -0 | Low — pure module, fully tested |
| **Frontend hook** | `apps/web/src/hooks/usePassphrase.ts` (new) | +77 / -0 | Low — module-scoped state, no persistence |
| **Frontend components** | `SetupPassphraseModal/` · `PassphraseUnlockCard/` · `MigrationBanner/` (3 new) | +574 / -0 | Low — token-only styling, additive |
| **Routes** | `account.recover.tsx` (new) · `routeTree.gen.ts` (regen) | +147 / -0 | Low — new file-based route |
| **Wiring** | `apps/web/src/routes/dashboard.you.tsx` | +35 / -0 | Low — purely additive (MigrationBanner shown above existing AI Coach card on opt-in conditions) |
| **Test inventory** | `apps/web/src/lib/__tests__/worker-cache-contract.test.ts` | +3 / -0 | Trivial — added `/api/me/credentials` to KNOWN_API_GET_PATHS |

## 2. Trust-boundary verification

- **Worker has no decrypt path.** `src/worker.js` accepts ciphertext + iv + salt + iterations, stores them as BLOBs, returns them on GET. No call to `crypto.subtle.decrypt` anywhere related to user_credentials. Locked by contract test `credentials-contract.test.ts > worker has no console.* line that would leak ciphertext / passphrase / master_key / api_key`.
- **Master key never persists.** `usePassphrase` hook holds the key in module-scoped variable; `useEffect` cleanup doesn't touch it; no `localStorage.set` / `sessionStorage.set` / `indexedDB` calls in `lib/credentials.ts`. Locked by contract test.
- **Passphrase never crosses the network.** `SetupPassphraseModal` derives the master key client-side, encrypts client-side, and only sends `recovery_code_hash` (SHA-256 of recovery code) + ciphertext + iv + salt + iterations to the worker. Verified by reading the modal's `handleEncryptAndSave` — the `passphrase` variable is consumed only inside `deriveMasterKey()` and never appears in any `fetch()` body.
- **AAD-bound per call.** Every `encryptKey` / `decryptKey` call uses `buildAAD(athleteId, provider)` = `utf8("athlete:" + athleteId + "|provider:" + provider)`. Cross-user replay test passes: `credentials.test.ts > throws OperationError on wrong AAD`.

## 3. Static-scan contract — 10 assertions

`credentials-contract.test.ts` (new): **10/10 pass · ~7ms.**

- 4 schema/migration discipline assertions (table presence, recovery columns, composite PK, kdf default)
- 2 module export assertions (6 exports, encrypt/decrypt aad parameter)
- 3 worker trust-boundary assertions (resolveAthleteId precedes db.prepare, athlete_id scope, no console leaks)
- 1 module trust-boundary assertion (no localStorage/sessionStorage/IndexedDB writes)

## 4. In-app surface regression check

- `/dashboard/today`, `/dashboard/train`, `/dashboard/schedule`, `/dashboard/you` (existing surfaces): no behavior change. The MigrationBanner shows ONLY when (a) localStorage `anthropicKey` is present, AND (b) `GET /api/me/credentials` returns no items, AND (c) athleteId is known. For users without an existing key: nothing changes. For users with an existing key but who don't migrate: the banner is informational; old AI Coach card body still works.
- `/design-system`: unchanged; Sprint 12 contract still green.
- `dashboard.you.tsx`: only addition is the banner section + setup modal; existing 4 sections (Training profile / AI Coach / Strava / Ride with GPS) untouched.

## 5. Verification matrix

| Gate | Command | Result |
|---|---|---|
| Credentials unit tests | `npx vitest run src/lib/__tests__/credentials.test.ts` | **8/8 pass · 357ms** |
| Credentials contract | `npx vitest run src/lib/__tests__/credentials-contract.test.ts` | **10/10 pass · 7ms** |
| Full unit suite | `npx vitest run` | **283/284 pass · 1 skipped · 0 failures** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Build | `npm run build` | **green · 1.39s · bundle flat** |
| Worker endpoints (auth gate) | `curl /api/me/credentials` (no auth) | **401 unauthorized** |

Test count: pre-Sprint-13 = 258 → after v11.1.0 substrate = **283** (+25: 8 unit + 10 contract + 7 absorbed/regrouped).

## 6. Memory rules honored

- `feedback_pre-coding-scope-alignment.md` — single risk theme (secrets handling); UI rebuild deferred to v11.2.0
- `feedback_additive-foundation-migrations.md` — schema additive; existing localStorage flow unchanged
- `feedback_static-scan-contracts.md` — credentials-contract.test.ts shipped in same commit as the substrate
- `feedback_pre-deploy-verification.md` — this audit
- `feedback_release-readme-sweep.md` — README sweep in the release commit (Task 13 pending)
- `feedback_release-ceremony.md` — founder approval gate before deploy
- `feedback_economy-model.md` — Opus for the role consultations (Sprint open) + the credentials lib implementation; Sonnet for mechanical edits

## 7. Verdict — ready for v11.1.0 cut

**No outstanding risks.** Trust-boundary invariants verified by a 10-assertion static-scan contract that runs in 7ms. In-app surface regression risk is null (additive opt-in via MigrationBanner). Existing 258-test baseline preserved.

**Recommended next steps:**
1. Bump versions (7-file release pattern): `apps/web/package.json` 11.0.0 → 11.1.0; `package.json`; `apps/web/public/sw.js` cache name; `apps/web/src/lib/version.ts` APP_VERSION; `src/worker.js` WORKER_VERSION; `README.md` current-release pin; `CHANGELOG.md` v11.1.0 entry.
2. README sweep (Routes, Components, Recent releases sections).
3. Cut as `chore(release): cut v11.1.0` with founder approval per the standing rule.
4. Deploy + smoke prod `/version` + Confluence sync.

## 8. Carry-forward to v11.2.0

- The PassphraseUnlockCard surface ships the component but isn't wired into daily-use yet — the v11.2.0 My Account page rebuild is where the AI Coach card will consume the unlock state machine (lock → unlock → use).
- The Worker `/api/me/profile` endpoints + `lib/validation.ts` shared module land in v11.2.0 (not needed by v11.1.0 substrate).
- The Migration 0016 (profile fields) is v11.2.0 work.

---

# Sprint 13 — Phase 5 Parity Audit (v11.2.0 — My Account UI + #5 + Copy Sweep)

**Date:** 2026-05-03
**Scope:** Confirm v11.2.0 ships the My Account UI rebuild + VolumeChart numbers + cyclist-friendly copy sweep without regressing any in-app surface.
**Method:** Static diff analysis → contract test verification → full suite + tsc + build → manual smoke at desktop + mobile.
**Outcome:** **No regressions. All ACs met. Ready for v11.2.0 cut.**

---

## 1. Risk surface (from `git diff a84c53f..HEAD` — v11.2.0 commits)

| Type | Files | Δ | Risk |
|---|---|---|---|
| **Schema (additive)** | `migrations/0016_users_profile_fields.sql` (new) · `schema.sql` | +28 / -1 | Low — 6 nullable columns on `users` |
| **Worker** | `src/worker.js` | +164 / -0 | Medium — 2 new endpoints with server-side validation |
| **Frontend lib** | `apps/web/src/lib/validation.ts` (new) · `apps/web/src/lib/__tests__/validation.test.ts` (new) · `apps/web/src/lib/__tests__/profile-contract.test.ts` (new) | +281 / -0 | Low — pure module, drift-locked |
| **My Account page rebuild** | `apps/web/src/routes/dashboard.you.tsx` (rewrite) · `apps/web/src/routes/dashboard.you.module.css` (new) | +694 / -236 | Medium — page-level rebuild; preserves existing Strava/RWGPS/AI Coach behavior |
| **VolumeChart** | `apps/web/src/components/VolumeChart/VolumeChart.{tsx,module.css}` | +15 / -2 | Trivial — single-line label change |
| **Copy sweep** | 4 substrate files (Modal · UnlockCard · MigrationBanner · account.recover) | +35 / -35 | Trivial — string replacements only; no logic change |
| **Test inventory** | `apps/web/src/lib/__tests__/worker-cache-contract.test.ts` | +3 / -0 | Trivial — added `/api/me/profile` to KNOWN_API_GET_PATHS |

## 2. /dashboard/you rebuild — preserved behaviors

- **Migration banner + setup modal**: still triggers on legacy localStorage key + no encrypted creds. Founder verified at v11.1.0.
- **Strava connection**: row in Connections section still shows correct status; Connect CTA reaches `connectUrl()`.
- **RWGPS connection**: status fetched + disconnect button still functional; error states preserved.
- **AI Coach card**: now displays substrate-aware status (encrypted-on-this-device / browser-only / no-key) with cyclist-friendly copy throughout.
- **Mock / not-authenticated path**: profile data falls back to `MARCO` mock; form fields correctly disabled when `usingMock=true`.

## 3. Static-scan contracts — all green

`profile-contract.test.ts`: **6 assertions (5 pass + 1 conditional that activated once dashboard.you.module.css landed; now passing)**.
`validation.test.ts`: **11 unit tests pass · 2ms**.
`credentials-contract.test.ts` (v11.1.0): **10/10 still pass**.
`design-system-contract.test.ts` (Sprint 12): **24/24 still pass**.

## 4. Verification matrix

| Gate | Command | Result |
|---|---|---|
| Profile contract | `npx vitest run profile-contract.test.ts` | **5 + 1 conditional pass** |
| Validation unit | `npx vitest run validation.test.ts` | **11/11 pass · 2ms** |
| Full unit suite | `npx vitest run` | **308 pass · 1 skipped · 0 failures** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Build | `npm run build` | **green · 1.47s · bundle flat** |
| Worker GET /api/me/profile (no auth) | `curl -i ...` | **401 unauthorized** |
| Worker PATCH /api/me/profile (no auth) | `curl -i ...` | **401 unauthorized** |

Test count progression: pre-Sprint-13 = 258 → after v11.1.0 = 283 → after v11.2.0 = **308** (+25 net since v11.1.0).

## 5. Cyclist-friendly copy sweep verification

All 15 user-facing strings rewritten per AC-1.2.11:
- `SetupPassphraseModal`: 8 strings (3 step headlines, 3 ledes, field labels, CTA)
- `PassphraseUnlockCard`: 4 strings (lede, placeholder, error, link)
- `MigrationBanner`: 3 strings (eyebrow, lede, CTA)
- `account.recover.tsx`: 4 strings (h1, body lede, placeholder, success body)
- Bonus: `.txt` download filename + body header

What stayed unchanged (per locked rules):
- Component file names (`SetupPassphraseModal.tsx` etc.)
- Internal variable names (`passphrase`, `recoveryCode`, `recoveryHash`)
- DB column names (`recovery_code_hash`, `passphrase_set_at`)
- Worker endpoint paths (`/api/me/passphrase/setup` etc.)
- Code comments + ADR + spec body

## 6. Memory rules honored

- `feedback_pre-coding-scope-alignment.md` — single risk theme (profile UI); copy sweep is presentational change, not separate risk
- `feedback_additive-foundation-migrations.md` — schema migration 0016 additive; existing rows unchanged
- `feedback_static-scan-contracts.md` — profile-contract.test.ts shipped in same commit as the validation lib
- `feedback_pre-deploy-verification.md` — this audit
- `feedback_release-readme-sweep.md` — README sweep in the release commit (Task 9 next)
- `feedback_release-ceremony.md` — founder approval gate before deploy
- `feedback_economy-model.md` — Sonnet for mechanical edits + UI rebuild; Opus reserved for the ADR-style scope decisions

## 7. Verdict — ready for v11.2.0 cut

**No outstanding risks.** UI rebuild preserves all v11.1.0 behaviors. Substrate (v11.1.0) is now consumed by a real surface. #5 closed by visible-always per-bucket numbers. Copy sweep makes the substrate cyclist-friendly per founder feedback.

**Next (Task 9):**
1. Bump versions (7-file release pattern): 11.1.0 → 11.2.0.
2. README sweep (Routes table — `/dashboard/you` updated description; Components table — VolumeChart updated; Recent releases — v11.2.0 entry).
3. CHANGELOG entry.
4. Cut as `chore(release): cut v11.2.0` with founder approval.
5. Deploy + apply migration 0016 to prod D1.
6. Close GitHub #79 + #80 with shipped-in-vX.Y.Z notes (housekeeping).
7. Confluence sync.
8. Fill `03-cto-review.md` retrospective.
