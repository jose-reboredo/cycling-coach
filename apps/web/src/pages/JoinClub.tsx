import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Button } from '../components/Button/Button';
import { TopBar } from '../components/TopBar/TopBar';
import { useJoinClub } from '../hooks/useClubs';
import { useAppContext } from '../lib/AppContext';
import { ensureValidToken } from '../lib/auth';
import { connectUrl } from '../lib/connectUrl';
import styles from './JoinClub.module.css';

interface JoinClubProps {
  code: string;
}

type Phase = 'checking-auth' | 'unauthed' | 'joining' | 'success' | 'error';

/**
 * /join/:code landing page. Three branches:
 *   - User not authed → prompt to connect Strava (preserves the invite path
 *     after auth via localStorage cc_pendingInvite).
 *   - User authed → POST /api/clubs/join/:code; on 2xx setClub() in AppContext
 *     and redirect to /dashboard. On 404 surface "invite link not valid".
 */
export function JoinClub({ code }: JoinClubProps) {
  const navigate = useNavigate();
  const { setClub } = useAppContext();
  const join = useJoinClub();
  const [phase, setPhase] = useState<Phase>('checking-auth');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await ensureValidToken();
      if (cancelled) return;
      if (!tokens) {
        // Stash the code so we can resume after Strava OAuth completes.
        try { window.localStorage.setItem('cc_pendingInvite', code); } catch { /* swallow */ }
        setPhase('unauthed');
        return;
      }
      setPhase('joining');
      try {
        const club = await join.mutateAsync(code);
        if (cancelled) return;
        setClub({ id: club.id, name: club.name, role: club.role });
        setClubName(club.name);
        setPhase('success');
        try { window.localStorage.removeItem('cc_pendingInvite'); } catch { /* swallow */ }
        // Brief beat to let the user see the success state, then route.
        setTimeout(() => {
          if (!cancelled) navigate({ to: '/dashboard' });
        }, 900);
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : 'Could not join club.');
        setPhase('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className={styles.shell}>
      <TopBar variant="marketing" />
      <main id="main" className={styles.main}>
        <Container width="base">
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <Eyebrow rule tone="accent">Club invite</Eyebrow>
            {phase === 'checking-auth' && (
              <>
                <h1 className={styles.title}>Checking your <em>session</em>…</h1>
                <p className={styles.lede}>One moment.</p>
              </>
            )}
            {phase === 'unauthed' && (
              <>
                <h1 className={styles.title}>Connect Strava to <em>join</em>.</h1>
                <p className={styles.lede}>
                  Cadence Club uses Strava to authenticate. You'll be added to the
                  club after you connect.
                </p>
                <div className={styles.actions}>
                  <Button variant="primary" size="md" href={connectUrl()} withArrow>
                    Connect with Strava
                  </Button>
                </div>
              </>
            )}
            {phase === 'joining' && (
              <>
                <h1 className={styles.title}>Joining your <em>club</em>…</h1>
                <p className={styles.lede}>Validating the invite link.</p>
              </>
            )}
            {phase === 'success' && (
              <>
                <h1 className={styles.title}>
                  Welcome to <em>{clubName ?? 'the club'}</em>.
                </h1>
                <p className={styles.lede}>
                  Switching context now. Your dashboard is loading.
                </p>
              </>
            )}
            {phase === 'error' && (
              <>
                <h1 className={styles.title}>That <em>invite</em> didn't work.</h1>
                <p className={styles.lede}>
                  {errorMsg ?? 'The invite link is invalid or has expired.'}
                </p>
                <div className={styles.actions}>
                  <Button variant="secondary" size="md" href="/dashboard">
                    Go to your dashboard
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </Container>
      </main>
    </div>
  );
}
