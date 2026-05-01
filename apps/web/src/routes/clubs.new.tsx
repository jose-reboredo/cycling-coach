// Sprint 5 / v9.8.2 (#71) — Create Club page replaces ClubCreateModal.
// Reasoning: the modal pattern hit 3+ bugs across v9.7.5 / v9.8.1 (sizing,
// stacking context, desktop visibility). Page pattern eliminates the entire
// class — no portal, no visualViewport hook, no z-index battles, no body
// scroll lock. Same form, simpler implementation, works identically on
// mobile + desktop.

import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Button } from '../components/Button/Button';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { useCreateClub } from '../hooks/useClubs';
import { useAppContext } from '../lib/AppContext';
import styles from './clubs.new.module.css';

export const Route = createFileRoute('/clubs/new')({
  component: ClubNewPage,
});

function ClubNewPage() {
  const navigate = useNavigate();
  const { setClub } = useAppContext();
  const createClub = useCreateClub();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      // Auto-switch context to the newly-created club + return to dashboard
      setClub({ id: club.id, name: club.name, role: club.role });
      navigate({ to: '/dashboard/today' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create club.');
    }
  }

  return (
    <main id="main" className={styles.page}>
      <Container width="narrow">
        <header className={styles.head}>
          <Eyebrow rule tone="accent">New club</Eyebrow>
          <h1 className={styles.title}>
            Create a <em>club</em>.
          </h1>
          <p className={styles.lede}>
            You become the admin. Invite teammates after you've spun up the shell.
          </p>
        </header>

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
              onClick={() => navigate({ to: '/dashboard/today' })}
              disabled={createClub.isPending}
            >
              Cancel
            </button>
          </div>
        </form>
      </Container>
    </main>
  );
}
