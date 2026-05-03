import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** Sentence-case per voice rules. Specific over generic — never "No items yet". */
  headline: string;
  /** Honest about the gap; specific about the next step. */
  body?: ReactNode;
  /** Optional ReactNode — typically a custom SVG that picks up `currentColor`. */
  illustration?: ReactNode;
  /** Optional ReactNode — typically a `<Button variant="primary">`. */
  cta?: ReactNode;
  /** `default` for surface contexts; `subtle` for in-card / smaller contexts. */
  tone?: 'default' | 'subtle';
  /** Centred (default) or left-aligned. */
  align?: 'center' | 'left';
  className?: string;
}

/**
 * EmptyState — Sprint 12 / v11.0.0 (new component).
 *
 * Per DESIGN.md §8: every interactive surface designs its empty state.
 * Per PRODUCT.md §3 voice rules: empty-state copy is honest about the
 * gap and specific about the next step. Forbidden: "No items yet" and
 * the generic-illustration default pattern.
 *
 * Token-only styling. Illustration colour comes from `currentColor`
 * so the slot picks up the surrounding text colour by default.
 */
export function EmptyState({
  headline,
  body,
  illustration,
  cta,
  tone = 'default',
  align = 'center',
  className,
}: EmptyStateProps) {
  const cls = [
    styles.root,
    styles[`tone-${tone}`],
    styles[`align-${align}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="status">
      {illustration ? (
        <div className={styles.illustration} aria-hidden="true">
          {illustration}
        </div>
      ) : null}
      <h3 className={styles.headline}>{headline}</h3>
      {body ? <p className={styles.body}>{body}</p> : null}
      {cta ? <div className={styles.cta}>{cta}</div> : null}
    </div>
  );
}
