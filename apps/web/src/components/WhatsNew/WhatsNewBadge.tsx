import { useState } from 'react';
import entries from 'virtual:changelog';
import { WhatsNewModal } from './WhatsNewModal';
import styles from './WhatsNew.module.css';

const STORAGE_KEY = 'cc_lastSeenVersion';

function readLastSeen(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(version: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    /* localStorage disabled — degrades to "always show badge" */
  }
}

/**
 * WhatsNewBadge — TopBar trailing-slot pill that opens a modal with the
 * latest 3 changelog entries when there's a release the user hasn't seen.
 */
export function WhatsNewBadge() {
  const [open, setOpen] = useState(false);
  const current = entries[0]?.version;
  const lastSeen = readLastSeen();
  const hasUpdate = Boolean(current && current !== lastSeen);

  if (!hasUpdate) return null;

  return (
    <>
      <button
        type="button"
        className={styles.badge}
        onClick={() => setOpen(true)}
        aria-label={`What's new in v${current}`}
      >
        <span className={styles.badgeDot} aria-hidden="true" />
        New · v{current}
      </button>

      <WhatsNewModal
        open={open}
        entries={entries.slice(0, 3)}
        onClose={() => {
          if (current) writeLastSeen(current);
          setOpen(false);
        }}
      />
    </>
  );
}
