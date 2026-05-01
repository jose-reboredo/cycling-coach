import { useNavigate } from '@tanstack/react-router';
import { Button } from '../Button/Button';
import { useClubs } from '../../hooks/useClubs';
import { useClubsEnabled } from '../../lib/featureFlags';
import styles from './ClubCreateCard.module.css';

/**
 * ClubCreateCard — surfaces the club creation affordance on Dashboard
 * for users who haven't created any club yet. Auto-hides once the user
 * has ≥1 club (the ContextSwitcher in F2 takes over from there).
 *
 * v9.8.2 (#71) — "Create club" now navigates to /clubs/new (page route)
 * instead of opening the old modal. Modal pattern eliminated to avoid
 * the stacking-context bugs from v9.7.5 / v9.8.1.
 *
 * Gated by the cc_clubsEnabled flag — set localStorage.cc_clubsEnabled
 * = 'false' to suppress the entire club UI surface.
 */
export function ClubCreateCard() {
  const enabled = useClubsEnabled();
  const clubs = useClubs();
  const navigate = useNavigate();

  if (!enabled) return null;
  if (clubs.isLoading || clubs.isError) return null;
  if ((clubs.data?.length ?? 0) > 0) return null;

  return (
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
      <Button variant="primary" size="md" onClick={() => navigate({ to: '/clubs/new' })}>
        Create club
      </Button>
    </div>
  );
}
