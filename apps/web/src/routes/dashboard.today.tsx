import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { StatTile } from '../components/StatTile/StatTile';
import { Card } from '../components/Card/Card';
import { ProgressRing } from '../components/ProgressRing/ProgressRing';
import { PmcStrip } from '../components/PmcStrip/PmcStrip';
import { TodayDossier } from '../components/TodayDossier/TodayDossier';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useRides } from '../hooks/useStravaData';
import { computePmcDelta } from '../lib/pmc';
import { daysBetween } from '../lib/format';
import { readTokens } from '../lib/auth';
import { MARCO, MOCK_ACTIVITIES, MOCK_GOAL } from '../lib/mockMarco';
import styles from './TabShared.module.css';

export const Route = createFileRoute('/dashboard/today')({
  component: TodayTab,
});


function TodayTab() {
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
  const { rides: realRides } = useRides({
    enabled: !usingMock,
    ftp: ftpForRides,
  });

  const activities = usingMock ? MOCK_ACTIVITIES : realRides;
  const ftp = usingMock ? MARCO.ftp : profile.profile.ftp ?? 0;
  const weight = usingMock ? MARCO.weight : profile.profile.weight ?? 0;

  const pmc = useMemo(() => computePmcDelta(activities), [activities]);

  const weeklyStats = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString().slice(0, 10);
    const window = activities.filter((a) => a.date >= sinceISO);
    return {
      tss: window.reduce((a, r) => a + r.tss, 0),
      hours: window.reduce((a, r) => a + r.durationSec, 0) / 3600,
    };
  }, [activities]);

  const yearKm = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    return activities.filter((a) => a.date >= yearStart).reduce((s, a) => s + a.distanceKm, 0);
  }, [activities]);

  const wPerKg = ftp && weight ? (ftp / weight).toFixed(2) : '—';
  const yearGoalKm = MOCK_GOAL.goalKm;

  return (
    <div className={styles.tabRoot}>
      <Container width="wide">
        {/* v10.3.0 — Greeting + sync chip + streak moved to dashboard.tsx
            layout (above TopTabs). Today now opens with the form lede +
            PMC strip + KPI tiles, no duplicate salutation. */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <Eyebrow rule tone="accent">
            Today ·{' '}
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Eyebrow>

          <p className={styles.greetLede}>
            {pmc ? (
              <>
                Form is{' '}
                <strong>
                  {pmc.tsb > 5 ? 'fresh' : pmc.tsb < -15 ? 'overreached' : pmc.tsb < -5 ? 'fatigued' : 'productive'}
                </strong>
                . TSB at {pmc.tsb > 0 ? '+' : ''}
                {Math.round(pmc.tsb)} —{' '}
                {pmc.tsb > 5
                  ? 'great day to test the legs.'
                  : pmc.tsb < -15
                    ? 'recover hard before the next session.'
                    : pmc.tsb < -5
                      ? 'easier session today, full effort tomorrow.'
                      : 'ready for a hard session today.'}
              </>
            ) : (
              <>Welcome back. Generate your AI plan to get a structured week.</>
            )}
          </p>

          {pmc ? (
            <PmcStrip
              ctl={pmc.ctl}
              atl={pmc.atl}
              tsb={pmc.tsb}
              ctlDelta={pmc.ctlDelta}
              atlDelta={pmc.atlDelta}
              tsbDelta={pmc.tsbDelta}
            />
          ) : null}

          <div className={styles.quickStats}>
            <StatTile size="sm" label="Week TSS" value={Math.round(weeklyStats.tss)} />
            <StatTile size="sm" label="Week hours" value={weeklyStats.hours.toFixed(1)} unit="h" />
            <StatTile size="sm" label="FTP" value={ftp || '—'} unit={ftp ? 'W' : ''} />
            <StatTile size="sm" label="W/kg" value={wPerKg} />
          </div>
          {!ftp ? (
            <p className={styles.proxyNote}>
              TSS is a duration-based proxy until you set FTP. PMC math turns real once FTP is captured.
            </p>
          ) : null}
        </motion.section>

        {/* v9.12.9 — Today's dossier: today-only summary aggregated from
            personal sessions + club rides. Read-only here; planning lives
            on Train, browsing the full calendar on Schedule. */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        >
          <TodayDossier />
        </motion.section>

        {/* YEAR FORECAST BAR (static 8000 km — AI forecast in #49, Sprint 2) */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
          <Card tone="elev" pad="md" className={styles.goalCard}>
            <Eyebrow>Year-to-date · {new Date().getFullYear()}</Eyebrow>
            <div className={styles.goalRow}>
              <ProgressRing
                value={Math.min(yearKm / yearGoalKm, 1)}
                size={120}
                thickness={10}
                eyebrow="km"
                label={`of ${yearGoalKm.toLocaleString()}`}
              >
                <span className={styles.goalNum}>{Math.round(yearKm).toLocaleString()}</span>
              </ProgressRing>
              <div className={styles.goalNotes}>
                <p>
                  <strong>{Math.round((yearKm / yearGoalKm) * 100)}%</strong> of yearly target.
                </p>
                <p className={styles.goalSub}>
                  Projected year-end:&nbsp;
                  <strong>
                    {Math.round(
                      (yearKm /
                        Math.max(daysBetween(`${new Date().getFullYear()}-01-01`, new Date()), 1)) *
                        365,
                    ).toLocaleString()}{' '}
                    km
                  </strong>
                  &nbsp;at current pace.
                </p>
              </div>
            </div>
          </Card>
        </motion.section>
      </Container>
    </div>
  );
}
