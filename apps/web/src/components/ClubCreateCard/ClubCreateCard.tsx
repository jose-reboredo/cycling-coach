import { useState } from 'react';
import { Button } from '../Button/Button';
import { ClubCreateModal } from '../ClubCreateModal/ClubCreateModal';
import { useClubs } from '../../hooks/useClubs';
import { useClubsEnabled } from '../../lib/featureFlags';
import styles from './ClubCreateCard.module.css';

/**
 * ClubCreateCard — surfaces the club creation affordance on Dashboard
 * for users who haven't created any club yet. Auto-hides once the user
 * has ≥1 club (the ContextSwitcher in F2 takes over from there).
 *
 * Gated by the cc_clubsEnabled flag — set localStorage.cc_clubsEnabled
 * = 'false' to suppress the entire club UI surface.
 */
export function ClubCreateCard() {
  const enabled = useClubsEnabled();
  const clubs = useClubs();
  const [open, setOpen] = useState(false);

  if (!enabled) return null;
  if (clubs.isLoading || clubs.isError) return null;
  if ((clubs.data?.length ?? 0) > 0) return null;

  return (
    <>
      <div className={styles.card}>
        <div className={styles.body}>
          <span className={styles.eyebrow}>New · Clubs</span>
          <span className={styles.title}>
            Train as a <em>club</em>.
          </span>
          <span className={styles.tag}>
            Spin up a shell for your group rides. You become the admin.
          </span>
        </div>
        <Button variant="primary" size="md" onClick={() => setOpen(true)}>
          Create club
        </Button>
      </div>
      <ClubCreateModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
