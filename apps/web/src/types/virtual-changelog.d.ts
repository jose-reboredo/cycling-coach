declare module 'virtual:changelog' {
  import type { ChangelogEntry } from '../lib/changelogParser';
  const entries: ChangelogEntry[];
  export default entries;
}
