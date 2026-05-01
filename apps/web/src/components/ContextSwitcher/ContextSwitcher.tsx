import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from '@tanstack/react-router';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAppContext } from '../../lib/AppContext';
import { useClubs } from '../../hooks/useClubs';
import { useClubsEnabled } from '../../lib/featureFlags';
import styles from './ContextSwitcher.module.css';

/**
 * ContextSwitcher — pill-style trigger in TopBar that opens a dropdown listing
 * "My account" + each club the user belongs to + "Create new club".
 * Selecting an item updates AppContext (mode/clubId/clubName/role) and closes.
 *
 * Hidden when cc_clubsEnabled === 'false' (kill-switch); when enabled, it is
 * always rendered (the "My account" + "Create new club" items are always
 * available regardless of how many clubs the user has).
 */
export function ContextSwitcher() {
  const enabled = useClubsEnabled();
  const { scope, setIndividual, setClub } = useAppContext();
  const clubs = useClubs();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useFocusTrap<HTMLDivElement>(open);

  // Click-outside + ESC close
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  // Arrow-key nav between menu items (UserMenu pattern)
  useEffect(() => {
    if (!open) return;
    const root = menuRef.current;
    if (!root) return;
    const items = () => Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    requestAnimationFrame(() => items()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      const els = items();
      if (els.length === 0) return;
      const idx = els.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); els[(idx + 1) % els.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); els[(idx - 1 + els.length) % els.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, menuRef]);

  if (!enabled) return null;

  const triggerLabel = scope.mode === 'club' ? scope.clubName ?? 'Club' : 'My account';
  const triggerSub = scope.mode === 'club' ? scope.role : null;

  return (
    <>
      <div className={styles.wrap} ref={wrapRef}>
        <button
          type="button"
          className={styles.trigger}
          onClick={() => setOpen((s) => !s)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Switch context, currently ${triggerLabel}`}
        >
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.label}>
            <span className={styles.labelMain}>{triggerLabel}</span>
            {triggerSub && <span className={styles.labelSub}>{triggerSub}</span>}
          </span>
          <span className={`${styles.chev} ${open ? styles.chevOpen : ''}`} aria-hidden="true">⌄</span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              className={styles.menu}
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            >
              <header className={styles.head}>
                <span className={styles.headLabel}>Active context</span>
              </header>

              <button
                role="menuitem"
                className={`${styles.item} ${scope.mode === 'individual' ? styles.itemActive : ''}`}
                onClick={() => { setOpen(false); setIndividual(); }}
              >
                <span className={styles.itemIcon} aria-hidden="true">●</span>
                <span className={styles.itemBody}>
                  <span>My account</span>
                  <span className={styles.itemSub}>Personal training</span>
                </span>
              </button>

              {clubs.data && clubs.data.length > 0 && (
                <>
                  <div className={styles.divider} />
                  {clubs.data.map((c) => (
                    <button
                      key={c.id}
                      role="menuitem"
                      className={`${styles.item} ${scope.mode === 'club' && scope.clubId === c.id ? styles.itemActive : ''}`}
                      onClick={() => {
                        setOpen(false);
                        setClub({ id: c.id, name: c.name, role: c.role });
                      }}
                    >
                      <span className={styles.itemIcon} aria-hidden="true">◎</span>
                      <span className={styles.itemBody}>
                        <span>{c.name}</span>
                        <span className={styles.itemSub}>{c.role}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}

              <div className={styles.divider} />
              <button
                role="menuitem"
                className={styles.item}
                onClick={() => { setOpen(false); navigate({ to: '/clubs/new' }); }}
              >
                <span className={styles.itemIcon} aria-hidden="true">+</span>
                <span className={styles.itemBody}>
                  <span>Create new club</span>
                  <span className={styles.itemSub}>You become the admin</span>
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* v9.8.2 (#71) — ClubCreateModal replaced by /clubs/new page route.
       *  Eliminates the modal stacking-context / sizing bugs that hit
       *  v9.7.5 / v9.8.1. */}
    </>
  );
}
