import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { ZonePill } from '../components/ZonePill/ZonePill';
import { PmcStrip } from '../components/PmcStrip/PmcStrip';
import { ProgressRing } from '../components/ProgressRing/ProgressRing';
import { WorkoutCard } from '../components/WorkoutCard/WorkoutCard';
import { TopBar } from '../components/TopBar/TopBar';
import { BottomNav } from '../components/BottomNav/BottomNav';
import { Button } from '../components/Button/Button';
import { Card } from '../components/Card/Card';
import { StatTile } from '../components/StatTile/StatTile';
import { AiCoachCard } from '../components/AiCoachCard/AiCoachCard';
import { RideFeedbackPanel } from '../components/RideFeedback/RideFeedback';
import { StreakHeatmap } from '../components/StreakHeatmap/StreakHeatmap';
import { WinsTimeline } from '../components/WinsTimeline/WinsTimeline';
import { VolumeChart } from '../components/VolumeChart/VolumeChart';
import { RoutesPicker } from '../components/RoutesPicker/RoutesPicker';
import {
  MARCO,
  MOCK_ACTIVITIES,
  MOCK_PMC,
  MOCK_GOAL,
  MOCK_EVENT,
  TODAYS_WORKOUT,
  pmcWith7dDelta,
} from '../lib/mockMarco';
import { fmtDurationShort, fmtKm, fmtRelative, daysBetween } from '../lib/format';
import { connectUrl } from '../lib/connectUrl';
import { useApiKey } from '../hooks/useApiKey';
import { useTrainingPrefs } from '../hooks/useTrainingPrefs';
import { useAiReport } from '../hooks/useAiReport';
import { useRideFeedback } from '../hooks/useRideFeedback';
import { computeStats, recentForCoach, todayKey } from '../lib/coachUtils';
import { buildStreak } from '../lib/streak';
import { extractWins } from '../lib/wins';
import styles from './Dashboard.module.css';

export function Dashboard() {
  // P2 schema not migrated yet — when it is, replace these with hooks against
  // /api/athlete + /api/athlete/activities. For now: Marco's seeded mock so
  // the UI renders compelling content even with no Strava connection.
  const pmc = useMemo(() => pmcWith7dDelta(), []);
  const recents = useMemo(() => MOCK_ACTIVITIES.slice().reverse().slice(0, 8), []);
  const eventDaysOut = useMemo(() => daysBetween(new Date(), MOCK_EVENT.date), []);
  const weeklyTss = useMemo(() => MOCK_PMC.slice(-7).reduce((a, p) => a + p.tss, 0), []);
  const weeklyHours = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toISOString().slice(0, 10);
    const sec = MOCK_ACTIVITIES.filter((a) => a.date >= sinceISO).reduce(
      (s, a) => s + a.durationSec,
      0,
    );
    return sec / 3600;
  }, []);

  // Stats + recents in the shape the AI coach expects
  const coachStats = useMemo(
    () => computeStats(MOCK_ACTIVITIES, MOCK_GOAL.yearKm),
    [],
  );
  const coachRecent = useMemo(() => recentForCoach(MOCK_ACTIVITIES, 10), []);

  // Derived widgets
  const streak = useMemo(() => buildStreak(MOCK_ACTIVITIES), []);
  const wins = useMemo(() => extractWins(MOCK_ACTIVITIES), []);

  // BYOK + training prefs + AI report state
  const { key: apiKey, save: saveApiKey, clear: clearApiKey } = useApiKey();
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const aiReport = useAiReport();
  const rideFeedback = useRideFeedback();
  const [openFeedbackId, setOpenFeedbackId] = useState<number | null>(null);

  const todays = todayKey();
  const todaysAiText = aiReport.report?.weeklyPlan?.[todays];

  const handleGenerate = async () => {
    if (!apiKey) return;
    try {
      await aiReport.generate({
        apiKey,
        sessionsPerWeek: prefs.sessions_per_week,
        athlete: { firstname: MARCO.firstName },
        stats: coachStats,
        recent: coachRecent,
      });
    } catch {
      /* surfaced via aiReport.error */
    }
  };

  const handleAskRide = async (rideId: number, ride: typeof MOCK_ACTIVITIES[number]) => {
    if (!apiKey) return;
    setOpenFeedbackId(rideId);
    try {
      await rideFeedback.fetch(rideId, {
        apiKey,
        athlete: { firstname: MARCO.firstName },
        context: {
          totalRides: coachStats.rideCount,
          avgDistance: Math.round(coachStats.totalDistance / Math.max(coachStats.rideCount, 1)),
          longestRide: coachStats.longestRide,
          avgSpeed: coachStats.avgSpeed,
        },
        ride: {
          name: ride.name,
          distance_km: Math.round(ride.distanceKm * 10) / 10,
          duration_min: Math.round(ride.durationSec / 60),
          elevation_m: Math.round(ride.elevationM),
          avg_speed_kmh: Number(
            (ride.distanceKm / Math.max(ride.durationSec / 3600, 0.001)).toFixed(1),
          ),
          heartrate: ride.hr,
          pr_count: ride.prCount,
        },
      });
    } catch {
      /* error captured in rideFeedback.errors */
    }
  };

  return (
    <div className={styles.shell}>
      <TopBar
        variant="app"
        trailing={
          <>
            <span className={styles.userPill}>
              <span className={styles.userAvatar}>{MARCO.avatar}</span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>
                  {MARCO.firstName} {MARCO.lastName.charAt(0)}.
                </span>
                <span className={styles.userCity}>{MARCO.city}</span>
              </span>
            </span>
            <Button size="sm" variant="ghost" aria-label="Sync">
              ↻
            </Button>
          </>
        }
      />

      <main className={styles.main}>
        <Container width="wide">
          {/* HERO FOLD — primary glance */}
          <section id="today" className={styles.foldHero}>
            <motion.div
              className={styles.foldLeft}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
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
                  In sync
                </Pill>
              </div>
              <h1 className={styles.greet}>
                Morning, <em>{MARCO.firstName}</em>.
              </h1>
              <p className={styles.greetLede}>
                Form is <strong>productive</strong>.{' '}
                {pmc
                  ? `TSB at ${pmc.tsb > 0 ? '+' : ''}${Math.round(pmc.tsb)} — `
                  : ''}
                you're ready for a hard session today.
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
                <StatTile size="sm" label="Week TSS" value={weeklyTss} />
                <StatTile size="sm" label="Week hours" value={weeklyHours.toFixed(1)} unit="h" />
                <StatTile size="sm" label="FTP" value={MARCO.ftp} unit="W" />
                <StatTile size="sm" label="W/kg" value={(MARCO.ftp / MARCO.weight).toFixed(2)} />
              </div>
            </motion.div>

            <motion.aside
              className={styles.foldRight}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            >
              <Card tone="elev" pad="md" className={styles.eventCard}>
                <div className={styles.eventHead}>
                  <Eyebrow tone="accent">Goal event</Eyebrow>
                  <Pill tone="accent">{eventDaysOut > 0 ? `${eventDaysOut}d` : 'today'}</Pill>
                </div>
                <h3 className={styles.eventTitle}>{MOCK_EVENT.name}</h3>
                <p className={styles.eventSub}>
                  {MOCK_EVENT.type} · {MOCK_EVENT.location}
                </p>
                <div className={styles.eventStats}>
                  <div>
                    <span>{MOCK_EVENT.distanceKm}</span>
                    <span>km</span>
                  </div>
                  <div>
                    <span>{MOCK_EVENT.elevationM.toLocaleString()}</span>
                    <span>m vert</span>
                  </div>
                  <div>
                    <span>
                      {new Date(MOCK_EVENT.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span>date</span>
                  </div>
                </div>
              </Card>

              <Card tone="elev" pad="md" className={styles.goalCard}>
                <Eyebrow>Year-to-date · {new Date().getFullYear()}</Eyebrow>
                <div className={styles.goalRow}>
                  <ProgressRing
                    value={MOCK_GOAL.yearKm / MOCK_GOAL.goalKm}
                    size={140}
                    thickness={10}
                    eyebrow="km"
                    label={`of ${MOCK_GOAL.goalKm.toLocaleString()}`}
                  >
                    <span className={styles.goalNum}>{MOCK_GOAL.yearKm.toLocaleString()}</span>
                  </ProgressRing>
                  <div className={styles.goalNotes}>
                    <p>
                      <strong>{Math.round((MOCK_GOAL.yearKm / MOCK_GOAL.goalKm) * 100)}%</strong>{' '}
                      of yearly target.
                    </p>
                    <p className={styles.goalSub}>
                      Projected year-end:&nbsp;
                      <strong>
                        {Math.round(
                          (MOCK_GOAL.yearKm /
                            Math.max(daysBetween('2026-01-01', new Date()), 1)) *
                            365,
                        ).toLocaleString()}{' '}
                        km
                      </strong>
                      &nbsp;at current pace.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.aside>
          </section>

          {/* TODAY'S WORKOUT — uses AI plan if generated, else falls back to mock */}
          <motion.section
            className={styles.todaySection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.15 }}
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
              </Card>
            ) : (
              <WorkoutCard
                workout={TODAYS_WORKOUT}
                day="Thursday"
                badge="Today (sample)"
                onStart={() =>
                  alert('Generate your AI plan below to replace this sample workout with a real one.')
                }
              />
            )}
          </motion.section>

          {/* STREAK + WINS — momentum signals, two columns on desktop */}
          <motion.section
            className={styles.momentumSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className={styles.momentumGrid}>
              <StreakHeatmap data={streak} />
              <WinsTimeline wins={wins} limit={6} />
            </div>
          </motion.section>

          {/* VOLUME CHART — distance + elevation, weekly/monthly toggle */}
          <motion.section
            className={styles.volumeSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <VolumeChart rides={MOCK_ACTIVITIES} />
          </motion.section>

          {/* AI COACH — full panel: BYOK, sessions/week, weekly plan, regenerate */}
          <motion.section
            id="train"
            className={styles.aiSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <header className={styles.weekHead}>
              <Eyebrow rule tone="accent">№ 02 — AI Coach</Eyebrow>
              <h2 className={styles.h2}>
                Your <em>weekly plan</em>, computed.
              </h2>
              <p className={styles.h2Sub}>
                Bring your own Anthropic key. Each plan ≈ $0.02. Tells you what to ride, what to skip, why.
              </p>
            </header>
            <AiCoachCard
              apiKey={apiKey}
              report={aiReport.report}
              loading={aiReport.loading}
              error={aiReport.error}
              invalidKey={aiReport.invalidKey}
              sessionsPerWeek={prefs.sessions_per_week}
              onSetSessions={(n) => updatePrefs({ sessions_per_week: n })}
              onSetApiKey={saveApiKey}
              onClearApiKey={clearApiKey}
              onGenerate={handleGenerate}
              onClearReport={aiReport.clear}
            />
          </motion.section>

          {/* ROUTES PICKER — saved routes scored against today's plan + surface + start address */}
          <motion.section
            className={styles.routesSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <header className={styles.weekHead}>
              <Eyebrow rule tone="accent">№ 03 — Routes</Eyebrow>
              <h2 className={styles.h2}>
                Routes that <em>match the plan</em>.
              </h2>
              <p className={styles.h2Sub}>
                Saved Strava routes ranked against today's target zone, distance and your surface preference.
              </p>
            </header>
            <RoutesPicker
              todaysPlanText={todaysAiText}
              surface={prefs.surface_pref ?? 'any'}
              onSurfaceChange={(s) =>
                updatePrefs({ surface_pref: s === 'mixed' ? 'any' : s })
              }
              startAddress={prefs.start_address ?? ''}
              onStartAddressChange={(s) => updatePrefs({ start_address: s })}
            />
          </motion.section>

          {/* RECENTS — each ride has an inline coach-verdict panel */}
          <motion.section
            id="stats"
            className={styles.recentSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <header className={styles.weekHead}>
              <Eyebrow rule tone="accent">№ 03 — Recents</Eyebrow>
              <h2 className={styles.h2}>
                The last <em>eight rides</em>.
              </h2>
              <p className={styles.h2Sub}>
                Tap any ride for a one-line coach verdict + a concrete suggestion for next time.
              </p>
            </header>

            <div className={styles.rides}>
              {recents.map((r) => {
                const cached = rideFeedback.get(r.id);
                const open = openFeedbackId === r.id || !!cached;
                const isLoading = rideFeedback.loadingId === String(r.id);
                const error = rideFeedback.errors[String(r.id)];
                return (
                  <article key={r.id} className={styles.ride}>
                    <div className={styles.rideTop}>
                      <div className={styles.rideMain}>
                        <h4 className={styles.rideName}>{r.name}</h4>
                        <div className={styles.rideMeta}>
                          <ZonePill zone={r.primaryZone} size="sm" />
                          <span>{fmtRelative(r.date)}</span>
                          {r.type === 'VirtualRide' ? <Pill>Indoor</Pill> : null}
                          {r.prCount > 0 ? <Pill tone="accent">{r.prCount} PR</Pill> : null}
                        </div>
                      </div>
                      <div className={styles.rideStats}>
                        <span>
                          <strong>{fmtKm(r.distanceKm * 1000)}</strong> km
                        </span>
                        <span>
                          <strong>{fmtDurationShort(r.durationSec)}</strong>
                        </span>
                        <span>
                          <strong>{r.tss}</strong> TSS
                        </span>
                        <span>
                          <strong>{r.npWatts}</strong> NP
                        </span>
                      </div>
                    </div>
                    <div className={styles.rideActions}>
                      {open ? (
                        <RideFeedbackPanel
                          loading={isLoading}
                          {...(error !== undefined ? { error } : {})}
                          {...(cached !== undefined ? { feedback: cached } : {})}
                          onAsk={() => handleAskRide(r.id, r)}
                          disabled={!apiKey}
                        />
                      ) : (
                        <RideFeedbackPanel
                          loading={false}
                          onAsk={() => handleAskRide(r.id, r)}
                          disabled={!apiKey}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </motion.section>

          <DemoBanner />
        </Container>
      </main>

      <BottomNav />
    </div>
  );
}

function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className={styles.demoBanner} role="note">
      <Pill dot tone="warn">
        Demo
      </Pill>
      <p>
        You're viewing seeded demo data for <strong>Marco Bianchi</strong>. Connect your Strava to
        see your own PMC, plan and rides.
      </p>
      <Button size="sm" variant="primary" href={connectUrl()} withArrow>
        Connect
      </Button>
      <button
        className={styles.demoBannerClose}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
