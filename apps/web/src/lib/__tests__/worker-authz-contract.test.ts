// Sprint 11 security audit — Authz contract test for the Worker.
//
// Why this exists: in v10.12.x the PATCH /api/me/sessions/:id and
// PATCH /api/clubs/:id/events/:eventId handlers verified ownership
// up-front via a SELECT-then-compare, but the subsequent UPDATE
// statements scoped only by `WHERE id = ?`. Today this is safe because
// the pre-check returns 404 on athlete_id mismatch — but the moment a
// future refactor drops or weakens the pre-check, the UPDATE accepts
// any caller's session id and silently writes another user's row.
//
// Sprint 11 #sec-1 hardened these to `WHERE id = ? AND athlete_id = ?`
// (planned_sessions) and `WHERE id = ? AND club_id = ?` (club_events).
// This test asserts the protective WHERE clauses stay in place
// statically — analogous to the v10.11.3 cache-contract test.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerPath = resolve(__dirname, '../../../../../src/worker.js');
const workerSource = readFileSync(workerPath, 'utf8');

describe('Worker authz contract (sprint 11 #sec-1)', () => {
  describe('planned_sessions writes — defense-in-depth athlete_id scope', () => {
    // Each entry pins one mutation site by an anchor that survives
    // refactors of comments around it. The window scan looks for the
    // UPDATE statement and confirms athlete_id is bound.
    const PLANNED_SESSION_MUTATIONS: Array<{ name: string; anchor: RegExp }> = [
      {
        name: 'PATCH /api/me/sessions/:id (single-row update)',
        // Anchor: the params.push(sessionId, authResult.athleteId) line
        anchor: /params\.push\(sessionId,\s*authResult\.athleteId\)/,
      },
      {
        name: 'POST /api/me/sessions/:id/cancel',
        // Anchor: the cancel UPDATE — bind expects 4 params (now, now, sessionId, athleteId)
        anchor: /UPDATE planned_sessions SET cancelled_at = \?, updated_at = \? WHERE id = \? AND athlete_id = \?/,
      },
      {
        name: 'POST /api/me/sessions/:id/uncancel',
        anchor: /UPDATE planned_sessions SET cancelled_at = NULL, updated_at = \? WHERE id = \? AND athlete_id = \?/,
      },
    ];

    for (const { name, anchor } of PLANNED_SESSION_MUTATIONS) {
      it(`${name} scopes UPDATE by athlete_id`, () => {
        expect(workerSource, [
          `Authz regression near ${name}.`,
          'Mutation MUST scope by athlete_id (defense-in-depth) — see sprint 11 #sec-1.',
          'A pre-check is not enough; the UPDATE itself must filter on athlete_id.',
        ].join('\n')).toMatch(anchor);
      });
    }

    it('PATCH cascade fallback (no recurring_group_id) scopes by athlete_id', () => {
      // The cascade fallback issues an UPDATE when the user requested
      // ?cascade=group but the row has no recurring_group_id. It must
      // still scope by athlete_id.
      const cascadeFallback = workerSource.match(
        /Cascade requested but session has no group[\s\S]{0,400}?UPDATE planned_sessions[\s\S]{0,300}?WHERE id = \? AND athlete_id = \?/,
      );
      expect(cascadeFallback, [
        'Cascade fallback UPDATE no longer scopes by athlete_id.',
        'See sprint 11 #sec-1: the PATCH handler MUST always include athlete_id in the WHERE clause.',
      ].join('\n')).not.toBeNull();
    });

    it('PATCH cascade self-update (with recurring_group_id) scopes by athlete_id', () => {
      // The "self update" UPDATE inside the cascade branch.
      const cascadeSelf = workerSource.match(
        /Self update[\s\S]{0,300}?UPDATE planned_sessions[\s\S]{0,300}?WHERE id = \? AND athlete_id = \?/,
      );
      expect(cascadeSelf, [
        'Cascade self-update UPDATE no longer scopes by athlete_id.',
        'See sprint 11 #sec-1.',
      ].join('\n')).not.toBeNull();
    });

    it('PATCH cascade sibling-update scopes by athlete_id', () => {
      // The sibling cascade UPDATE — should keep both recurring_group_id
      // AND athlete_id filters so a malicious caller can't cross-user
      // by spoofing a foreign group id.
      const siblingCascade = workerSource.match(
        /UPDATE planned_sessions SET[\s\S]{0,200}?WHERE recurring_group_id = \?\s+AND athlete_id = \?/,
      );
      expect(siblingCascade, [
        'Cascade sibling UPDATE no longer scopes by athlete_id.',
        'See sprint 11 #sec-1.',
      ].join('\n')).not.toBeNull();
    });

    it('contract guard: no `WHERE id = ?` UPDATE on planned_sessions without athlete_id', () => {
      // Catch any new mutation site added without scoping by athlete_id.
      // This regex finds UPDATE planned_sessions blocks whose WHERE
      // clause references id but NOT athlete_id within the next 200
      // chars. False-positive risk: zero today; future contributors
      // adding a legitimate global maintenance update should add an
      // explicit allowlist comment + adjust this test.
      const badMatches = [...workerSource.matchAll(
        /UPDATE planned_sessions[\s\S]{0,400}?WHERE[^;`]*?\bid\b[^;`]*?(?=`|;|\))/g,
      )].filter((m) => {
        const block = m[0];
        // Must reference athlete_id in the same WHERE block.
        return !/\bathlete_id\b/.test(block);
      });
      expect(badMatches, [
        'Found UPDATE planned_sessions whose WHERE clause does NOT scope by athlete_id.',
        'Sprint 11 #sec-1 requires every mutation to include athlete_id in the WHERE clause.',
        '',
        `Offending blocks: ${badMatches.map((m) => m[0].slice(0, 200)).join('\n---\n')}`,
      ].join('\n')).toEqual([]);
    });
  });

  describe('club_events writes — defense-in-depth club_id scope', () => {
    it('PATCH /api/clubs/:id/events/:eventId scopes UPDATE by club_id', () => {
      // The dynamic-SET UPDATE in the eventEditMatch handler.
      const editUpdate = workerSource.match(
        /UPDATE club_events SET \$\{updates\.join\(', '\)\} WHERE id = \? AND club_id = \?/,
      );
      expect(editUpdate, [
        'PATCH club_events UPDATE no longer scopes by club_id.',
        'Sprint 11 #sec-1: a creator-or-admin of club A must not be able to mutate an event that lives in club B even if their request reaches this branch.',
      ].join('\n')).not.toBeNull();
    });

    it('POST /api/clubs/:id/events/:eventId/cancel scopes UPDATE by club_id', () => {
      const cancelUpdate = workerSource.match(
        /UPDATE club_events SET cancelled_at = \? WHERE id = \? AND club_id = \?/,
      );
      expect(cancelUpdate, [
        'Cancel-event UPDATE no longer scopes by club_id.',
        'Sprint 11 #sec-1.',
      ].join('\n')).not.toBeNull();
    });
  });
});
