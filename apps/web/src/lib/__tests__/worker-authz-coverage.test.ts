// Sprint 11 — Worker authorization (ownership) contract guards.
//
// Authn proves who you are; authz proves you can touch this resource. The
// pattern in worker.js for owned resources is:
//   1. resolveAthleteId(request) — get the actor.
//   2. SELECT row by id.
//   3. Compare row.athlete_id (or row.created_by + admin role) against actor.
//   4. 404 OWASP if mismatch (NOT 403 — don't leak existence).
//
// This file pins the contract for /api/me/sessions/:id (the planned-sessions
// PATCH/POST surface) and /api/clubs/:id/events/:eventId (PATCH + cancel).
// Both are static-scan checks — they read worker.js source and assert the
// ownership guard is present and runs before any UPDATE/DELETE.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerPath = resolve(__dirname, '../../../../../src/worker.js');
const workerSource = readFileSync(workerPath, 'utf8');

// Same handler-locator helper as worker-authn-contract.test.ts.
function locateHandlerBlocks(source: string, predicate: (header: string) => boolean): string[] {
  const lines = source.split('\n');
  const blocks: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith('    if (')) continue;
    let header = line;
    let j = i;
    while (!header.trimEnd().endsWith('{') && j < lines.length - 1) {
      j++;
      header += `\n${lines[j]}`;
    }
    if (!predicate(header)) continue;
    const startLine = i;
    let depth = 1;
    let k = j + 1;
    while (k < lines.length && depth > 0) {
      const l = lines[k]!;
      const opens = (l.match(/\{/g) || []).length;
      const closes = (l.match(/\}/g) || []).length;
      depth += opens - closes;
      if (depth === 0) break;
      k++;
    }
    blocks.push(lines.slice(startLine, k + 1).join('\n'));
    i = k;
  }
  return blocks;
}

describe('Worker authz contract — owned-resource handlers verify ownership', () => {
  describe('PATCH /api/me/sessions/:id and POST /:id/cancel|/uncancel', () => {
    const sessionWriteBlocks = locateHandlerBlocks(workerSource, (header) =>
      /sessionByIdMatch\s*&&/.test(header),
    );

    it('locates the sessionByIdMatch handler', () => {
      expect(sessionWriteBlocks.length).toBeGreaterThanOrEqual(1);
    });

    for (const block of sessionWriteBlocks) {
      it('selects existing row before any UPDATE', () => {
        // The handler must SELECT athlete_id from planned_sessions before
        // running an UPDATE. Otherwise the ownership check is bypassable.
        // The SQL is split across string-concatenated literals so we just
        // look for `SELECT` in the same statement that mentions
        // `planned_sessions` and contains `athlete_id`.
        const selectIdx = block.search(/SELECT\b[^']*athlete_id[^']*FROM\s+planned_sessions|SELECT[^']*FROM\s+planned_sessions/i);
        const updateIdx = block.search(/UPDATE\s+planned_sessions/i);
        expect(selectIdx).toBeGreaterThan(-1);
        expect(updateIdx).toBeGreaterThan(-1);
        expect(selectIdx).toBeLessThan(updateIdx);
      });

      it('compares existing.athlete_id against authResult.athleteId', () => {
        // The 404-OWASP ownership check.
        expect(block).toMatch(/existing\.athlete_id\s*!==\s*authResult\.athleteId/);
      });

      it('returns 404 (not 403) on ownership mismatch — OWASP discipline', () => {
        // The ownership-mismatch branch must produce status: 404. A 403 would
        // leak that the row exists. Pin to the literal pattern in worker.js.
        expect(block).toMatch(
          /if\s*\(\s*!existing\s*\|\|\s*existing\.athlete_id\s*!==\s*authResult\.athleteId\s*\)\s*\{[\s\S]*?status:\s*404/,
        );
      });

      it('does NOT return 403 on ownership mismatch (would leak existence)', () => {
        // Belt-and-braces: the ownership branch must not contain a 403.
        // If it does, OWASP existence-leak is back.
        const ownershipBranch = block.match(
          /if\s*\(\s*!existing\s*\|\|\s*existing\.athlete_id\s*!==\s*authResult\.athleteId\s*\)\s*\{[\s\S]*?return[^;]*?\);/,
        );
        expect(ownershipBranch).not.toBeNull();
        expect(ownershipBranch![0]).not.toMatch(/status:\s*403/);
      });

      it('cascade UPDATE scopes WHERE by athlete_id', () => {
        // The v10.12.0 cascade-edit feature does a multi-row UPDATE of
        // sibling sessions. That UPDATE MUST be scoped by athlete_id =
        // authResult.athleteId so a malicious recurring_group_id from one
        // user can't update another user's rows.
        const cascadeUpdate = block.match(
          /UPDATE\s+planned_sessions\s+SET[\s\S]+?WHERE\s+recurring_group_id\s*=\s*\?[\s\S]{0,400}/i,
        );
        expect(cascadeUpdate, 'cascade UPDATE not found').not.toBeNull();
        expect(cascadeUpdate![0]).toMatch(/athlete_id\s*=\s*\?/);
      });

      it('per-row UPDATE in the cascade-with-no-group fallback scopes by athlete_id', () => {
        // The fallback path (`if (!me?.recurring_group_id)`) does a
        // single-row UPDATE; that one also scopes WHERE id = ? AND
        // athlete_id = ? to defend against IDOR.
        const fallbackBind = block.match(
          /UPDATE\s+planned_sessions\s+SET\s+\$\{updates\.join[\s\S]+?WHERE\s+id\s*=\s*\?\s+AND\s+athlete_id\s*=\s*\?/i,
        );
        expect(fallbackBind, [
          'cascade fallback UPDATE missing athlete_id scope.',
          'IDOR risk: ownership check above is necessary but not sufficient — the SQL itself should also scope by athlete.',
        ].join(' ')).not.toBeNull();
      });
    }
  });

  describe('PATCH /api/clubs/:id/events/:eventId and POST /:id/cancel', () => {
    const eventWriteBlocks = locateHandlerBlocks(workerSource, (header) =>
      /(?:eventEditMatch|eventCancelMatch)\s*&&/.test(header),
    );

    it('locates 2 event-write handlers', () => {
      expect(eventWriteBlocks.length).toBe(2);
    });

    for (const block of eventWriteBlocks) {
      it('checks isAdmin || isCreator before mutation', () => {
        // Spec: creator OR admin only. Both branches required; absence of
        // either lets a non-creator non-admin mutate the event.
        expect(block).toMatch(/membership\.role\s*===\s*['"]admin['"]/);
        expect(block).toMatch(/event\.created_by\s*===\s*authResult\.athleteId/);
      });

      it('returns 403 on permission mismatch (not 404)', () => {
        // Different from /api/me/sessions: here the membership has already
        // been validated by the prior batch, so existence is not a secret —
        // 403 with a meaningful body is the right answer.
        expect(block).toMatch(
          /if\s*\(\s*!isAdmin\s*&&\s*!isCreator\s*\)\s*\{[\s\S]*?status:\s*403/,
        );
      });

      it('returns 404 when not a member or event missing — OWASP', () => {
        // This is the existence-leak guard. Non-members must see 404, not
        // 403 (which would prove the club exists).
        expect(block).toMatch(
          /if\s*\(\s*!membership\s*\|\|\s*!event\s*\)\s*\{[\s\S]*?status:\s*404/,
        );
      });

      it('SELECT runs before UPDATE', () => {
        const selectIdx = block.search(/SELECT[\s\S]*?FROM\s+club_events/i);
        const updateIdx = block.search(/UPDATE\s+club_events/i);
        expect(selectIdx).toBeGreaterThan(-1);
        expect(updateIdx).toBeGreaterThan(-1);
        expect(selectIdx).toBeLessThan(updateIdx);
      });
    }
  });

  describe('PATCH /api/users/me/profile — own-resource by definition', () => {
    const profileBlocks = locateHandlerBlocks(workerSource, (header) =>
      /url\.pathname\s*===\s*['"]\/api\/users\/me\/profile['"]/.test(header),
    );

    it('locates the profile PATCH handler', () => {
      expect(profileBlocks.length).toBe(1);
    });

    it('UPDATE scopes WHERE by athlete_id from authResult', () => {
      const block = profileBlocks[0]!;
      const update = block.match(/UPDATE\s+users\s+SET[\s\S]+?WHERE\s+athlete_id\s*=\s*\?/i);
      expect(update, 'profile UPDATE missing WHERE athlete_id').not.toBeNull();
    });
  });

  describe('GET /api/me/sessions and /api/me/schedule', () => {
    // Filter to GET handlers only — `=== '/api/me/sessions'` matches both the
    // GET and POST handler `if` lines.
    const readBlocks = locateHandlerBlocks(workerSource, (header) =>
      /url\.pathname\s*===\s*['"]\/api\/me\/(sessions|schedule)['"][^{]*request\.method\s*===\s*['"]GET['"]/.test(header),
    );

    it('locates 2 /api/me GET read handlers', () => {
      expect(readBlocks.length).toBe(2);
    });

    for (const block of readBlocks) {
      const headerLine = block.split('\n')[0]!.trim();
      it(`SELECT scopes by authResult.athleteId — ${headerLine.slice(0, 60)}`, () => {
        // The handler reads a range from query params but the athlete is
        // ALWAYS bound from authResult.athleteId — never from a query param.
        expect(block).toMatch(/authResult\.athleteId/);
      });

      it(`does not read athlete_id from request query params — ${headerLine.slice(0, 60)}`, () => {
        // Any `searchParams.get('athlete_id')` is a smell because the only
        // legitimate athlete is the authenticated one.
        expect(block).not.toMatch(/searchParams\.get\(['"]athlete_id['"]\)/);
      });
    }
  });
});
