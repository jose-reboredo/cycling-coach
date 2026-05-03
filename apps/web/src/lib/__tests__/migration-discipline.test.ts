// Sprint 11 — Migration ↔ schema.sql parity contract.
//
// Project rule (CONTRIBUTING.md, v9.2.0+): every migration MUST update
// schema.sql in the same commit so a fresh `wrangler d1 execute --file=schema.sql`
// reproduces the cumulative state. The two files drift in practice — this
// test catches drift at PR time.
//
// What's checked:
//   1. Every CREATE TABLE in migrations/ exists in schema.sql.
//   2. Every CREATE INDEX in migrations/ exists in schema.sql.
//   3. Every ALTER TABLE ADD COLUMN ends up as a column on the same table
//      in schema.sql.
//
// What's deliberately NOT checked (false-positive risk too high without
// a real SQL parser):
//   - Column types match precisely between migrations and schema.sql.
//   - CHECK constraint expressions match byte-for-byte.
//   - Default values match.
// These are tracked manually in PR review; this test only enforces presence.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const repoRoot = resolve(__dirname, '../../../../..');
const schemaSource = readFileSync(resolve(repoRoot, 'schema.sql'), 'utf8');
const migrationsDir = resolve(repoRoot, 'migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort();

interface MigrationEntity {
  file: string;
  kind: 'table' | 'index' | 'column';
  table: string;
  name: string; // table name for tables, index name for indexes, column name for columns
  raw: string;
}

function parseMigration(file: string, source: string): MigrationEntity[] {
  const out: MigrationEntity[] = [];

  // CREATE TABLE [IF NOT EXISTS] name ( ... );
  const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(source))) {
    out.push({ file, kind: 'table', table: m[1]!, name: m[1]!, raw: m[0]! });
  }

  // CREATE [UNIQUE] INDEX [IF NOT EXISTS] name ON table(...)
  const indexRe = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+(\w+)/gi;
  while ((m = indexRe.exec(source))) {
    out.push({ file, kind: 'index', table: m[2]!, name: m[1]!, raw: m[0]! });
  }

  // ALTER TABLE name ADD COLUMN col ...
  const alterRe = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/gi;
  while ((m = alterRe.exec(source))) {
    out.push({ file, kind: 'column', table: m[1]!, name: m[2]!, raw: m[0]! });
  }

  return out;
}

const allEntities: MigrationEntity[] = [];
for (const file of migrationFiles) {
  const source = readFileSync(resolve(migrationsDir, file), 'utf8');
  allEntities.push(...parseMigration(file, source));
}

// schema.sql lookups — cheap regex scans (one parse, all tests share).
function schemaHasTable(name: string): boolean {
  return new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${name}\\b`, 'i').test(schemaSource);
}
function schemaHasIndex(name: string): boolean {
  return new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${name}\\b`, 'i').test(schemaSource);
}
function schemaTableHasColumn(table: string, column: string): boolean {
  // Find the CREATE TABLE block for `table`, then look for the column name.
  const m = schemaSource.match(new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(([\\s\\S]*?)\\);`,
    'i',
  ));
  if (!m) return false;
  // Word-boundary match on the column name within the table body.
  return new RegExp(`\\b${column}\\b`, 'i').test(m[1]!);
}

describe('Migration ↔ schema.sql parity', () => {
  it('discovers a non-empty migration set', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
    expect(allEntities.length).toBeGreaterThan(0);
  });

  describe('CREATE TABLE statements appear in schema.sql', () => {
    const tables = allEntities.filter((e) => e.kind === 'table');
    if (tables.length === 0) {
      it.skip('no CREATE TABLE statements found across migrations', () => {});
    }
    for (const t of tables) {
      it(`${t.file} → CREATE TABLE ${t.name} appears in schema.sql`, () => {
        expect(schemaHasTable(t.name), [
          `Migration ${t.file} creates table "${t.name}" but schema.sql does not.`,
          'CONTRIBUTING.md rule: every migration must mirror to schema.sql.',
        ].join('\n')).toBe(true);
      });
    }
  });

  describe('CREATE INDEX statements appear in schema.sql', () => {
    const indexes = allEntities.filter((e) => e.kind === 'index');
    // KNOWN_GAPS: indexes that legitimately don't appear in schema.sql.
    // Document each here with a reason; reviewers should challenge new entries.
    const KNOWN_GAPS = new Set<string>([
      // None at present.
    ]);
    for (const ix of indexes) {
      if (KNOWN_GAPS.has(ix.name)) {
        it.skip(`${ix.file} → CREATE INDEX ${ix.name} (KNOWN_GAP, see test)`, () => {});
        continue;
      }
      it(`${ix.file} → CREATE INDEX ${ix.name} appears in schema.sql`, () => {
        expect(schemaHasIndex(ix.name), [
          `Migration ${ix.file} creates index "${ix.name}" on ${ix.table}, but schema.sql does not.`,
          'CONTRIBUTING.md rule: every migration must mirror to schema.sql.',
        ].join('\n')).toBe(true);
      });
    }
  });

  describe('ALTER TABLE ADD COLUMN ends up in schema.sql', () => {
    const columns = allEntities.filter((e) => e.kind === 'column');
    // KNOWN_GAPS: schema.sql snapshot is one-off behind migrations sometimes.
    // Each entry documents the migration + column + reason. New entries must
    // be cleared by a reviewer.
    const KNOWN_GAPS = new Set<string>([
      // schema.sql comments at line 320 explicitly note this column is added
      // by ALTER TABLE in migration 0011 and not duplicated in the table body.
      'users.preferred_surface',
    ]);
    for (const col of columns) {
      const key = `${col.table}.${col.name}`;
      if (KNOWN_GAPS.has(key)) {
        it.skip(`${col.file} → ALTER TABLE ${col.table} ADD COLUMN ${col.name} (KNOWN_GAP, see schema.sql comments)`, () => {});
        continue;
      }
      it(`${col.file} → ${col.table}.${col.name} appears in schema.sql`, () => {
        expect(schemaTableHasColumn(col.table, col.name), [
          `Migration ${col.file} adds column "${col.name}" to "${col.table}", but schema.sql's CREATE TABLE block doesn't list it.`,
          'CONTRIBUTING.md rule: every migration must mirror to schema.sql.',
          'If the gap is intentional (e.g., ALTER-only addition documented inline), add to KNOWN_GAPS in this test.',
        ].join('\n')).toBe(true);
      });
    }
  });

  describe('Migration filenames are well-formed and ordered', () => {
    it('every migration file matches NNNN_name.sql', () => {
      for (const f of migrationFiles) {
        expect(f).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      }
    });

    it('migration numbers are unique', () => {
      const numbers = migrationFiles.map((f) => parseInt(f.slice(0, 4), 10));
      expect(new Set(numbers).size).toBe(numbers.length);
    });

    it('every migration mentions itself in a comment header (cross-ref)', () => {
      // Sanity: each migration's first comments mention its own number, so
      // grepping `0011` reliably finds the file. Not a hard rule — skipif
      // any aren't doing this. But useful for audit grepping.
      for (const f of migrationFiles) {
        const num = f.slice(0, 4);
        const source = readFileSync(resolve(migrationsDir, f), 'utf8');
        const head = source.slice(0, 800);
        // Accept any of: `Migration 0011`, `0011 —`, `Migration 11`, etc.
        const found = head.includes(num) || head.includes(String(parseInt(num, 10)));
        expect(found, `${f} header doesn't reference its number`).toBe(true);
      }
    });
  });
});
