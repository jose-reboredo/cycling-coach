import { describe, it, expect } from 'vitest';
import { parseChangelog } from '../changelogParser';

const SAMPLE = `# Changelog

All notable releases.

---

## [8.5.0] — 2026-04-29

Polish release. Five issues.

### Added
- Foo bar

## [8.4.1] — 2026-04-28

Hotfix.

### Fixed
- Quux

## [8.4.0] — 2026-04-28

Audit pass.
`;

describe('parseChangelog', () => {
  it('extracts version + date for each entry', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.version).toBe('8.5.0');
    expect(entries[0]?.date).toBe('2026-04-29');
    expect(entries[1]?.version).toBe('8.4.1');
    expect(entries[2]?.version).toBe('8.4.0');
  });

  it('captures the body markdown of each entry until the next heading', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries[0]?.body).toContain('Polish release. Five issues.');
    expect(entries[0]?.body).toContain('### Added');
    expect(entries[0]?.body).toContain('Foo bar');
    expect(entries[0]?.body).not.toContain('Hotfix');
  });

  it('orders entries newest-first as they appear in the file', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries.map((e) => e.version)).toEqual(['8.5.0', '8.4.1', '8.4.0']);
  });

  it('returns empty array on input with no version headings', () => {
    expect(parseChangelog('# Changelog\n\nNothing here yet.')).toEqual([]);
  });

  it('extracts a one-line summary from the first non-blank line of the body', () => {
    const entries = parseChangelog(SAMPLE);
    expect(entries[0]?.summary).toBe('Polish release. Five issues.');
    expect(entries[1]?.summary).toBe('Hotfix.');
  });
});
