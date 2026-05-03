// apps/web/src/lib/__tests__/profile-contract.test.ts
//
// Sprint 13 / v11.2.0 — profile-shape contract.
//
// Locks: schema migration shape, validation-constant drift between
// the client (lib/validation.ts) and server (src/worker.js inlined
// values), and the profile-endpoint authn/authz pattern.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const APPS_WEB = resolve(__dirname, '../../..');
const SRC = resolve(APPS_WEB, 'src');

const SCHEMA_SQL = resolve(REPO_ROOT, 'schema.sql');
const MIG_0016 = resolve(REPO_ROOT, 'migrations/0016_users_profile_fields.sql');
const WORKER_JS = resolve(REPO_ROOT, 'src/worker.js');
const VALIDATION_TS = resolve(SRC, 'lib/validation.ts');

describe('profile — schema', () => {
  it('migration 0016 + schema.sql declare all 6 profile columns', () => {
    const m = readFileSync(MIG_0016, 'utf8');
    const s = readFileSync(SCHEMA_SQL, 'utf8');
    for (const col of ['name', 'dob', 'gender', 'gender_self', 'city', 'country']) {
      expect(m, `migration must add ${col}`).toMatch(new RegExp(`ADD COLUMN\\s+${col}\\b`));
      expect(s, `schema.sql must include ${col} on users`).toContain(col);
    }
  });
});

describe('profile — validation drift lock', () => {
  it('client lib/validation.ts and worker inlined limits agree on numeric ranges', () => {
    const lib = readFileSync(VALIDATION_TS, 'utf8');
    const worker = readFileSync(WORKER_JS, 'utf8');
    const pairs: Array<[string, RegExp, RegExp]> = [
      ['ftp.min',       /ftp:\s*\{[^}]*min:\s*50/,                /FTP_MIN\s*=\s*50/],
      ['ftp.max',       /ftp:\s*\{[^}]*max:\s*600/,               /FTP_MAX\s*=\s*600/],
      ['weight.min',    /weight_kg:\s*\{[^}]*min:\s*30/,          /WEIGHT_MIN\s*=\s*30/],
      ['weight.max',    /weight_kg:\s*\{[^}]*max:\s*200/,         /WEIGHT_MAX\s*=\s*200/],
      ['hr.min',        /hr_max:\s*\{[^}]*min:\s*100/,            /HR_MIN\s*=\s*100/],
      ['hr.max',        /hr_max:\s*\{[^}]*max:\s*230/,            /HR_MAX\s*=\s*230/],
      ['name.max',      /name:\s*\{\s*max:\s*80/,                 /NAME_MAX\s*=\s*80/],
      ['city.max',      /city:\s*\{\s*max:\s*64/,                 /CITY_MAX\s*=\s*64/],
      ['country.regex', /country:\s*\{\s*regex:\s*\/\^\[A-Z\]\{2\}\$\//, /COUNTRY_RE\s*=\s*\/\^\[A-Z\]\{2\}\$\//],
    ];
    for (const [name, libRe, workerRe] of pairs) {
      expect(lib, `lib/validation.ts: ${name}`).toMatch(libRe);
      expect(worker, `worker.js: ${name}`).toMatch(workerRe);
    }
  });

  it("PROFILE_GENDERS list matches the worker's GENDERS array", () => {
    const lib = readFileSync(VALIDATION_TS, 'utf8');
    const worker = readFileSync(WORKER_JS, 'utf8');
    const expected = ['prefer-not-to-say', 'woman', 'man', 'non-binary', 'self-describe'];
    for (const g of expected) {
      expect(lib).toContain(`'${g}'`);
      expect(worker).toContain(`'${g}'`);
    }
  });
});

describe('profile — endpoint trust boundary', () => {
  it('worker /api/me/profile handlers all invoke resolveAthleteId before db.prepare', () => {
    const src = readFileSync(WORKER_JS, 'utf8');
    const idx = src.indexOf("'/api/me/profile'");
    expect(idx).toBeGreaterThan(-1);
    const slice = src.slice(idx, idx + 2500);
    const authnIdx = slice.indexOf('resolveAthleteId');
    const prepIdx = slice.indexOf('db.prepare');
    expect(authnIdx > -1 && (prepIdx === -1 || authnIdx < prepIdx)).toBe(true);
  });

  it('worker /api/me/profile UPDATE statement is scoped by athlete_id', () => {
    const src = readFileSync(WORKER_JS, 'utf8');
    const updateMatch = src.match(/UPDATE\s+users\s+SET[\s\S]{0,800}WHERE\s+athlete_id\s*=\s*\?/);
    expect(updateMatch).not.toBeNull();
  });
});

describe('profile — design-system var-resolution scope (Sprint 12 contract extension)', () => {
  // The /dashboard/you rebuild lands its own dashboard.you.module.css in Task 6.
  // Until then, the existing route imports TabShared.module.css; this scope
  // check fires once the new file lands.
  const dashboardYouCss = resolve(SRC, 'routes/dashboard.you.module.css');

  it.runIf(existsSync(dashboardYouCss))(
    'routes/dashboard.you.module.css contains zero hex literals',
    () => {
      const css = readFileSync(dashboardYouCss, 'utf8');
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const hex = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hex).toEqual([]);
    },
  );
});
