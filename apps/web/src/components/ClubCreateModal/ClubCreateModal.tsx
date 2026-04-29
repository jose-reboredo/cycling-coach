import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Button } from '../Button/Button';
import { useCreateClub } from '../../hooks/useClubs';
import type { CreateClubResponse } from '../../lib/clubsApi';
import styles from './ClubCreateModal.module.css';

interface ClubCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (club: CreateClubResponse) => void;
}

export function ClubCreateModal({ open, onClose, onCreated }: ClubCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const createClub = useCreateClub();

  // ESC dismiss + scroll lock + reset on open
  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setError(null);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    if (trimmed.length > 100) {
      setError('Name must be 100 characters or fewer.');
      return;
    }
    try {
      const club = await createClub.mutateAsync({
        name: trimmed,
        description: description.trim() || undefined,
      });
      onClose();
      onCreated?.(club);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create club.');
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.backdrop}
          onClick={(e) => e.target === e.currentTarget && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            ref={modalRef}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-create-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <h2 id="club-create-title" className={styles.title}>
              Create a <em>club</em>.
            </h2>
            <p className={styles.lede}>
              You become the admin. Invite teammates after you've spun up the shell.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="club-name">Name</label>
                <input
                  id="club-name"
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  autoFocus
                  placeholder="e.g. Zürich Tuesday Crew"
                />
                <span className={styles.fieldHint}>
                  Public name your members will see. Up to 100 characters.
                </span>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="club-description">Description</label>
                <textarea
                  id="club-description"
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  placeholder="What is this club for?"
                />
                <span className={styles.fieldHint}>
                  Optional. Up to 500 characters.
                </span>
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <div className={styles.actions}>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createClub.isPending}
                >
                  {createClub.isPending ? 'Creating…' : 'Create club'}
                </Button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={onClose}
                  disabled={createClub.isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
