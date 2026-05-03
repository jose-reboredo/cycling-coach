import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Container } from '../components/Container/Container';
import { AiCoachCard } from '../components/AiCoachCard/AiCoachCard';
import { AiPlanCard } from '../components/AiPlanCard/AiPlanCard';
import { GoalEventCard } from '../components/GoalEventCard/GoalEventCard';
import {
  SessionPrefillModal,
  type SessionPrefillData,
  type SessionPrefillResult,
} from '../components/SessionPrefillModal/SessionPrefillModal';
import { useApiKey } from '../hooks/useApiKey';
import { useTrainingPrefs } from '../hooks/useTrainingPrefs';
import { useAiReport } from '../hooks/useAiReport';
import { useGoalEvent } from '../hooks/useGoalEvent';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useCreatePlannedSession } from '../hooks/useClubs';
import { useRides } from '../hooks/useStravaData';
import { readTokens } from '../lib/auth';
import { computeStats, recentForCoach } from '../lib/coachUtils';
import { DAY_KEYS, type DayName } from '../lib/coachApi';
import { parseAiSession } from '../lib/aiSession';
import { MARCO, MOCK_ACTIVITIES } from '../lib/mockMarco';
import styles from './TabShared.module.css';

export const Route = createFileRoute('/dashboard/train')({
  component: TrainTab,
});

/** v10.1.0 — Resolves a DayName (monday..sunday) to the next-occurrence
 *  Date from today (inclusive). Today's day → today; past days → next
 *  week's matching day. Treats the AI weekly plan as forward-looking so
 *  users always schedule into the future, never backfill into the past. */
function dateForWeekday(day: DayName): Date {
  const targetIdx = DAY_KEYS.indexOf(day); // 0=Mon ... 6=Sun
  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7; // JS Sun=0 → normalize Mon=0
  let daysAhead = targetIdx - todayIdx;
  if (daysAhead < 0) daysAhead += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysAhead);
  return target;
}

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

  // v10.2.0 — per-day click on the AI weekly plan opens a prefill modal
  // instead of POSTing immediately. The user reviews title / date / time /
  // duration / zone / watts before saving. Distance-based duration estimates
  // are surfaced with an "Estimated" hint so the user knows to verify.
  // Per-day idle/pending/done state is preserved so the WeekPlan day-row
  // button still shows "+ Schedule" / "…" / "✓".
  const createPlannedSession = useCreatePlannedSession();
  const [dayStates, setDayStates] = useState<Partial<Record<DayName, 'idle' | 'pending' | 'done'>>>({});
  const [scheduleDayError, setScheduleDayError] = useState<string | null>(null);
  const [prefillModal, setPrefillModal] = useState<{
    day: DayName;
    data: SessionPrefillData;
  } | null>(null);

  const handleScheduleDay = (day: DayName) => {
    const text = aiReport.report?.weeklyPlan?.[day];
    if (!text) return;
    const parsed = parseAiSession(text);
    const target = dateForWeekday(day);
    const dateStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    setScheduleDayError(null);
    setPrefillModal({
      day,
      data: {
        title: parsed.title,
        dateStr,
        timeStr: '18:00', // user can change in modal
        zone: parsed.zone,
        durationHours: parsed.durationMin != null ? parsed.durationMin / 60 : null,
        watts: parsed.watts,
        description: text,
        durationEstimated: parsed.durationEstimated,
        distanceKm: parsed.distanceKm,
      },
    });
  };

  const handlePrefillSave = (result: SessionPrefillResult) => {
    if (!prefillModal) return;
    const day = prefillModal.day;
    setScheduleDayError(null);
    setDayStates((prev) => ({ ...prev, [day]: 'pending' }));
    createPlannedSession.mutate(
      {
        title: result.title,
        session_date: result.sessionDate,
        description: result.description,
        ...(result.zone != null ? { zone: result.zone } : {}),
        duration_minutes: result.durationMin,
        ...(result.watts != null ? { target_watts: result.watts } : {}),
        source: 'ai-coach',
      },
      {
        onSuccess: () => {
          setDayStates((prev) => ({ ...prev, [day]: 'done' }));
          setPrefillModal(null);
        },
        onError: (err) => {
          setDayStates((prev) => ({ ...prev, [day]: 'idle' }));
          setScheduleDayError(err instanceof Error ? err.message : 'Could not add to schedule.');
        },
      },
    );
  };

  const resetDayStates = () => {
    setDayStates({});
    setScheduleDayError(null);
    setPrefillModal(null);
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

        {/* Sprint 14 / v11.3.0 — section order is API-key-aware.
         *
         *  - No API key set → AI Coach card (key entry) renders FIRST
         *    so users see the call-to-action before the goal-driven plan
         *    they can't yet use. Founder feedback.
         *  - Has API key → Goal-driven plan FIRST (the primary surface),
         *    then AI Coach card (legacy weekly-plan). */}

        {!apiKey ? (
          <>
            <motion.section
              className={styles.section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
            >
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
                  resetDayStates();
                  return handleGenerate();
                }}
                onClearReport={() => {
                  resetDayStates();
                  aiReport.clear();
                }}
                onScheduleDay={handleScheduleDay}
                scheduleDayStates={dayStates}
                scheduleDayError={scheduleDayError}
              />
            </motion.section>

            <motion.section
              className={styles.section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            >
              <AiPlanCard />
            </motion.section>
          </>
        ) : (
          <>
            {/* v10.8.0 — Goal-driven AI plan card. System-paid Haiku generation;
                reads goal + recent rides + user prefs from D1; persists to
                ai_plan_sessions. */}
            <motion.section
              className={styles.section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
            >
              <AiPlanCard />
            </motion.section>

            <motion.section
              className={styles.section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
            >
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
                  resetDayStates();
                  return handleGenerate();
                }}
                onClearReport={() => {
                  resetDayStates();
                  aiReport.clear();
                }}
                onScheduleDay={handleScheduleDay}
                scheduleDayStates={dayStates}
                scheduleDayError={scheduleDayError}
              />
            </motion.section>
          </>
        )}
      </Container>

      {/* v10.2.0 — review-and-confirm modal opened by per-day "+ Schedule".
          User adjusts time, duration, etc. before save. Modal handles its
          own form state; on save, dashboard.train.tsx fires the mutation. */}
      <SessionPrefillModal
        open={prefillModal !== null}
        prefill={prefillModal?.data ?? null}
        onClose={() => setPrefillModal(null)}
        onSave={handlePrefillSave}
        isPending={createPlannedSession.isPending}
        error={scheduleDayError}
      />
    </div>
  );
}
