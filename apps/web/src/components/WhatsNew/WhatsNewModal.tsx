import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../Button/Button';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { ChangelogEntry } from '../../lib/changelogParser';
import styles from './WhatsNew.module.css';

interface WhatsNewModalProps {
  open: boolean;
  entries: ChangelogEntry[];
  onClose: () => void;
}

export function WhatsNewModal({ open, entries, onClose }: WhatsNewModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="whats-new-title"
        >
          <motion.div
            ref={modalRef}
            className={styles.modal}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className={styles.head}>
              <h2 id="whats-new-title" className={styles.title}>
                What's <em>new</em>.
              </h2>
            </header>

            {entries.length === 0 ? (
              <p>No changelog entries yet.</p>
            ) : (
              entries.map((e) => (
                <article key={e.version} className={styles.entry}>
                  <div className={styles.entryHead}>
                    <span className={styles.entryVersion}>v{e.version}</span>
                    <span className={styles.entryDate}>{e.date}</span>
                  </div>
                  <div className={styles.entryBody}>{e.body}</div>
                </article>
              ))
            )}

            <div className={styles.actions}>
              <Button variant="primary" size="md" onClick={onClose}>
                Got it
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
