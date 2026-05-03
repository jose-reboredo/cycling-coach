// apps/web/src/lib/credentials.ts
//
// Sprint 13 / v11.1.0 — passphrase-derived encryption substrate.
//
// PBKDF2-SHA-256 (600k iterations) → AES-GCM with per-row IV + per-call AAD.
// Pure module — no React, no router, no fetch. Safe to import from both
// the browser and the Worker (WebCrypto is identical surface in both).
//
// Trust boundary: passphrase + master key stay in the browser.
// Worker has no decrypt path. See:
//   docs/post-demo-sprint/sprint-13/adr-credentials-substrate.md

const PBKDF2_HASH = 'SHA-256';
const AES_GCM = 'AES-GCM';
const KEY_BITS = 256;
const IV_BYTES = 12;

// Recovery-code alphabet — A-Z 2-9 minus visually ambiguous chars.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Derive a master key from the user's passphrase + per-user salt.
 * Iterations are stored alongside the ciphertext so a rotation
 * doesn't force re-encryption.
 */
export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: PBKDF2_HASH },
    baseKey,
    { name: AES_GCM, length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Build the per-call AAD (Additional Authenticated Data).
 *
 * Binding ciphertext to (athlete_id, provider) prevents replay
 * across users — User A's ciphertext + User B's AAD = OperationError
 * even if a master key were somehow shared.
 */
export function buildAAD(athleteId: number, provider: string): Uint8Array {
  return new TextEncoder().encode(`athlete:${athleteId}|provider:${provider}`);
}

export async function encryptKey(
  masterKey: CryptoKey,
  plaintext: string,
  aad: Uint8Array,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: AES_GCM, iv: iv as BufferSource, additionalData: aad as BufferSource },
    masterKey,
    new TextEncoder().encode(plaintext) as BufferSource,
  );
  return { ciphertext, iv };
}

export async function decryptKey(
  masterKey: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
  aad: Uint8Array,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: AES_GCM, iv: iv as BufferSource, additionalData: aad as BufferSource },
    masterKey,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Generate a 24-char dashed recovery code: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX.
 * Alphabet excludes 0/O/1/I/L for readability.
 */
export function generateRecoveryCode(): string {
  const groups: string[] = [];
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  let group = '';
  for (let i = 0; i < 24; i++) {
    group += ALPHABET[buf[i]! % ALPHABET.length];
    if (group.length === 4) {
      groups.push(group);
      group = '';
    }
  }
  return groups.join('-');
}

/**
 * SHA-256 hex of the recovery code. Server stores only the hash.
 */
export async function hashRecoveryCode(code: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
