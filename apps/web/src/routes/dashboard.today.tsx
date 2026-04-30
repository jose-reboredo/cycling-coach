import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { StatTile } from '../components/StatTile/StatTile';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Button/Button';
import { WorkoutCard } from '../components/WorkoutCard/WorkoutCard';
import { ProgressRing } from '../components/ProgressRing/ProgressRing';
import { PmcStrip } from '../components/PmcStrip/PmcStrip';
import {
  RoutesPicker,
  routeKey,
  type SelectableRoute,
} from '../components/RoutesPicker/RoutesPicker';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useAiReport } from '../hooks/useAiReport';
import { useRides } from '../hooks/useStravaData';
import { useTrainingPrefs } from '../hooks/useTrainingPrefs';
import { computePmcDelta } from '../lib/pmc';
import { todayKey } from '../lib/coachUtils';
import { daysBetween } from '../lib/format';
import { readTokens } from '../lib/auth';
import {
  MARCO,
  MOCK_ACTIVITIES,
  MOCK_GOAL,
  TODAYS_WORKOUT,
} from '../lib/mockMarco';
import styles from './TabShared.module.css';

// ---------------------------------------------------------------------------
// Derive today's session signals from the AI plan text — distance band,
// terrain, intent. Powers the saved-route filter and the AI discover prompt.
// ---------------------------------------------------------------------------
function deriveTodaysSession(text: string | undefined): {
  intent: string;
  target_km: number;
  difficulty: 'flat' | 'rolling' | 'hilly';
} | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();

  let target_km: number | undefined;
  const km = t.match(/(\d{1,3})\s*km/);
  if (km && km[1]) target_km = parseInt(km[1], 10);
  if (!target_km) {
    const hr = t.match(/(\d+)\s*h(\d{1,2})?/);
    if (hr && hr[1]) {
      const h = parseInt(hr[1], 10);
      const m = hr[2] ? parseInt(hr[2], 10) : 0;
      target_km = Math.round((h + m / 60) * 25);
    } else {
      const min = t.match(/(\d{2,3})\s*min/);
      if (min && min[1]) target_km = Math.round((parseInt(min[1], 10) / 60) * 25);
    }
  }
  if (!target_km) target_km = /long\s*ride/.test(t) ? 80 : /tempo|interval/.test(t) ? 35 : 40;

  let difficulty: 'flat' | 'rolling' | 'hilly' = 'rolling';
  if (/recovery|easy|gentle|conversational/.test(t)) difficulty = 'flat';
  else if (/hill|climb/.test(t)) difficulty = 'hilly';

  return { intent: text, target_km, difficulty };
}

function startStravaForRoute(route: SelectableRoute) {
  if (route.source === 'strava' && route.strava_url) {
    window.open(route.strava_url, '_blank', 'noopener,noreferrer');
  } else {
    // AI routes have no Strava ID — open the create-route page so the user
    // can plan it before recording. Universal links jump to app on mobile.
    window.open('https://www.strava.com/athlete/routes/new', '_blank', 'noopener,noreferrer');
  }
}

export const Route = createFileRoute('/dashboard/today')({
  component: TodayTab,
});

function greetingForHour(h: number): string {
  if (h < 5) return 'Late night';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

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
  const { rides: realRides, athlete } = useRides({
    enabled: !usingMock,
    ftp: ftpForRides,
  });

  const activities = usingMock ? MOCK_ACTIVITIES : realRides;
  const firstName = usingMock ? MARCO.firstName : athlete?.firstname ?? 'You';
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

  const aiReport = useAiReport();
  const todays = todayKey();
  const todaysAiText = aiReport.report?.weeklyPlan?.[todays];
  const greeting = greetingForHour(new Date().getHours());

  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const [selectedRoute, setSelectedRoute] = useState<SelectableRoute | null>(null);
  const todaysSession = useMemo(() => deriveTodaysSession(todaysAiText), [todaysAiText]);

  return (
    <div className={styles.tabRoot}>
      <Container width="wide">
        <h1 className={styles.tabHeading}>Today</h1>

        {/* GREETING + KPI TILES */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className={styles.greetRow}>
            <Eyebrow rule tone="accent">
              Today ·{' '}
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Eyebrow>
            <Pill dot tone="success">
              {usingMock ? 'Demo data' : 'In sync'}
            </Pill>
          </div>

          <h2 className={styles.greet}>
            {greeting}, <em>{firstName}</em>.
          </h2>
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

        {/* TODAY'S PLANNED RIDE */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        >
          {todaysAiText ? (
            <Card tone="elev" pad="lg" rule>
              <header className={styles.todayHead}>
                <Eyebrow tone="accent">
                  Today · {todays.charAt(0).toUpperCase() + todays.slice(1)}
                </Eyebrow>
                <Pill tone="accent">From your plan</Pill>
              </header>
              <p className={styles.todayText}>{todaysAiText}</p>

              <div className={styles.sessionRoutes}>
                <RoutesPicker
                  todaysSession={todaysSession}
                  surface={prefs.surface_pref ?? 'any'}
                  onSurfaceChange={(s) => updatePrefs({ surface_pref: s })}
                  startAddress={prefs.start_address ?? ''}
                  onStartAddressChange={(s) => updatePrefs({ start_address: s })}
                  onRouteSelected={setSelectedRoute}
                  selectedRouteKey={selectedRoute ? routeKey(selectedRoute) : null}
                />
              </div>

              <div className={styles.startWorkoutRow}>
                <Button
                  size="lg"
                  variant="primary"
                  disabled={!selectedRoute}
                  onClick={() => selectedRoute && startStravaForRoute(selectedRoute)}
                >
                  {selectedRoute ? 'Start workout in Strava ↗' : 'Pick a route to start'}
                </Button>
              </div>
            </Card>
          ) : (
            <WorkoutCard
              workout={TODAYS_WORKOUT}
              day={todays.charAt(0).toUpperCase() + todays.slice(1)}
              badge="Sample · generate plan in Train tab"
              onStart={() => {
                // No AI plan yet — direct user to Train tab to generate one.
              }}
            />
          )}
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
