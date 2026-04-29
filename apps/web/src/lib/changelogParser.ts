export interface ChangelogEntry {
  /** Bare version, no v-prefix. e.g. "8.5.0" */
  version: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** First non-blank line of the entry body — used as a one-liner. */
  summary: string;
  /** Full markdown body of the entry, between the version heading and the next. */
  body: string;
}

/**
 * Parse a Keep-a-Changelog formatted markdown string into structured entries.
 *
 * Entry heading shape: `## [<version>] — <YYYY-MM-DD>` (em-dash, with surrounding spaces).
 * Body is everything between the heading and the next `## [` heading (or EOF).
 */
export function parseChangelog(markdown: string): ChangelogEntry[] {
  const headingRe = /^## \[([\d.]+)\][\s—-]+(\d{4}-\d{2}-\d{2})\s*$/gm;
  const entries: ChangelogEntry[] = [];
  const matches = Array.from(markdown.matchAll(headingRe));

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const version = m[1]!;
    const date = m[2]!;
    const start = (m.index ?? 0) + m[0].length;
    const next = matches[i + 1];
    const end = next ? (next.index ?? markdown.length) : markdown.length;
    const body = markdown.slice(start, end).trim();
    const summary = (body.split('\n').find((line) => line.trim().length > 0) || '').trim();
    entries.push({ version, date, summary, body });
  }

  return entries;
}
