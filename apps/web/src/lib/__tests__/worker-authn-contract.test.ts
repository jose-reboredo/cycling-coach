// Sprint 11 — Worker authentication contract guards.
//
// Why this exists: the v10.11.x calendar-reliability cluster shipped 6
// hotfixes because we lacked symptom-class tests. The v10.11.3 retro
// action backfilled cache-contract guards (8 tests). This file extends
// the same static-scan pattern to the AUTHN surface — every endpoint
// that touches user data must invoke `resolveAthleteId(request)` BEFORE
// any `db.prepare()` call.
//
// The static scan is cheap (parses worker.js as text) but high-ROI: it
// catches "I forgot the auth gate" PRs at review time, not at incident
// time. The shape mirrors `worker-cache-contract.test.ts`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const workerPath = resolve(__dirname, '../../../../../src/worker.js');
const routesDir = resolve(__dirname, '../../../../../src/routes');
const workerSource = readFileSync(workerPath, 'utf8');

const routeFiles: Array<{ name: string; source: string }> = readdirSync(routesDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, source: readFileSync(resolve(routesDir, f), 'utf8') }));

// Find the byte offset where each `if (... && request.method === 'M')` handler
// block starts in worker.js, so we can scope our scans to single handlers.
//
// Strategy: locate the line that opens the handler with a path-pattern check,
// then walk forward until we hit the matching closing brace at indent 4. The
// exact byte range covers the body the test is asserting against.
function locateHandlerBlocks(source: string, predicate: (header: string) => boolean): string[] {
  const lines = source.split('\n');
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Handler entrypoints start with `    if (...)` (4-space indent).
    if (!line.startsWith('    if (')) continue;
    // The condition can span multiple lines; assemble until a `{` at end.
    let header = line;
    let j = i;
    while (!header.trimEnd().endsWith('{') && j < lines.length - 1) {
      j++;
      header += `\n${lines[j]}`;
    }
    if (!predicate(header)) continue;

    // Walk forward to find the closing `    }` at the same indent.
    const startLine = i;
    let depth = 1;
    let k = j + 1;
    while (k < lines.length && depth > 0) {
      const l = lines[k]!;
      // Count opening / closing braces on this line, ignoring strings.
      // Cheap heuristic: tally `{` and `}` directly. Good enough — the
      // worker.js style is consistent.
      const opens = (l.match(/\{/g) || []).length;
      const closes = (l.match(/\}/g) || []).length;
      depth += opens - closes;
      if (depth === 0) break;
      k++;
    }
    const block = lines.slice(startLine, k + 1).join('\n');
    blocks.push(block);
    i = k; // skip past this block
  }
  return blocks;
}

// Returns true if `block` calls db.prepare BEFORE `resolveAthleteId`.
// "Before" = lower string index. If neither call appears, returns false.
function dbBeforeAuth(block: string): boolean {
  const dbIdx = block.search(/db\.prepare\(|env\.cycling_coach_db\.\s*\n?\s*prepare\(|env\.cycling_coach_db\.prepare\(/);
  const authIdx = block.search(/resolveAthleteId\s*\(/);
  if (dbIdx === -1) return false;       // no db work in this handler
  if (authIdx === -1) return true;      // db work but no auth gate at all
  return dbIdx < authIdx;
}

describe('Worker authn contract — every user-data handler resolves athlete first', () => {
  describe('/api/me/* handlers', () => {
    const meHandlers = locateHandlerBlocks(workerSource, (header) =>
      /url\.pathname\s*===\s*['"]\/api\/me\//.test(header)
        || /sessionByIdMatch\s*&&/.test(header),
    );

    it('locates at least 3 /api/me/* handlers (sanity)', () => {
      expect(meHandlers.length).toBeGreaterThanOrEqual(3);
    });

    for (const block of meHandlers) {
      const headerLine = block.split('\n')[0]!.trim();
      it(`auth gate runs before any db.prepare — ${headerLine.slice(0, 80)}`, () => {
        expect(dbBeforeAuth(block), [
          `Handler appears to call db.prepare() before resolveAthleteId().`,
          `Authn must precede any DB work to prevent unauthenticated reads.`,
          '',
          `Block (first 800 chars):\n${block.slice(0, 800)}`,
        ].join('\n')).toBe(false);
      });
    }
  });

  describe('/api/clubs/:id/* handlers', () => {
    // All /api/clubs/:id/* handlers use a regex matcher named `*Match`. We pin
    // on the matcher-name convention so this test is robust against the
    // header-line regex evolving.
    const clubsMatchHandlers = locateHandlerBlocks(workerSource, (header) =>
      /(?:eventsMatch|eventEditMatch|eventCancelMatch|draftDescMatch|overviewMatch|membersMatch|rsvpWriteMatch|rsvpReadMatch|joinMatch)\s*&&/.test(header),
    );

    it('locates at least 5 /api/clubs/:id/* handlers (sanity)', () => {
      expect(clubsMatchHandlers.length).toBeGreaterThanOrEqual(5);
    });

    for (const block of clubsMatchHandlers) {
      const headerLine = block.split('\n')[0]!.trim();
      it(`auth gate runs before any db.prepare — ${headerLine.slice(0, 80)}`, () => {
        expect(dbBeforeAuth(block), [
          `Handler appears to call db.prepare() before resolveAthleteId().`,
          `Club resources are member-gated; authn must precede DB reads/writes.`,
          '',
          `Block (first 800 chars):\n${block.slice(0, 800)}`,
        ].join('\n')).toBe(false);
      });
    }
  });

  describe('/api/users/me/* and /api/training-prefs handlers', () => {
    const profileHandlers = locateHandlerBlocks(workerSource, (header) =>
      /url\.pathname\s*===\s*['"]\/api\/users\/me\/|url\.pathname\s*===\s*['"]\/api\/training-prefs['"]/.test(header),
    );

    it('locates at least 1 profile handler (sanity)', () => {
      expect(profileHandlers.length).toBeGreaterThanOrEqual(1);
    });

    for (const block of profileHandlers) {
      const headerLine = block.split('\n')[0]!.trim();
      it(`auth gate runs before any db.prepare — ${headerLine.slice(0, 80)}`, () => {
        expect(dbBeforeAuth(block), `db.prepare ran before resolveAthleteId`).toBe(false);
      });
    }
  });

  describe('Routes-module handlers (src/routes/*.js)', () => {
    // Each exported handleX in /src/routes/*.js receives `deps.resolveAthleteId`
    // injected by worker.js and must call it before any `env.cycling_coach_db`
    // access. Static-scan the function bodies to confirm the discipline.
    const exportedFns: Array<{ file: string; name: string; body: string }> = [];
    for (const { name, source } of routeFiles) {
      const re = /export\s+(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        const start = m.index + m[0].length;
        // Walk braces to find the function body end.
        let depth = 1;
        let i = start;
        while (i < source.length && depth > 0) {
          const ch = source[i]!;
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          i++;
        }
        exportedFns.push({ file: name, name: m[1]!, body: source.slice(start, i) });
      }
    }

    it('locates at least 5 exported handlers across routes/ (sanity)', () => {
      expect(exportedFns.length).toBeGreaterThanOrEqual(5);
    });

    for (const fn of exportedFns) {
      // Skip pure helpers (regenerateForAthlete is called from cron — already
      // authenticated by virtue of athleteId being passed in). Heuristic: only
      // gate functions whose first param is `{ request, env, deps }`.
      if (!/^\s*\(\s*\{\s*request[^}]*\}\s*\)/.test(fn.body) && !/request\s*[,}]/.test(fn.body.slice(0, 200))) {
        continue;
      }
      // Filter to handlers that touch the DB (the authn rule applies).
      if (!/env\.cycling_coach_db|db\.prepare/.test(fn.body)) continue;

      it(`${fn.file}::${fn.name} resolves athleteId before DB access`, () => {
        const authIdx = fn.body.search(/resolveAthleteId\s*\(/);
        const dbIdx = fn.body.search(/env\.cycling_coach_db\.\s*prepare|env\.cycling_coach_db\.prepare|db\.prepare\(/);
        expect(authIdx, `${fn.name}: missing resolveAthleteId call`).toBeGreaterThan(-1);
        expect(dbIdx, `${fn.name}: missing db.prepare call (test inventory bug?)`).toBeGreaterThan(-1);
        expect(authIdx, [
          `${fn.name} calls db.prepare() (idx ${dbIdx}) before resolveAthleteId() (idx ${authIdx}).`,
          'Authn must precede DB access.',
        ].join(' ')).toBeLessThan(dbIdx);
      });
    }
  });

  describe('Authn helper itself', () => {
    it('resolveAthleteId returns 401 on missing Authorization header', () => {
      // Regression guard: the function MUST short-circuit with 401 before
      // any fetch / D1 call. If someone removes this branch, every endpoint
      // becomes unauthenticated.
      const fn = workerSource.match(/async function resolveAthleteId\(request\)\s*\{[\s\S]*?\n\}/);
      expect(fn, 'resolveAthleteId not found').not.toBeNull();
      const body = fn![0];
      expect(body).toMatch(/request\.headers\.get\(['"]Authorization['"]\)/);
      // The first if-branch must produce error: 401.
      const earlyExit = body.match(/if\s*\(\s*!auth\s*\)\s*\{[\s\S]*?return\s*\{\s*error:\s*401/);
      expect(earlyExit, 'resolveAthleteId missing the !auth → 401 short-circuit').not.toBeNull();
    });

    it('resolveAthleteId never returns 200/success without an athleteId', () => {
      const fn = workerSource.match(/async function resolveAthleteId\(request\)\s*\{[\s\S]*?\n\}/);
      const body = fn![0];
      // Every success path returns { athleteId: <value> }. There is exactly
      // one such return; if a future refactor adds a second, eyeball it.
      const matches = body.match(/return\s*\{\s*athleteId:/g) || [];
      expect(matches.length).toBe(1);
    });
  });
});
