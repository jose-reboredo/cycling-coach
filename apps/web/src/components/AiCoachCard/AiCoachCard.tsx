import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { isRestText, todayKey } from '../../lib/coachUtils';
import { DAY_KEYS, type AiReport, type DayName } from '../../lib/coachApi';
import { fmtRelative } from '../../lib/format';
import styles from './AiCoachCard.module.css';

type ScheduleDayState = 'idle' | 'pending' | 'done';

interface AiCoachCardProps {
  apiKey: string | null;
  report: AiReport | null;
  loading: boolean;
  error: string | null;
  invalidKey: boolean;
  stravaExpired?: boolean;
  sessionsPerWeek: number;
  onSetSessions: (n: number) => void;
  onSetApiKey: (key: string) => void;
  onClearApiKey: () => void;
  onGenerate: () => void | Promise<unknown>;
  onClearReport: () => void;
  /** v10.1.0 — push any day from the AI weekly plan onto the personal
   *  scheduler (POSTs `/api/me/sessions`). When provided, the WeekPlan
   *  renders an inline "+ Schedule" button beside each non-rest day.
   *  Per-day state controls the button label (idle / pending / done). */
  onScheduleDay?: (day: DayName) => void;
  scheduleDayStates?: Partial<Record<DayName, ScheduleDayState>>;
  scheduleDayError?: string | null;
}

/**
 * AI Coach — three-state card:
 *   1. no API key → setup form
 *   2. has key, no report → sessions picker + Generate plan button
 *   3. has report → summary, strengths, areas, weekly plan, regenerate
 */
export function AiCoachCard(props: AiCoachCardProps) {
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <Eyebrow rule tone="accent">AI Coach · Claude</Eyebrow>
        <div className={styles.headRight}>
          {props.report ? (
            <Pill>{`Updated ${fmtRelative(new Date(props.report.generated_at))}`}</Pill>
          ) : (
            <Pill tone="warn">Not generated</Pill>
          )}
          {props.apiKey ? (
            <button type="button" className={styles.subtleBtn} onClick={props.onClearApiKey}>
              Change API key
            </button>
          ) : null}
        </div>
      </header>

      {!props.apiKey ? (
        <ApiKeySetup
          onSave={props.onSetApiKey}
          error={props.error && props.invalidKey ? props.error : null}
        />
      ) : !props.report ? (
        <NoReportState
          loading={props.loading}
          error={props.error}
          invalidKey={props.invalidKey}
          stravaExpired={props.stravaExpired ?? false}
          sessionsPerWeek={props.sessionsPerWeek}
          onSetSessions={props.onSetSessions}
          onGenerate={props.onGenerate}
        />
      ) : (
        <ReportState
          report={props.report}
          loading={props.loading}
          error={props.error}
          sessionsPerWeek={props.sessionsPerWeek}
          onSetSessions={props.onSetSessions}
          onGenerate={props.onGenerate}
          onClearReport={props.onClearReport}
          onScheduleDay={props.onScheduleDay}
          scheduleDayStates={props.scheduleDayStates}
          scheduleDayError={props.scheduleDayError}
        />
      )}
    </section>
  );
}

/* ---------------- API key setup ---------------- */

function ApiKeySetup({ onSave, error }: { onSave: (k: string) => void; error: string | null }) {
  const [value, setValue] = useState('');
  return (
    <div className={styles.empty}>
      <h3 className={styles.emptyTitle}>
        Add your <em>Anthropic API key</em>
      </h3>
      <p className={styles.emptyLede}>
        AI coaching is bring-your-own-key. Each report costs ≈ <strong>$0.02</strong>.
        Your key stays in this browser. <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">Get a key →</a>
      </p>
      <form
        className={styles.keyForm}
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSave(value.trim());
        }}
      >
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={styles.keyInput}
          aria-label="Anthropic API key"
        />
        <Button type="submit" variant="primary" size="md" disabled={!value.trim()}>
          Save
        </Button>
      </form>
      {error ? <p className={styles.errorMsg}>{error}</p> : null}
    </div>
  );
}

/* ---------------- No-report state ---------------- */

function NoReportState({
  loading,
  error,
  invalidKey,
  stravaExpired,
  sessionsPerWeek,
  onSetSessions,
  onGenerate,
}: {
  loading: boolean;
  error: string | null;
  invalidKey: boolean;
  stravaExpired: boolean;
  sessionsPerWeek: number;
  onSetSessions: (n: number) => void;
  onGenerate: () => void | Promise<unknown>;
}) {
  return (
    <div className={styles.empty}>
      <h3 className={styles.emptyTitle}>
        Generate your <em>weekly plan</em>
      </h3>
      <p className={styles.emptyLede}>
        Claude reads your last 30 days, your stats, and the week structure to build a 7-day plan
        adapted to your form. Regenerate anytime.
      </p>
      <SessionsPicker value={sessionsPerWeek} onChange={onSetSessions} />
      <div className={styles.actions}>
        <Button variant="primary" size="lg" onClick={() => onGenerate()} disabled={loading} withArrow>
          {loading ? 'Generating…' : 'Generate weekly plan'}
        </Button>
      </div>
      {stravaExpired ? (
        <p className={styles.errorMsg}>
          Your Strava session has expired —{' '}
          <a href="/authorize" target="_blank" rel="noopener noreferrer">Reconnect Strava</a>
        </p>
      ) : error ? (
        <p className={styles.errorMsg}>
          {error}
          {invalidKey ? <span> — your API key may be invalid. Use "Change API key" above.</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------- Report state ---------------- */

function ReportState({
  report,
  loading,
  error,
  sessionsPerWeek,
  onSetSessions,
  onGenerate,
  onClearReport,
  onScheduleDay,
  scheduleDayStates,
  scheduleDayError,
}: {
  report: AiReport;
  loading: boolean;
  error: string | null;
  sessionsPerWeek: number;
  onSetSessions: (n: number) => void;
  onGenerate: () => void | Promise<unknown>;
  onClearReport: () => void;
  onScheduleDay?: (day: DayName) => void;
  scheduleDayStates?: Partial<Record<DayName, ScheduleDayState>>;
  scheduleDayError?: string | null;
}) {
  return (
    <div className={styles.report}>
      <p className={styles.summary}>{report.summary}</p>

      <div className={styles.lists}>
        <div>
          <Eyebrow tone="accent">Strengths</Eyebrow>
          <ul className={styles.bullets}>
            {report.strengths.map((s, i) => (
              <li key={i} className={`${styles.bullet} ${styles.bulletGood}`}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <Eyebrow>To work on</Eyebrow>
          <ul className={styles.bullets}>
            {report.areasToImprove.map((s, i) => (
              <li key={i} className={`${styles.bullet} ${styles.bulletWarn}`}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <WeekPlan
        plan={report.weeklyPlan}
        sessions={report.sessions_per_week}
        onScheduleDay={onScheduleDay}
        scheduleDayStates={scheduleDayStates}
      />

      {scheduleDayError && (
        <p className={styles.errorMsg} role="alert">{scheduleDayError}</p>
      )}

      <p className={styles.motivation}>{report.motivation}</p>

      <footer className={styles.reportFoot}>
        <SessionsPicker value={sessionsPerWeek} onChange={onSetSessions} compact />
        <div className={styles.actions}>
          <Button variant="secondary" size="md" onClick={() => onGenerate()} disabled={loading}>
            {loading ? 'Generating…' : 'Regenerate plan'}
          </Button>
          <button type="button" className={styles.subtleBtn} onClick={onClearReport}>
            Clear plan
          </button>
        </div>
      </footer>
      {error ? <p className={styles.errorMsg}>{error}</p> : null}
    </div>
  );
}

/* ---------------- Subcomponents ---------------- */

function WeekPlan({
  plan,
  sessions,
  onScheduleDay,
  scheduleDayStates,
}: {
  plan: Record<DayName, string>;
  sessions: number;
  onScheduleDay?: (day: DayName) => void;
  scheduleDayStates?: Partial<Record<DayName, ScheduleDayState>>;
}) {
  const today = todayKey();
  return (
    <div className={styles.weekWrap}>
      <header className={styles.weekHead}>
        <Eyebrow rule>This week — {sessions} session{sessions === 1 ? '' : 's'}</Eyebrow>
      </header>
      <ol className={styles.week}>
        {DAY_KEYS.map((d) => {
          const text = plan[d] ?? '—';
          const rest = isRestText(text);
          const isToday = d === today;
          // v10.1.0 — per-day "+ Schedule" button replaces the static day
          // mark (●/·/↗) when onScheduleDay is wired and day isn't a rest
          // day. Today's bg highlight (.dayToday) preserved either way.
          const dayState = scheduleDayStates?.[d] ?? 'idle';
          const showScheduleBtn = !!onScheduleDay && !rest;
          return (
            <li key={d} className={`${styles.day} ${rest ? styles.dayRest : ''} ${isToday ? styles.dayToday : ''}`}>
              <span className={styles.dayName}>{d.slice(0, 3)}</span>
              <p className={styles.dayText}>{text}</p>
              {showScheduleBtn ? (
                <button
                  type="button"
                  className={styles.dayScheduleBtn}
                  onClick={() => onScheduleDay!(d)}
                  disabled={dayState !== 'idle'}
                  aria-label={`Add ${d} session to your schedule`}
                >
                  {dayState === 'pending' ? '…' : dayState === 'done' ? '✓' : '+ Schedule'}
                </button>
              ) : (
                <span className={styles.dayMark} aria-hidden="true">
                  {isToday ? '●' : rest ? '·' : '↗'}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SessionsPicker({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (n: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.picker} ${compact ? styles.pickerCompact : ''}`}>
      <Eyebrow>Sessions per week</Eyebrow>
      <div className={styles.pickerRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.pickerBtn} ${n === value ? styles.pickerBtnActive : ''}`}
            onClick={() => onChange(n)}
            aria-pressed={n === value}
          >
            {n}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          className={styles.pickerHint}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {SESSION_HINTS[value] ?? ''}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

const SESSION_HINTS: Record<number, string> = {
  1: 'Maintenance — one long ride per week.',
  2: 'Light load — a hard day midweek + a long ride.',
  3: 'Balanced — tempo, easy, and long. Recommended starting point.',
  4: 'Build — alternate hard / easy / long days.',
  5: 'Solid load — most weekend warriors top out here.',
  6: 'High volume — only sustainable with strong recovery.',
  7: 'Daily ride — typically pre-event or for very experienced riders.',
};
