import { TopBar } from '../components/TopBar/TopBar';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  message?: string;
}

/** Centered spinner while the dashboard pulls athlete + activities. */
export function LoadingScreen({ message = 'Syncing your rides…' }: LoadingScreenProps) {
  return (
    <div className={styles.shell}>
      <TopBar variant="app" />
      <main className={styles.main}>
        <Container width="narrow">
          <div className={styles.centred}>
            <div className={styles.spinner} aria-hidden="true" />
            <Eyebrow rule tone="accent">Stage 03 — Sync</Eyebrow>
            <p className={styles.message}>{message}</p>
            <p className={styles.subtle}>
              First-time syncs pull every ride from your Strava history. Future visits are instant.
            </p>
          </div>
        </Container>
      </main>
    </div>
  );
}
