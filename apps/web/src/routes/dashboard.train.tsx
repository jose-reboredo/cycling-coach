import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { AiCoachCard } from '../components/AiCoachCard/AiCoachCard';
import { GoalEventCard } from '../components/GoalEventCard/GoalEventCard';
import { useApiKey } from '../hooks/useApiKey';
import { useTrainingPrefs } from '../hooks/useTrainingPrefs';
import { useAiReport } from '../hooks/useAiReport';
import { useGoalEvent } from '../hooks/useGoalEvent';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useCreatePlannedSession } from '../hooks/useClubs';
import { useRides } from '../hooks/useStravaData';
import { readTokens } from '../lib/auth';
import { computeStats, recentForCoach, todayKey } from '../lib/coachUtils';
import { parseAiSession } from '../lib/aiSession';
import { MARCO, MOCK_ACTIVITIES } from '../lib/mockMarco';
import styles from './TabShared.module.css';

export const Route = createFileRoute('/dashboard/train')({
  component: TrainTab,
});

function TrainTab() {
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

  const { key: apiKey, save: saveApiKey, clear: clearApiKey } = useApiKey();
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const aiReport = useAiReport();
  const goalEvent = useGoalEvent();

  const coachStats = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const yearKm = activities.filter((a) => a.date >= yearStart).reduce((s, a) => s + a.distanceKm, 0);
    return computeStats(activities, yearKm);
  }, [activities]);
  const coachRecent = useMemo(() => recentForCoach(activities, 10), [activities]);

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

  // v9.12.9 — push today's row from the AI weekly plan onto the personal
  // scheduler. The Today tab's TodayDossier reads /api/me/schedule and
  // surfaces this session immediately. Resets when a new plan is generated.
  const createPlannedSession = useCreatePlannedSession();
  const [scheduleTodayDone, setScheduleTodayDone] = useState(false);
  const [scheduleTodayError, setScheduleTodayError] = useState<string | null>(null);
  const handleScheduleToday = () => {
    const todayDayKey = todayKey();
    const text = aiReport.report?.weeklyPlan?.[todayDayKey];
    if (!text || createPlannedSession.isPending) return;
    setScheduleTodayError(null);
    const parsed = parseAiSession(text);
    const today = new Date();
    today.setHours(18, 0, 0, 0); // sensible default — user can edit via drawer.
    createPlannedSession.mutate(
      {
        title: parsed.title,
        session_date: Math.floor(today.getTime() / 1000),
        description: text,
        ...(parsed.zone != null ? { zone: parsed.zone } : {}),
        duration_minutes: parsed.durationMin ?? 60,
        ...(parsed.watts != null ? { target_watts: parsed.watts } : {}),
        source: 'ai-coach',
      },
      {
        onSuccess: () => setScheduleTodayDone(true),
        onError: (err) =>
          setScheduleTodayError(err instanceof Error ? err.message : 'Could not add to schedule.'),
      },
    );
  };

  return (
    <div className={styles.tabRoot}>
      <Container width="wide">
        <h1 className={styles.tabHeading}>Your weekly plan</h1>

        {/* GOAL / EVENT CARD */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {goalEvent.event ? (
            <GoalEventCard
              event={goalEvent.event}
              onSave={goalEvent.save}
              onClear={goalEvent.clear}
            />
          ) : (
            <div className={styles.emptyState}>
              <p>No goal event set yet. Add a target race or event to start planning.</p>
              <GoalEventCard
                event={null}
                onSave={goalEvent.save}
                onClear={goalEvent.clear}
              />
            </div>
          )}
        </motion.section>

        {/* AI COACH / WEEKLY PLAN */}
        <motion.section
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        >
          {!apiKey && !aiReport.report ? (
            <div className={styles.emptyState}>
              <p>
                Add your Anthropic API key below to generate a personalised weekly training plan.
                Each plan costs ≈ $0.02.
              </p>
            </div>
          ) : null}
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
            onGenerate={() => {
              setScheduleTodayDone(false);
              setScheduleTodayError(null);
              return handleGenerate();
            }}
            onClearReport={() => {
              setScheduleTodayDone(false);
              setScheduleTodayError(null);
              aiReport.clear();
            }}
            onScheduleToday={handleScheduleToday}
            scheduleTodayPending={createPlannedSession.isPending}
            scheduleTodayDone={scheduleTodayDone}
            scheduleTodayError={scheduleTodayError}
          />
        </motion.section>
      </Container>
    </div>
  );
}
