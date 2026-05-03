# Sprint 13 — User-Value Bundle (My Account + Credentials Substrate + Volume Chart)

**Status:** In flight (sprint open 2026-05-03)
**Dates:** 2026-05-03 → 2026-05-04 (2-day shape)
**Version target:** **v11.1.0** (credentials substrate) + **v11.2.0** (My Account + #5 + housekeeping)
**Persona focus:** Solo riders + small clubs — privacy-first ownership of profile + credentials
**Phase shape:** Sprint cycle (steady-state Track B) — scope → tier → plan → build → deploy → test, twice
**Headline outcome (target):** Users own a coherent My Account page (Personal · Performance · AI Coach · Connections · Consent placeholder); their Anthropic key is encrypted with a passphrase that never leaves the device; the Volume chart is honest about distance + elevation per bucket; two stale-but-shipped issues closed.

## Why this sprint exists

Two real user-value gaps the backlog flagged: profile is a stub (no name / DOB / gender / location / consent surface), and the static `8,000 km / X` goal bar lies. Sprint 13 addresses the profile gap (#52) plus a small chart honesty fix (#5), and uses the security-sensitive AI-key handling work as the substrate for a multi-device + multi-provider + Pro-tier-substrate future per the Strategy consultation.

A second strategic gain: this is the **first in-app surface** to consume the v11.0.0 design system end-to-end — early signal for the Sprint 14+ in-app token migration.

## Themes

| Theme | Plugin / role | Effort | Release |
|---|---|---|---|
| Credentials substrate — passphrase-derived AES-GCM, multi-provider table | Architect (Opus) + Security Engineer (Opus) + Tech Lead (Sonnet) | ~6h | v11.1.0 |
| Setup modal + recovery-code UX + recovery flow | Tech Lead (Sonnet) + XD (Sonnet) | ~3h | v11.1.0 |
| Schema migrations 0014 + 0015 (additive) | Architect (Opus) + Tech Lead (Sonnet) | ~1h | v11.1.0 |
| Worker endpoints — `/api/me/credentials*`, `/api/me/passphrase/*`, `/api/me/profile` | Tech Lead (Sonnet) + Security Engineer (Opus consult) | ~1.5h | both |
| Static-scan contract tests — credentials + authz/authn + drift locks | QE (Sonnet) | ~2h | v11.1.0 |
| Phase 5 parity audit per release | Tech Lead (Sonnet) | ~1.5h | both |
| `/dashboard/you` rebuild — 5-section IA, validation, design-system kit | XD (Sonnet) + Tech Lead (Sonnet) + A11y Consultant (Sonnet) | ~4h | v11.2.0 |
| Schema migration 0016 — profile fields | Tech Lead (Sonnet) | ~0.5h | v11.2.0 |
| #5 VolumeChart per-bucket numbers | Tech Lead (Sonnet) | ~2h | v11.2.0 |
| **Cyclist-friendly copy sweep — "passphrase" → "password" across all v11.1.0 substrate surfaces** | XD (Sonnet) | ~1h | v11.2.0 |
| Housekeeping — close GH #79 + #80 with shipped-in-vX.Y.Z notes | Tech Lead (Sonnet) | ~0.5h | v11.2.0 |

**Total budget:** ~23h across 2 days. (Within tolerance for the 2-release shape; per memory rule, ≤ 1 risk theme per release keeps scope honest.)

## Releases planned

| Version | Stage | Risk theme | Note |
|---|---|---|---|
| v11.1.0 | Day 1 | Secrets handling | Credentials substrate; no user-visible UI changes (substrate, not consumer) |
| v11.2.0 | Day 2 | Profile UI | My Account page consumes substrate; #5 VolumeChart numbers; close stale GH issues |

## Out of scope (deferred)

- **#49 AI year-end forecast** — moved to a focused later sprint (needs proper AI integration scoping)
- **#56 Club Share & Invite Flow** — Sprint 14+ candidate (not P1)
- **`managed: 1` Pro-tier flow** — substrate ships; server-side managed-key plumbing (Anthropic billing relay, Stripe webhook) is a future feature
- **Multi-provider UI** — schema PK supports it; the surface for adding OpenAI / Llama is future-sprint
- **Data export + account deletion + consent toggles** — Consent & Data section ships as honest placeholder; implementation is a focused privacy sprint
- **In-app surface migration to Layer 2 tokens** — Sprint 14+ charge; Sprint 13's `/dashboard/you` rebuild is the first signal but not the migration
- **Argon2id rotation** — backlog item; `kdf_iterations` column allows future rotation cleanly
- **Self-hosted fonts + Phosphor migration + form fields** — backlog (carry-over from Sprint 12)

## Decisions locked at sprint open (2026-05-03)

| # | Decision | Rationale |
|---|---|---|
| 1 | Two releases (v11.1.0 substrate + v11.2.0 UI), not one bundled cut | Per `feedback_pre-coding-scope-alignment.md`: each release ≤ 1 risk theme |
| 2 | Anthropic-key storage = passphrase-derived AES-GCM (Strategy's option C) | Strategy: unlocks multi-device + multi-provider + Pro-tier substrate without breaking BYOK ethos. Worker compromise yields ciphertext, not keys |
| 3 | KDF = PBKDF2-SHA-256, 600k iterations | WebCrypto-native; no WASM dep; NIST SP 800-132 (2023). `kdf_iterations` column allows future Argon2id rotation |
| 4 | Recovery code = 6×4 alphanumeric dashed | No 2KB wordlist bundle; compact; phone-typeable |
| 5 | Setup modal trigger = first save of an Anthropic key | Contextual — modal fires when encryption is needed |
| 6 | My Account page replaces `/dashboard/you` (no new route) | Per the issue title: "Expand Edit Profile". Preserves BottomNav 5-slot anchor |
| 7 | "Test key" button hits real `/v1/messages` ping | Cost ~$0.0001/test; validates live key + balance + rate limits; no new attack surface |
| 8 | Consent & Data section ships as **honest placeholder**, not implemented | Per `PRODUCT.md` empty-state voice rule |
| 9 | Recovery flow nukes ciphertexts (old master key gone with passphrase) | Old ciphertext is unrecoverable garbage under the new master key — clearer to clear |
| 10 | **User-facing copy uses "password", not "passphrase"** (added 2026-05-03 post-v11.1.0 ship per founder feedback) | Cyclists are the audience, not developers. "Password" is the universal mental model. Internal docs / dev names stay "passphrase" (cryptographically correct). The lock/unlock metaphor extends consistently: encrypt → "lock"; decrypt → "unlock"; recovery code → unchanged (already non-tech). |

## Memory rules referenced this sprint

- `feedback_pre-coding-scope-alignment.md` — two releases, ≤ 1 risk theme each
- `feedback_additive-foundation-migrations.md` — schema migrations are additive; existing localStorage flow stays valid until passphrase setup completes
- `feedback_static-scan-contracts.md` — new credentials-contract test suite extends the pattern from worker-cache / authn / authz contracts
- `feedback_pre-deploy-verification.md` — Phase 5 parity audit before each release
- `feedback_release-readme-sweep.md` — README sweep in each release commit
- `feedback_release-ceremony.md` — founder approval gates respected per release
- `feedback_economy-model.md` — Opus for role consultations + judgment; Sonnet for mechanical edits
- `feedback_sprint-documentation-mandatory.md` — this 4-doc shape

## Documents in this folder

| File | Role |
|---|---|
| `00-sprint-summary.md` | This document |
| `01-business-requirements.md` | Wedge / hypothesis / scope / acceptance criteria |
| `02-architecture-changes.md` | Schema, endpoints, encryption flow, contract tests, smoke ladder |
| `03-cto-review.md` | Sprint retrospective (filled at sprint close) |
| `04-phase-5-parity-audit.md` | Per-release pre-deploy parity audits (added at each release) |

## Linked artefacts

| Artefact | Location | Owner |
|---|---|---|
| Brainstorming spec (full design) | [`docs/superpowers/specs/2026-05-03-sprint-13-design.md`](../../../docs/superpowers/specs/2026-05-03-sprint-13-design.md) | Brainstorm output |
| Architect ADR — credentials substrate | `docs/post-demo-sprint/sprint-13/adr-credentials-substrate.md` (added in v11.1.0 commit) | Architect |
| Source-of-truth — `lib/credentials.ts` | `apps/web/src/lib/credentials.ts` | Tech Lead |
| Source-of-truth — `lib/validation.ts` | `apps/web/src/lib/validation.ts` | Tech Lead |
| Contract test — credentials | `apps/web/src/lib/__tests__/credentials-contract.test.ts` | QE |
| Unit test — credentials helpers | `apps/web/src/lib/__tests__/credentials.test.ts` | QE |
| Schema migrations | `migrations/0014_user_credentials.sql`, `migrations/0015_user_recovery_meta.sql`, `migrations/0016_users_profile_fields.sql` | Tech Lead |
