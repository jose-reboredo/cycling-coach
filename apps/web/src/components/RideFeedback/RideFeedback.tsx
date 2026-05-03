import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { fmtRelative } from '../../lib/format';
import type { RideFeedback as RideFeedbackData } from '../../lib/coachApi';
import styles from './RideFeedback.module.css';

interface RideFeedbackPanelProps {
  loading: boolean;
  error?: string;
  feedback?: RideFeedbackData;
  onAsk: () => void;
  /** True when no API key configured — disables the ask button + shows hint */
  disabled?: boolean;
}

/** Inline coach-verdict panel rendered below a ride row.
 *
 *  Sprint 14 / v11.3.0 — once the verdict has been fetched, the user can
 *  collapse the panel by clicking the header. Click again to expand.
 *  Founder feedback: 'coach veredict needs to be opened and closed,
 *  now we can only open it.'
 */
export function RideFeedbackPanel({
  loading,
  error,
  feedback,
  onAsk,
  disabled,
}: RideFeedbackPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-open when the feedback first arrives (or on a fresh ask cycle).
  useEffect(() => {
    if (feedback) setCollapsed(false);
  }, [feedback]);

  if (!loading && !feedback && !error) {
    return (
      <button
        type="button"
        className={styles.askBtn}
        onClick={onAsk}
        disabled={disabled || loading}
        title={disabled ? 'Add an Anthropic API key to use AI coaching' : 'Ask the coach for feedback'}
      >
        <span className={styles.askIcon} aria-hidden="true">✦</span>
        <span>{disabled ? 'Add API key for coach verdict' : 'Get coach verdict'}</span>
      </button>
    );
  }

  // While loading or error, keep the panel always open (those states have
  // their own brief content). Only the success state allows collapse.
  const collapsible = !!feedback && !loading && !error;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        className={styles.panel}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      >
        {loading ? (
          <div className={styles.loading}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Asking the coach…</span>
          </div>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : feedback ? (
          <>
            <button
              type="button"
              className={styles.headBtn}
              onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
              aria-expanded={!collapsed}
              aria-controls="coach-verdict-body"
            >
              <Eyebrow tone="accent">Coach verdict</Eyebrow>
              <span className={styles.timestamp}>{fmtRelative(new Date(feedback.generated_at))}</span>
              <span className={styles.headChev} aria-hidden="true">
                {collapsed ? '▾' : '▴'}
              </span>
            </button>
            {!collapsed && (
              <div id="coach-verdict-body">
                <p className={styles.verdict}>{feedback.verdict}</p>
                <p className={styles.body}>{feedback.feedback}</p>
                <p className={styles.next}>
                  <strong>Next time</strong>
                  {feedback.next}
                </p>
              </div>
            )}
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
