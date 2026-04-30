import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { ConnectScreen } from './ConnectScreen';
import { LoadingScreen } from './LoadingScreen';
import { GoalEventCard } from '../components/GoalEventCard/GoalEventCard';
import { UserMenu } from '../components/UserMenu/UserMenu';
import { RideDetail } from '../components/RideDetail/RideDetail';
import { OnboardingModal } from '../components/OnboardingModal/OnboardingModal';
import { ClubCreateCard } from '../components/ClubCreateCard/ClubCreateCard';
import { ContextSwitcher } from '../components/ContextSwitcher/ContextSwitcher';
import { ClubDashboard } from '../components/ClubDashboard/ClubDashboard';
import { useAppContext } from '../lib/AppContext';
import { useClubsEnabled } from '../lib/featureFlags';
import { useGoalEvent } from '../hooks/useGoalEvent';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { AnimatePresence } from 'motion/react';
import {
  MARCO,
  MOCK_ACTIVITIES,
  MOCK_GOAL,
  TODAYS_WORKOUT,
  type MockActivity,
} from '../lib/mockMarco';
import { fmtDurationShort, fmtKm, fmtRelative, daysBetween } from '../lib/format';
import { connectUrl } from '../lib/connectUrl';
import { useApiKey } from '../hooks/useApiKey';
import { useTrainingPrefs } from '../hooks/useTrainingPrefs';
import { useAiReport } from '../hooks/useAiReport';
import { useRideFeedback } from '../hooks/useRideFeedback';
import { useRides } from '../hooks/useStravaData';
import { computeStats, recentForCoach, todayKey } from '../lib/coachUtils';
import { buildStreak } from '../lib/streak';
import { extractWins } from '../lib/wins';
import { computePmcDelta } from '../lib/pmc';
import { readTokens, clearTokens } from '../lib/auth';
import styles from './Dashboard.module.css';

export function Dashboard() {
  // Auth gate — checked once on mount, stable per page load.
  const tokens = useMemo(() => readTokens(), []);
  const isDemo = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );

  // No tokens, not demo → ConnectScreen. Mock data is dev/demo-only.
  if (!tokens && !isDemo) {
    return <ConnectScreen />;
  }

  return <DashboardInner usingMock={isDemo} />;
}

function DashboardInner({ usingMock }: { usingMock: boolean }) {
  const queryClient = useQueryClient();
  const profile = useAthleteProfile();
  const ftpForRides = usingMock ? MARCO.ftp : profile.profile.ftp ?? 0;
  const { rides: realRides, loading, error, athlete } = useRides({
    enabled: !usingMock,
    ftp: ftpForRides,
  });

  // Loading state on first authed fetch
  if (!usingMock && loading && realRides.length === 0) {
    return <LoadingScreen />;
  }

  // 401 / network error → fall back to a friendly reconnect screen.
  if (!usingMock && error) {
    return <ConnectScreen error={error.message} />;
  }

  const activities: MockActivity[] = usingMock ? MOCK_ACTIVITIES : realRides;
  const firstName = usingMock ? MARCO.firstName : athlete?.firstname ?? 'You';
  const lastName = usingMock ? MARCO.lastName : athlete?.lastname ?? '';
  const city = usingMock ? MARCO.city : athlete?.city ?? '';
  const profilePhoto = usingMock ? '' : athlete?.profile ?? '';
  const avatarInitials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase() || 'YOU';

  return (
    <>
      <DashboardView
        activities={activities}
        firstName={firstName}
        lastName={lastName}
        city={city}
        profilePhoto={profilePhoto}
        avatarInitials={avatarInitials}
        usingMock={usingMock}
        ftp={usingMock ? MARCO.ftp : profile.profile.ftp ?? 0}
        weight={usingMock ? MARCO.weight : profile.profile.weight ?? 0}
        onSync={() => {
          queryClient.invalidateQueries({ queryKey: ['athlete'] });
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }}
        onDisconnect={() => {
          clearTokens();
          if (typeof window !== 'undefined') window.location.href = '/';
        }}
        onEditProfile={() => profile.resetDismissal()}
      />
      <OnboardingModal
        open={!usingMock && profile.needsOnboarding}
        initial={profile.profile}
        onSave={({ ftp, weight, hrMax }) => {
          profile.save({ ftp, weight, hrMax });
        }}
        onSkip={profile.dismissOnboarding}
      />
    </>
  );
}

interface DashboardViewProps {
  activities: MockActivity[];
  firstName: string;
  lastName: string;
  city: string;
  profilePhoto: string;
  avatarInitials: string;
  usingMock: boolean;
  ftp: number;
  weight: number;
  onSync: () => void;
  onDisconnect: () => void;
  onEditProfile: () => void;
}

function DashboardView({
  activities,
  firstName,
  lastName,
  city,
  profilePhoto,
  avatarInitials,
  usingMock,
  ftp,
  weight,
  onSync,
  onDisconnect,
  onEditProfile,
}: DashboardViewProps) {
  const { scope } = useAppContext();
  const clubsEnabled = useClubsEnabled();
  // Kill-switch override: even if persisted scope says 'club', when the flag is
  // off we render the individual dashboard EXACTLY as today (CTO NOTE 5).
  const isClubMode = clubsEnabled && scope.mode === 'club' && scope.clubId != null;

  // Derived from the active activity set (mock or real)
  const pmc = useMemo(() => computePmcDelta(activities), [activities]);
  const recents = useMemo(
    () => activities.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [activities],
  );
  const goalEvent = useGoalEvent();

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

  // FTP & W/kg — captured from the onboarding modal (or Marco mock).
  const wPerKg = ftp && weight ? (ftp / weight).toFixed(2) : '—';

  const coachStats = useMemo(() => computeStats(activities, yearKm), [activities, yearKm]);
  const coachRecent = useMemo(() => recentForCoach(activities, 10), [activities]);

  const streak = useMemo(() => buildStreak(activities), [activities]);
  const wins = useMemo(() => extractWins(activities), [activities]);

  // BYOK + AI state
  const { key: apiKey, save: saveApiKey, clear: clearApiKey } = useApiKey();
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const aiReport = useAiReport();
  const rideFeedback = useRideFeedback();
  const [openFeedbackId, setOpenFeedbackId] = useState<number | null>(null);
  const [openDetailId, setOpenDetailId] = useState<number | null>(null);

  const todays = todayKey();
  const todaysAiText = aiReport.report?.weeklyPlan?.[todays];
  const greeting = greetingForHour(new Date().getHours());

  const handleGenerate = async () => {
    if (!apiKey) return;
    try {
      await aiReport.generate({
        apiKey,
        sessionsPerWeek: prefs.sessions_per_week,
        athlete: { firstname: firstName },
        stats: coachStats,
        recent: coachRecent,
      });
    } catch {
      /* surfaced via aiReport.error */
    }
  };

  const handleAskRide = async (rideId: number, ride: MockActivity) => {
    if (!apiKey) return;
    setOpenFeedbackId(rideId);
    try {
      await rideFeedback.fetch(rideId, {
        apiKey,
        athlete: { firstname: firstName },
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

  const yearGoalKm = MOCK_GOAL.goalKm;

  return (
    <div className={styles.shell}>
      <TopBar
        variant="app"
        trailing={
          <>
            <ContextSwitcher />
            <UserMenu
              username={`${firstName}${lastName ? ' ' + lastName : ''}`}
              onSync={onSync}
              onDisconnect={onDisconnect}
              onEditProfile={onEditProfile}
            >
              <span className={styles.userPill}>
                {profilePhoto ? (
                  <img src={profilePhoto} alt="" className={styles.userPhoto} />
                ) : (
                  <span className={styles.userAvatar}>{avatarInitials}</span>
                )}
                <span className={styles.userMeta}>
                  <span className={styles.userName}>
                    {firstName} {lastName.charAt(0)}
                    {lastName ? '.' : ''}
                  </span>
                  {city ? <span className={styles.userCity}>{city}</span> : null}
                </span>
              </span>
            </UserMenu>
          </>
        }
      />

      <main id="main" className={styles.main}>
        <Container width="wide">
          <ClubCreateCard />
          {isClubMode ? (
            <ClubDashboard
              clubId={scope.clubId as number}
              clubName={scope.clubName ?? 'Club'}
              role={scope.role ?? 'member'}
            />
          ) : (
          <>
          {/* HERO FOLD */}
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
                  {usingMock ? 'Demo data' : 'In sync'}
                </Pill>
              </div>
              <h1 className={styles.greet}>
                {greeting}, <em>{firstName}</em>.
              </h1>
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
            </motion.div>

            <motion.aside
              className={styles.foldRight}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            >
              <GoalEventCard
                event={goalEvent.event}
                onSave={goalEvent.save}
                onClear={goalEvent.clear}
              />

              <Card tone="elev" pad="md" className={styles.goalCard}>
                <Eyebrow>Year-to-date · {new Date().getFullYear()}</Eyebrow>
                <div className={styles.goalRow}>
                  <ProgressRing
                    value={Math.min(yearKm / yearGoalKm, 1)}
                    size={140}
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
            </motion.aside>
          </section>

          {/* TODAY'S WORKOUT */}
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
                day={todays.charAt(0).toUpperCase() + todays.slice(1)}
                badge="Sample · generate plan below"
                onStart={() => {
                  document.getElementById('train')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            )}
          </motion.section>

          {/* STREAK + WINS */}
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

          {/* VOLUME CHART */}
          <motion.section
            className={styles.volumeSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <VolumeChart rides={activities} />
          </motion.section>

          {/* AI COACH */}
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

          {/* ROUTES PICKER */}
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
              startAddress={prefs.start_address ?? city}
              onStartAddressChange={(s) => updatePrefs({ start_address: s })}
            />
          </motion.section>

          {/* RECENTS */}
          <motion.section
            id="stats"
            className={styles.recentSection}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <header className={styles.weekHead}>
              <Eyebrow rule tone="accent">№ 04 — Previous rides</Eyebrow>
              <h2 className={styles.h2}>
                The last <em>{recents.length} rides</em>.
              </h2>
              <p className={styles.h2Sub}>
                Tap any ride for the full breakdown — splits, segments, photos, polyline. Use
                "Get coach verdict" for a one-line AI assessment.
              </p>
            </header>

            {recents.length === 0 ? (
              <div className={styles.emptyRides}>
                <p>No rides yet. Once you log a ride on Strava it'll show up here.</p>
              </div>
            ) : (
              <div className={styles.rides}>
                {recents.map((r) => {
                  const cached = rideFeedback.get(r.id);
                  const fbOpen = openFeedbackId === r.id || !!cached;
                  const fbLoading = rideFeedback.loadingId === String(r.id);
                  const fbError = rideFeedback.errors[String(r.id)];
                  const detailOpen = openDetailId === r.id;
                  return (
                    <article key={r.id} className={styles.ride}>
                      <button
                        type="button"
                        className={styles.rideTop}
                        onClick={() => setOpenDetailId(detailOpen ? null : r.id)}
                        aria-expanded={detailOpen}
                        aria-label={`Toggle detail for ${r.name}`}
                      >
                        <div className={styles.rideMain}>
                          <h4 className={styles.rideName}>
                            {r.name}
                            <span className={`${styles.rideChev} ${detailOpen ? styles.rideChevOpen : ''}`} aria-hidden="true">
                              ›
                            </span>
                          </h4>
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
                            <strong>{r.npWatts || '—'}</strong> NP
                          </span>
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {detailOpen ? (
                          <RideDetail
                            key="detail"
                            rideId={r.id}
                            enabled={detailOpen}
                            {...(usingMock
                              ? {
                                  fallback: {
                                    name: r.name,
                                    distanceKm: r.distanceKm,
                                    durationSec: r.durationSec,
                                    elevationM: r.elevationM,
                                    avgWatts: r.avgWatts,
                                    npWatts: r.npWatts,
                                    hr: r.hr,
                                    tss: r.tss,
                                  },
                                }
                              : {})}
                          />
                        ) : null}
                      </AnimatePresence>

                      <div className={styles.rideActions}>
                        {fbOpen ? (
                          <RideFeedbackPanel
                            loading={fbLoading}
                            {...(fbError !== undefined ? { error: fbError } : {})}
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
            )}
          </motion.section>

          {usingMock ? <DemoBanner /> : null}

          {/* BottomNav scroll-anchor for the "You" tab — empty marker, no UI. */}
          <div id="you" aria-hidden="true" style={{ height: 1 }} />
          </>
          )}
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
      <p>You're viewing sample data. Connect Strava to see your own rides.</p>
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

function greetingForHour(h: number): string {
  if (h < 5) return 'Late night';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}
