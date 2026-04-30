import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useApiKey } from '../hooks/useApiKey';
import { useRides } from '../hooks/useStravaData';
import { readTokens } from '../lib/auth';
import { connectUrl } from '../lib/connectUrl';
import { MARCO } from '../lib/mockMarco';
import styles from './TabShared.module.css';

export const Route = createFileRoute('/dashboard/you')({
  component: YouTab,
});

function YouTab() {
  const tokens = readTokens();
  const isDemo = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );
  const usingMock = !tokens || isDemo;

  const profile = useAthleteProfile();
  const ftpForRides = usingMock ? MARCO.ftp : profile.profile.ftp ?? 0;
  const { athlete } = useRides({
    enabled: !usingMock,
    ftp: ftpForRides,
  });

  const firstName = usingMock ? MARCO.firstName : athlete?.firstname ?? 'You';
  const lastName = usingMock ? MARCO.lastName : athlete?.lastname ?? '';
  const ftp = usingMock ? MARCO.ftp : profile.profile.ftp ?? 0;
  const weight = usingMock ? MARCO.weight : profile.profile.weight ?? 0;
  const hrMax = usingMock ? MARCO.hrMax : profile.profile.hrMax ?? 0;

  const { key: apiKey, save: saveApiKey, clear: clearApiKey } = useApiKey();

  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [showKey, setShowKey] = useState(false);

  const stravaConnected = !!tokens && !usingMock;

  return (
    <div className={styles.tabRoot}>
      <Container width="wide">
        <h1 className={styles.tabHeading}>You</h1>

        {/* PROFILE STATS */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <Card tone="elev" pad="md">
            <Eyebrow rule tone="accent">Training profile</Eyebrow>
            {!ftp && !weight && !hrMax ? (
              <p className={styles.emptyInline}>
                No training data saved yet. Open the profile editor from the top-right menu to set your FTP, weight, and HR Max.
              </p>
            ) : (
              <dl className={styles.profileGrid}>
                <div className={styles.profileItem}>
                  <dt className={styles.profileLabel}>Name</dt>
                  <dd className={styles.profileValue}>
                    {firstName} {lastName}
                  </dd>
                </div>
                <div className={styles.profileItem}>
                  <dt className={styles.profileLabel}>FTP</dt>
                  <dd className={styles.profileValue}>{ftp ? `${ftp} W` : '—'}</dd>
                </div>
                <div className={styles.profileItem}>
                  <dt className={styles.profileLabel}>Weight</dt>
                  <dd className={styles.profileValue}>{weight ? `${weight} kg` : '—'}</dd>
                </div>
                <div className={styles.profileItem}>
                  <dt className={styles.profileLabel}>HR Max</dt>
                  <dd className={styles.profileValue}>{hrMax ? `${hrMax} bpm` : '—'}</dd>
                </div>
                {ftp && weight ? (
                  <div className={styles.profileItem}>
                    <dt className={styles.profileLabel}>W/kg</dt>
                    <dd className={styles.profileValue}>{(ftp / weight).toFixed(2)}</dd>
                  </div>
                ) : null}
              </dl>
            )}
          </Card>
        </motion.section>

        {/* ANTHROPIC API KEY */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        >
          <Card tone="elev" pad="md">
            <Eyebrow rule tone="accent">AI Coach · Anthropic key</Eyebrow>
            {apiKey ? (
              <div className={styles.apiKeyRow}>
                <p className={styles.apiKeySet}>
                  Key saved.{' '}
                  <button
                    type="button"
                    className={styles.subtleBtn}
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </p>
                {showKey ? (
                  <p className={styles.apiKeyMono}>{apiKey}</p>
                ) : null}
                <button
                  type="button"
                  className={styles.subtleBtn}
                  onClick={clearApiKey}
                >
                  Remove key
                </button>
              </div>
            ) : (
              <form
                className={styles.apiKeyForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (apiKeyDraft.trim()) {
                    saveApiKey(apiKeyDraft.trim());
                    setApiKeyDraft('');
                  }
                }}
              >
                <p className={styles.apiKeyHint}>
                  AI coaching is bring-your-own-key. Each plan costs ≈ $0.02. Your key stays in this browser.{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    Get a key →
                  </a>
                </p>
                <input
                  type="password"
                  className={styles.apiKeyInput}
                  placeholder="sk-ant-..."
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  aria-label="Anthropic API key"
                />
                <Button type="submit" variant="primary" size="md" disabled={!apiKeyDraft.trim()}>
                  Save key
                </Button>
              </form>
            )}
          </Card>
        </motion.section>

        {/* STRAVA CONNECTION STATUS */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
          <Card tone="elev" pad="md">
            <Eyebrow rule tone="accent">Strava</Eyebrow>
            {stravaConnected ? (
              <p className={styles.stravaConnected}>
                Connected — syncing your rides automatically.
              </p>
            ) : (
              <div className={styles.stravaDisconnected}>
                <p>Not connected. Link your Strava account to pull real ride data.</p>
                <Button variant="primary" size="md" href={connectUrl()} withArrow>
                  Connect Strava
                </Button>
              </div>
            )}
          </Card>
        </motion.section>
      </Container>
    </div>
  );
}
