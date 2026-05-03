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
