// AiPlanCard — Sprint 5++ / v10.8.0 Phase A.
// Goal-driven AI training plan card on Train tab. Reads /api/plan/current,
// renders a list of sessions with "+ Schedule" buttons. Clicking schedule
// opens the existing SessionPrefillModal (reused from v10.2.0+) with fields
// prefilled from the AI plan row.

import { useEffect, useState } from 'react';
import { Button } from '../Button/Button';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import {
  generatePlan,
  fetchCurrentPlan,
  fetchStravaAuthStatus,
  schedulePlanSession,
  type AiPlanSession,
  type AlternativeGoal,
} from '../../lib/aiPlanApi';
import {
  SessionPrefillModal,
  type SessionPrefillData,
  type SessionPrefillResult,
} from '../SessionPrefillModal/SessionPrefillModal';
import styles from './AiPlanCard.module.css';

const ZONE_TO_PILL_TONE: Record<string, 'accent' | 'success' | 'warn' | 'neutral'> = {
  Recovery: 'success',
  Z1: 'success',
  Z2: 'success',
  Z3: 'accent',
  Z4: 'accent',
  Z5: 'warn',
  Z6: 'warn',
  Z7: 'warn',
};

export function AiPlanCard() {
  const [sessions, setSessions] = useState<AiPlanSession[] | null>(null);
  const [feasibility, setFeasibility] = useState<{ blocked: boolean; reason?: string; alternative?: AlternativeGoal | null }>({ blocked: false });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<number>>(new Set());
  const [prefillModal, setPrefillModal] = useState<{ aiId: number; data: SessionPrefillData } | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [autoUpdates, setAutoUpdates] = useState<boolean | null>(null);

  // v10.9.0 — query server-side Strava auth status. `true` → webhooks
  // will auto-regenerate the plan when new activities arrive.
  useEffect(() => {
    let cancelled = false;
    fetchStravaAuthStatus()
      .then((s) => { if (!cancelled) setAutoUpdates(s.server_side); })
      .catch(() => { if (!cancelled) setAutoUpdates(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCurrentPlan()
      .then((res) => {
        if (cancelled) return;
        if (res.feasible) {
          setSessions(res.plan.sessions);
          setFeasibility({ blocked: false });
        } else {
          setFeasibility({ blocked: true, reason: res.block_reason, alternative: res.alternative_goal });
          setSessions([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.message === 'no_plan') {
          setSessions([]);
        } else {
          setError(err instanceof Error ? err.message : 'Could not load plan');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleGenerate = async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await generatePlan({ weeks: 4, force });
      if (res.feasible) {
        setSessions(res.plan.sessions);
        setFeasibility({ blocked: false });
        setScheduledIds(new Set());
      } else {
        setFeasibility({ blocked: true, reason: res.block_reason, alternative: res.alternative_goal });
        setSessions([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate plan';
      if (msg === 'system_anthropic_key_missing') {
        setError('AI plan service is temporarily disabled. Try again later.');
      } else if (msg === 'rate-limited') {
        setError('Too many regenerations. Wait an hour and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleScheduleClick = (s: AiPlanSession) => {
    const zoneInt = s.target_zone && /^Z[1-7]$/.test(s.target_zone) ? Number(s.target_zone[1]) : null;
    setPrefillModal({
      aiId: s.id,
      data: {
        title: s.title,
        dateStr: s.suggested_date,
        timeStr: '07:00',
        zone: zoneInt,
        durationHours: s.duration != null ? Math.round((s.duration / 60) * 2) / 2 : null,
        watts: null,
        description: s.reasoning ?? '',
        durationEstimated: false,
        distanceKm: null,
      },
    });
  };

  const handlePrefillSave = async (result: SessionPrefillResult) => {
    if (!prefillModal) return;
    setScheduling(true);
    try {
      await schedulePlanSession({
        ai_plan_session_id: prefillModal.aiId,
        session_date: result.sessionDate,
        overrides: {
          title: result.title,
          duration_minutes: result.durationMin,
          target_zone: result.zone != null ? `Z${result.zone}` : undefined,
        },
      });
      setScheduledIds((prev) => {
        const next = new Set(prev);
        next.add(prefillModal.aiId);
        return next;
      });
      setPrefillModal(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not schedule.';
      if (msg === 'already_scheduled') {
        setScheduledIds((prev) => {
          const next = new Set(prev);
          next.add(prefillModal.aiId);
          return next;
        });
        setPrefillModal(null);
      } else {
        setError(msg);
      }
    } finally {
      setScheduling(false);
    }
  };

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <Eyebrow rule tone="accent">Goal-driven plan</Eyebrow>
        <div className={styles.headRight}>
          {/* v10.9.0 — Auto-updates badge. Visible when the athlete has
              migrated to server-side Strava tokens; means new rides will
              trigger a webhook → fire-and-forget plan regeneration. */}
          {autoUpdates && <Pill tone="success">Auto-updates ON</Pill>}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleGenerate(false)}
            disabled={generating}
          >
            {generating ? 'Generating…' : sessions && sessions.length > 0 ? 'Regenerate' : 'Generate plan'}
          </Button>
        </div>
      </header>

      {loading && <p className={styles.empty}>Loading your plan…</p>}

      {error && <p className={styles.error} role="alert">{error}</p>}

      {feasibility.blocked && (
        <div className={styles.blocked}>
          <p className={styles.blockedTitle}>Goal currently unrealistic</p>
          <p className={styles.blockedReason}>{feasibility.reason}</p>
          {feasibility.alternative && (
            <div className={styles.blockedAlt}>
              <p className={styles.blockedAltLabel}>Suggestion:</p>
              <p>
                <strong>{feasibility.alternative.distance_km} km · {feasibility.alternative.elevation_m} m</strong> over {feasibility.alternative.weeks_required} weeks
              </p>
            </div>
          )}
          <div className={styles.blockedActions}>
            <Button variant="secondary" size="sm" onClick={() => handleGenerate(true)} disabled={generating}>
              Generate anyway
            </Button>
          </div>
        </div>
      )}

      {!loading && !feasibility.blocked && sessions && sessions.length === 0 && (
        <p className={styles.empty}>
          No plan yet. Click <strong>Generate plan</strong> to build your week from your goal + recent rides.
        </p>
      )}

      {!loading && !feasibility.blocked && sessions && sessions.length > 0 && (
        <ul className={styles.list}>
          {sessions.map((s) => {
            const isScheduled = scheduledIds.has(s.id);
            const zoneTone = s.target_zone ? ZONE_TO_PILL_TONE[s.target_zone] || 'neutral' : 'neutral';
            return (
              <li key={s.id} className={styles.row}>
                <div className={styles.rowMeta}>
                  <span className={styles.rowDate}>{formatShortDate(s.suggested_date)}</span>
                  {s.target_zone && <Pill tone={zoneTone}>{s.target_zone}</Pill>}
                </div>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>{s.title}</p>
                  <p className={styles.rowSub}>
                    {s.duration ? `${s.duration} min` : ''}
                    {s.duration && s.elevation_gained ? ' · ' : ''}
                    {s.elevation_gained ? `${s.elevation_gained} m` : ''}
                    {(s.duration || s.elevation_gained) && s.surface ? ' · ' : ''}
                    {s.surface ?? ''}
                  </p>
                  {s.reasoning && <p className={styles.rowReasoning}>{s.reasoning}</p>}
                </div>
                <div className={styles.rowAction}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleScheduleClick(s)}
                    disabled={isScheduled}
                  >
                    {isScheduled ? '✓ Scheduled' : '+ Schedule'}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SessionPrefillModal
        open={prefillModal !== null}
        prefill={prefillModal?.data ?? null}
        onClose={() => setPrefillModal(null)}
        onSave={handlePrefillSave}
        isPending={scheduling}
        error={null}
      />
    </section>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
