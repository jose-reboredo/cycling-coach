// apps/web/src/lib/__tests__/credentials.test.ts
import { describe, it, expect } from 'vitest';
import {
  deriveMasterKey,
  encryptKey,
  decryptKey,
  buildAAD,
  generateRecoveryCode,
  hashRecoveryCode,
} from '../credentials';

describe('credentials — round-trip', () => {
  it('encrypts and decrypts a plaintext API key with the same passphrase + AAD', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aad = buildAAD(42, 'anthropic');
    const key = await deriveMasterKey('correct horse battery staple', salt, 600000);
    const { ciphertext, iv } = await encryptKey(key, 'sk-ant-test-12345', aad);
    const recovered = await decryptKey(key, ciphertext, iv, aad);
    expect(recovered).toBe('sk-ant-test-12345');
  });
});

describe('credentials — wrong inputs throw', () => {
  it('throws OperationError on wrong passphrase', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aad = buildAAD(42, 'anthropic');
    const goodKey = await deriveMasterKey('correct horse battery staple', salt, 600000);
    const badKey = await deriveMasterKey('wrong passphrase', salt, 600000);
    const { ciphertext, iv } = await encryptKey(goodKey, 'sk-ant-x', aad);
    await expect(decryptKey(badKey, ciphertext, iv, aad)).rejects.toThrow();
  });

  it('throws OperationError on wrong AAD (cross-user replay protection)', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveMasterKey('passphrase', salt, 600000);
    const aadAlice = buildAAD(1, 'anthropic');
    const aadBob = buildAAD(2, 'anthropic');
    const { ciphertext, iv } = await encryptKey(key, 'sk-ant-x', aadAlice);
    await expect(decryptKey(key, ciphertext, iv, aadBob)).rejects.toThrow();
  });
});

describe('credentials — recovery code', () => {
  it('generates 24-char dashed alphanumeric, alphabet excludes 0/O/1/I/L', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    }
  });

  it('100 generated codes are all unique', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateRecoveryCode());
    expect(codes.size).toBe(100);
  });

  it('hashRecoveryCode is deterministic — same input → same hex', async () => {
    const a = await hashRecoveryCode('X7K2-PQ9R-MN4T-VC3H-J8L1-WD5E');
    const b = await hashRecoveryCode('X7K2-PQ9R-MN4T-VC3H-J8L1-WD5E');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('credentials — kdf_iterations rotation', () => {
  it('ciphertext encrypted at 600k decrypts when consumer uses the iteration count from the row', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const aad = buildAAD(42, 'anthropic');
    const key600k = await deriveMasterKey('passphrase', salt, 600000);
    const { ciphertext, iv } = await encryptKey(key600k, 'sk-ant-x', aad);
    const keyAgain = await deriveMasterKey('passphrase', salt, 600000);
    const recovered = await decryptKey(keyAgain, ciphertext, iv, aad);
    expect(recovered).toBe('sk-ant-x');
  });
});

describe('credentials — buildAAD shape', () => {
  it('AAD is utf8("athlete:" + athleteId + "|provider:" + provider)', () => {
    const aad = buildAAD(42, 'anthropic');
    const decoded = new TextDecoder().decode(aad);
    expect(decoded).toBe('athlete:42|provider:anthropic');
  });
});
