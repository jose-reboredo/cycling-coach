import { Link } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { Button } from '../components/Button/Button';
import { TopBar } from '../components/TopBar/TopBar';
import { connectUrl } from '../lib/connectUrl';
import styles from './ConnectScreen.module.css';

/**
 * ConnectScreen — rendered at /dashboard when the user has no Strava tokens.
 * Replaces the old "always show Marco mock" behavior in production.
 *
 * Mock data only ever renders in dev (`import.meta.env.DEV`) or when the URL
 * carries `?demo=1` — preserved so we can iterate the design without an
 * authenticated session.
 */
export function ConnectScreen({ error }: { error?: string }) {
  return (
    <div className={styles.shell}>
      <TopBar
        variant="app"
        trailing={
          <Link to="/" className={styles.navLink}>
            Home
          </Link>
        }
      />
      <main className={styles.main}>
        <Container width="narrow">
          <div className={styles.centred}>
            <Eyebrow rule tone="accent">Stage 02 — Connect</Eyebrow>
            <h1 className={styles.h1}>
              Connect your <em>Strava</em>.
            </h1>
            <p className={styles.lede}>
              Your dashboard fills in once we have your activity history. Read-only OAuth — no
              password, no signup, your tokens stay in this browser.
            </p>

            {error ? <Pill tone="danger">{error}</Pill> : null}

            <div className={styles.cta}>
              <Button href={connectUrl()} size="lg" variant="primary" withArrow>
                Connect with Strava
              </Button>
            </div>

            <ul className={styles.factRow}>
              <li>
                <span>10s</span>
                <span>Setup</span>
              </li>
              <li>
                <span>0 €</span>
                <span>Cost</span>
              </li>
              <li>
                <span>∞</span>
                <span>Token refresh</span>
              </li>
              <li>
                <span>100%</span>
                <span>Local-first</span>
              </li>
            </ul>

            <p className={styles.demoHint}>
              Want to preview the dashboard without connecting? Append{' '}
              <code>?demo=1</code> to the URL.
            </p>
          </div>
        </Container>
      </main>
    </div>
  );
}
