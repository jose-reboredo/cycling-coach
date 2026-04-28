import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  /** trigger contents — typically the user pill */
  children: React.ReactNode;
  onSync: () => void;
  onDisconnect: () => void;
  username: string;
}

/**
 * UserMenu — popover anchored to the user pill in the TopBar.
 * Click trigger → menu opens. Click outside or ESC closes.
 * Surfaces sync, disconnect, and the Strava revoke-link (so users can fully
 * remove the OAuth grant, not just delete local tokens).
 */
export function UserMenu({ children, onSync, onDisconnect, username }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${username}`}
      >
        {children}
        <span className={`${styles.chev} ${open ? styles.chevOpen : ''}`} aria-hidden="true">
          ⌄
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className={styles.menu}
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
          >
            <header className={styles.head}>
              <span className={styles.headLabel}>Signed in as</span>
              <span className={styles.headName}>{username}</span>
            </header>

            <button
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onSync();
              }}
            >
              <span className={styles.itemIcon} aria-hidden="true">↻</span>
              <span className={styles.itemBody}>
                <span>Sync now</span>
                <span className={styles.itemSub}>Refetch rides from Strava</span>
              </span>
            </button>

            <a
              role="menuitem"
              className={styles.item}
              href="https://www.strava.com/settings/apps"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              <span className={styles.itemIcon} aria-hidden="true">↗</span>
              <span className={styles.itemBody}>
                <span>Revoke at Strava</span>
                <span className={styles.itemSub}>Remove the OAuth grant entirely</span>
              </span>
            </a>

            <div className={styles.divider} />

            <button
              role="menuitem"
              className={`${styles.item} ${styles.itemDanger}`}
              onClick={() => {
                setOpen(false);
                onDisconnect();
              }}
            >
              <span className={styles.itemIcon} aria-hidden="true">⏻</span>
              <span className={styles.itemBody}>
                <span>Disconnect Strava</span>
                <span className={styles.itemSub}>Clear local tokens · keeps OAuth grant</span>
              </span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
