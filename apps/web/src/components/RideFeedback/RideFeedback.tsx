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

/** Inline coach-verdict panel rendered below a ride row. */
export function RideFeedbackPanel({
  loading,
  error,
  feedback,
  onAsk,
  disabled,
}: RideFeedbackPanelProps) {
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
            <header className={styles.head}>
              <Eyebrow tone="accent">Coach verdict</Eyebrow>
              <span className={styles.timestamp}>{fmtRelative(new Date(feedback.generated_at))}</span>
            </header>
            <p className={styles.verdict}>{feedback.verdict}</p>
            <p className={styles.body}>{feedback.feedback}</p>
            <p className={styles.next}>
              <strong>Next time</strong>
              {feedback.next}
            </p>
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
