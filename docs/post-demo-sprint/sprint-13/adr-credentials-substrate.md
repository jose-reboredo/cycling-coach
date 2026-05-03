# ADR — Credentials substrate (Sprint 13, v11.1.0)

**Status:** Accepted (2026-05-03)
**Decision:** Passphrase-derived AES-GCM encryption with per-user salt + per-row IV + per-call AAD; ciphertext in D1; passphrase + master key stay in the browser. Worker has no decrypt path.

## Options considered

**A. Keep browser-only** (Security Engineer's recommendation in the role consult).
- Pros: zero server-side ciphertext = zero key-theft attack surface via D1 leak; strongest BYOK posture.
- Cons: UX cliff on second device; loses key on storage clear; doesn't scale to a future Pro tier with managed keys.

**B. Hybrid encrypted-in-D1, Workers Secret as master cipher key** (Architect's recommendation).
- Pros: canonical Cloudflare pattern; ~1ms decrypt; trivial schema cost; cross-device sync works.
- Cons: Worker compromise = all keys leaked (master key lives in the Worker isolate); CF support insiders gain a path; key rotation requires re-encrypting all rows.

**C. Passphrase-derived AES-GCM** (Strategy Consultant's recommendation; chosen).
- Pros: cross-device sync works; Worker compromise yields ciphertext-only; multi-provider future is `(athlete_id, provider)` row insert; clean Pro-tier substrate via `managed:1` flag; preserves "your key, your device" voice.
- Cons: forgotten passphrase = unrecoverable ciphertext (mitigated via recovery code); PBKDF2 600k = ~250ms wall-time on setup (acceptable).

## Decision rationale

Option C buys the architectural property of **server-compromise safety** without giving up cross-device sync. The Worker never sees the passphrase or the master key, so a Worker RCE / supply-chain compromise leaks ciphertexts but not plaintext keys. This preserves the BYOK voice in `PRODUCT.md` while unlocking the multi-device + multi-provider + Pro-tier futures Strategy flagged.

## Non-negotiable controls

1. Passphrase never crosses the network boundary (not in request body, logs, or error responses).
2. Master key never leaves the browser session memory; never persisted to localStorage / sessionStorage / IndexedDB.
3. Worker has no decrypt path for `user_credentials.ciphertext`.
4. Per-row 12-byte random IV. Per-user 16-byte random salt (set at first passphrase).
5. AES-GCM `additionalData = utf8("athlete:" + athleteId + "|provider:" + provider)` — bound per call to prevent ciphertext-replay across users.
6. Ciphertext + plaintext banned from log lines and error response bodies (locked by static-scan contract test).
7. Recovery code hashed with SHA-256 server-side. On recover: return salt, clear hash, nuke `user_credentials.ciphertext` rows.

## Consequences

- **Single-master-key + rotation:** since the master key is passphrase-derived, "rotation" of the encryption strength happens via `kdf_iterations` (column default 600000; row stores the value used; future rows can use higher counts). Argon2id migration is a future ADR.
- **Multi-provider:** schema PK `(athlete_id, provider)` supports it. UI surface for adding providers is a future-sprint feature.
- **Pro-tier substrate:** `managed:1` flag = ciphertext NULL, server-side managed key (Anthropic billing relay). Plumbing is a future feature; substrate ships.
- **Recovery cost:** lost passphrase + lost recovery code = user re-enters Anthropic key from scratch. UX copy is honest about the trade.

## Linked roles

- Architect (Opus consult): would have picked B for canonical-CF-pattern reasons; agreed C is acceptable given the threat-model framing.
- Security Engineer (Opus consult): hard-flagged option B; agreed C preserves the BYOK property A would have kept.
- Strategy Consultant (Opus consult): chose C.
- PO (founder): locked C.
