// Sprint 11 — Pure-helper presence + signature contract.
//
// Several worker-side helpers are pure (no D1 / no fetch) but live inline
// in src/worker.js or src/routes/aiPlan.js. Hoisting them into a testable
// module mid-sprint is a refactor risk we don't want here. Instead, we
// pin their existence + key shape via a static scan so a silent rename or
// signature change is caught at PR time.
//
// Future work (next sprint): hoist these into src/lib/ for direct testing.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const workerSource = readFileSync(resolve(__dirname, '../../../../../src/worker.js'), 'utf8');
const aiPlanSource = readFileSync(resolve(__dirname, '../../../../../src/routes/aiPlan.js'), 'utf8');

describe('Worker pure-helper presence contract', () => {
  describe('src/worker.js — log redaction helpers', () => {
    it('redactSensitive function exists and strips api_key, sk-ant-, access_token, refresh_token', () => {
      const fn = workerSource.match(/function redactSensitive\(s\)\s*\{[\s\S]*?\n\}/);
      expect(fn, 'redactSensitive not found').not.toBeNull();
      const body = fn![0];
      expect(body).toMatch(/api_key/);
      expect(body).toMatch(/sk-ant-/);
      expect(body).toMatch(/access_token/);
      expect(body).toMatch(/refresh_token/);
      expect(body).toMatch(/\.replace\(/g);
    });

    it('safeArg, safeLog, safeWarn, safeError all exist', () => {
      expect(workerSource).toMatch(/function safeArg\(/);
      expect(workerSource).toMatch(/function safeLog\(/);
      expect(workerSource).toMatch(/function safeWarn\(/);
      expect(workerSource).toMatch(/function safeError\(/);
    });

    it('safeLog/safeWarn/safeError pipe arguments through safeArg', () => {
      // Defensive log redaction: forgetting to map args through safeArg
      // means raw secrets could land in Cloudflare logs. Test pins the
      // documented contract.
      expect(workerSource).toMatch(/function safeLog\(\.\.\.args\)\s*\{\s*console\.log\(\.\.\.args\.map\(safeArg\)\)/);
      expect(workerSource).toMatch(/function safeWarn\(\.\.\.args\)\s*\{\s*console\.warn\(\.\.\.args\.map\(safeArg\)\)/);
      expect(workerSource).toMatch(/function safeError\(\.\.\.args\)\s*\{\s*console\.error\(\.\.\.args\.map\(safeArg\)\)/);
    });
  });

  describe('src/worker.js — mapSessionRow shape', () => {
    it('mapSessionRow includes the v10.12.0 recurring_group_id field', () => {
      const fn = workerSource.match(/function mapSessionRow\(row\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      const body = fn![0];
      // All planned_sessions columns must be projected.
      const required = [
        'id', 'athlete_id', 'session_date', 'title', 'description',
        'zone', 'duration_minutes', 'target_watts', 'source',
        'ai_report_id', 'completed_at', 'cancelled_at',
        'ai_plan_session_id', 'elevation_gained', 'surface', 'user_edited_at',
        'recurring_group_id', 'created_at', 'updated_at',
      ];
      for (const k of required) {
        expect(body, `mapSessionRow missing field "${k}"`).toMatch(new RegExp(`\\b${k}:\\s*row\\.${k}`));
      }
    });
  });

  describe('src/worker.js — userOrigin allowlist gate', () => {
    it('ALLOWED_ORIGINS array exists and includes the canonical production origin', () => {
      expect(workerSource).toMatch(/const ALLOWED_ORIGINS\s*=\s*\[/);
      expect(workerSource).toMatch(/['"]https:\/\/cycling-coach\.josem-reboredo\.workers\.dev['"]/);
      expect(workerSource).toMatch(/['"]https:\/\/cadenceclub\.cc['"]/);
    });

    it('userOrigin function ignores X-Forwarded-Host (open-redirect fix v9.3.0)', () => {
      // The v9.3.0 fix removed X-Forwarded-Host trust to close an open-
      // redirect / phishing vector. A regression that re-introduces the
      // header would silently re-open the hole.
      const fn = workerSource.match(/function userOrigin\(request, url\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      expect(fn![0]).not.toMatch(/X-Forwarded-Host/i);
    });

    it('userOrigin gates explicit ?origin= override to localhost only', () => {
      const fn = workerSource.match(/function userOrigin\(request, url\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      const body = fn![0];
      // The override branch checks hostname is 'localhost' or '127.0.0.1'.
      expect(body).toMatch(/u\.hostname\s*===\s*['"]localhost['"]/);
      expect(body).toMatch(/u\.hostname\s*===\s*['"]127\.0\.0\.1['"]/);
    });
  });

  describe('src/worker.js — security headers & CSP', () => {
    it('SECURITY_HEADERS includes the four hard-required hardening headers', () => {
      const block = workerSource.match(/const SECURITY_HEADERS\s*=\s*\{[\s\S]*?\n\}/);
      expect(block).not.toBeNull();
      const body = block![0];
      expect(body).toMatch(/Strict-Transport-Security/);
      expect(body).toMatch(/X-Content-Type-Options.*nosniff/);
      expect(body).toMatch(/X-Frame-Options.*DENY/);
      expect(body).toMatch(/Content-Security-Policy/);
    });

    it('CSP frame-ancestors is none (clickjacking defense)', () => {
      expect(workerSource).toMatch(/frame-ancestors\s+'none'/);
    });

    it('CSP base-uri locks to self (base-tag injection defense)', () => {
      expect(workerSource).toMatch(/base-uri\s+'self'/);
    });
  });

  describe('src/routes/aiPlan.js — pure helpers', () => {
    it('zoneLabelToInt parses Z1..Z7 and returns null for anything else', () => {
      const fn = aiPlanSource.match(/function zoneLabelToInt\(label\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      const body = fn![0];
      expect(body).toMatch(/Z\(\[1-7\]\)/); // the regex literal
      expect(body).toMatch(/return null/);
    });

    it('clamp / clampInt exist and handle non-finite input by returning the floor', () => {
      const fn = aiPlanSource.match(/function clamp\(n, min, max\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      // Non-finite branch returns `min`, which is the documented contract.
      expect(fn![0]).toMatch(/!Number\.isFinite\(x\)\)?\s*return\s+min/);
      expect(aiPlanSource).toMatch(/function clampInt\(n, min, max\)/);
    });

    it('mondayOf normalises an ISO date to the Monday of that week', () => {
      const fn = aiPlanSource.match(/function mondayOf\(iso\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      const body = fn![0];
      // Mon=0 convention (`day = (d.getDay() + 6) % 7`).
      expect(body).toMatch(/d\.getDay\(\)\s*\+\s*6\)\s*%\s*7/);
      expect(body).toMatch(/d\.setDate\(d\.getDate\(\)\s*-\s*day\)/);
    });

    it('validateSession enforces ISO date shape, zone whitelist, duration range, surface whitelist', () => {
      const fn = aiPlanSource.match(/function validateSession\(s\)\s*\{[\s\S]*?\n\}/);
      expect(fn).not.toBeNull();
      const body = fn![0];
      // ISO date regex literal
      expect(body).toMatch(/\\d\{4\}-\\d\{2\}-\\d\{2\}/);
      // Zone whitelist
      expect(body).toMatch(/ZONE_LABELS\.has/);
      // Surface whitelist
      expect(body).toMatch(/SURFACE_LABELS\.has/);
      // Duration range 15..600
      expect(body).toMatch(/s\.duration\s*<\s*15/);
      expect(body).toMatch(/s\.duration\s*>\s*600/);
    });

    it('ZONE_LABELS includes Recovery (per AI prompt schema)', () => {
      // The AI returns 'Z1'..'Z7' OR 'Recovery'. Dropping 'Recovery' from
      // the whitelist would silently reject valid AI output.
      const block = aiPlanSource.match(/const ZONE_LABELS\s*=\s*new Set\(\[[\s\S]*?\]\)/);
      expect(block).not.toBeNull();
      expect(block![0]).toMatch(/'Recovery'/);
    });

    it('SURFACE_LABELS contains the 4 documented values', () => {
      const block = aiPlanSource.match(/const SURFACE_LABELS\s*=\s*new Set\(\[[\s\S]*?\]\)/);
      expect(block).not.toBeNull();
      const body = block![0];
      for (const v of ['Paved', 'Mixed', 'Gravel', 'Any']) {
        expect(body).toMatch(new RegExp(`'${v}'`));
      }
    });
  });
});
