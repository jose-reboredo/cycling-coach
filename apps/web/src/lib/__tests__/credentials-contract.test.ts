// apps/web/src/lib/__tests__/credentials-contract.test.ts
//
// Sprint 13 — credentials substrate static-scan contract.
//
// Same pattern as design-system-contract.test.ts (Sprint 12) and
// worker-cache-contract.test.ts (v10.11.3): read source files as text,
// assert structural properties. No browser, no DB, no network.
//
// These tests are the regression-class lock for the substrate that
// option C buys. If any future change weakens the trust boundary, one
// of these assertions fires.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const APPS_WEB = resolve(__dirname, '../../..');
const SRC = resolve(APPS_WEB, 'src');

const SCHEMA_SQL = resolve(REPO_ROOT, 'schema.sql');
const MIG_0014 = resolve(REPO_ROOT, 'migrations/0014_user_credentials.sql');
const MIG_0015 = resolve(REPO_ROOT, 'migrations/0015_user_recovery_meta.sql');
const WORKER_JS = resolve(REPO_ROOT, 'src/worker.js');
const CREDENTIALS_TS = resolve(SRC, 'lib/credentials.ts');

describe('credentials — schema + migration discipline', () => {
  it('user_credentials table declared in migration 0014 + cumulative schema.sql', () => {
    expect(readFileSync(MIG_0014, 'utf8')).toMatch(/CREATE TABLE\s+(IF NOT EXISTS\s+)?user_credentials/i);
    expect(readFileSync(SCHEMA_SQL, 'utf8')).toMatch(/CREATE TABLE\s+user_credentials/i);
  });

  it('users.recovery_code_hash + passphrase_set_at declared in migration 0015 + schema.sql', () => {
    const m = readFileSync(MIG_0015, 'utf8');
    const s = readFileSync(SCHEMA_SQL, 'utf8');
    expect(m).toMatch(/recovery_code_hash/);
    expect(m).toMatch(/passphrase_set_at/);
    expect(s).toMatch(/recovery_code_hash/);
    expect(s).toMatch(/passphrase_set_at/);
  });

  it('user_credentials has the documented composite primary key (athlete_id, provider)', () => {
    expect(readFileSync(MIG_0014, 'utf8'))
      .toMatch(/PRIMARY KEY\s*\(\s*athlete_id\s*,\s*provider\s*\)/i);
  });

  it('user_credentials defaults kdf_iterations to 600000', () => {
    expect(readFileSync(MIG_0014, 'utf8'))
      .toMatch(/kdf_iterations\s+INTEGER\s+NOT NULL\s+DEFAULT\s+600000/i);
  });
});

describe('credentials — module exports', () => {
  it('lib/credentials.ts exports the documented public API', () => {
    const src = readFileSync(CREDENTIALS_TS, 'utf8');
    for (const name of [
      'deriveMasterKey',
      'encryptKey',
      'decryptKey',
      'buildAAD',
      'generateRecoveryCode',
      'hashRecoveryCode',
    ]) {
      expect(src, `lib/credentials.ts must export ${name}`).toMatch(
        new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b`),
      );
    }
  });

  it('encryptKey + decryptKey signatures take an aad parameter (ciphertext-replay protection)', () => {
    const src = readFileSync(CREDENTIALS_TS, 'utf8');
    expect(src).toMatch(/function\s+encryptKey\s*\([\s\S]*?aad\s*:\s*Uint8Array/);
    expect(src).toMatch(/function\s+decryptKey\s*\([\s\S]*?aad\s*:\s*Uint8Array/);
  });
});

describe('credentials — worker trust boundary', () => {
  it('worker /api/me/credentials* + /api/me/passphrase/* handlers all invoke resolveAthleteId before any db.prepare', () => {
    const src = readFileSync(WORKER_JS, 'utf8');
    const paths = [
      "'/api/me/passphrase/setup'",
      "'/api/me/passphrase/recover'",
      "'/api/me/credentials'",
    ];
    for (const p of paths) {
      const idx = src.indexOf(p);
      expect(idx, `${p} not found in worker.js`).toBeGreaterThan(-1);
      const slice = src.slice(idx, idx + 2000);
      const authnIdx = slice.indexOf('resolveAthleteId');
      const prepIdx = slice.indexOf('db.prepare');
      expect(
        authnIdx > -1 && (prepIdx === -1 || authnIdx < prepIdx),
        `${p}: resolveAthleteId must appear before db.prepare`,
      ).toBe(true);
    }
  });

  it('worker user_credentials statements all carry WHERE athlete_id = ?', () => {
    const src = readFileSync(WORKER_JS, 'utf8');
    // INSERT ... ON CONFLICT scopes by the (athlete_id, provider) PK; SELECT/UPDATE/DELETE
    // touching user_credentials must include WHERE athlete_id = ? in the same statement block.
    const blocks = src.match(/(SELECT|UPDATE|DELETE|INSERT)[\s\S]{0,800}?user_credentials[\s\S]{0,800}?(?=`|;|\.run\(|\.all\(|\.first\()/gi) ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const isInsert = /^\s*['"`]?\s*INSERT/i.test(block);
      const hasAthleteScope = /athlete_id\s*=\s*\?/.test(block) || isInsert;
      expect(hasAthleteScope, `unscoped user_credentials block:\n${block.slice(0, 300)}`).toBe(true);
    }
  });

  it('worker has no console.* line that would leak ciphertext / passphrase / master_key / api_key', () => {
    const src = readFileSync(WORKER_JS, 'utf8');
    const sensitive = ['ciphertext', 'passphrase', 'master_key', 'masterKey'];
    for (const name of sensitive) {
      const consoleLeak = new RegExp(`console\\.\\w+\\([^)]*\\b${name}\\b`, 'g');
      const matches = (src.match(consoleLeak) ?? []).filter(
        (m) => !/\/\/|\/\*/.test(m),
      );
      expect(matches, `worker.js leaks ${name} via console: ${matches.join(', ')}`).toEqual([]);
    }
  });
});

describe('credentials — module trust-boundary discipline', () => {
  it('lib/credentials.ts contains no localStorage / sessionStorage / IndexedDB writes (master key never persists)', () => {
    const src = readFileSync(CREDENTIALS_TS, 'utf8');
    expect(src).not.toMatch(/localStorage\.set/);
    expect(src).not.toMatch(/sessionStorage\.set/);
    expect(src).not.toMatch(/indexedDB/i);
  });
});
