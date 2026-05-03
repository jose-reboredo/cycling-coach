import type { ReactNode } from 'react';
import styles from './Toast.module.css';

type ToastVariant = 'success' | 'info' | 'warning' | 'danger';

interface ToastProps {
  variant?: ToastVariant;
  title: ReactNode;
  body?: ReactNode;
  /** Optional dismiss handler. When provided, a close button is rendered. */
  onDismiss?: () => void;
  /** Optional action — typically a `<Button variant="link">` for "Undo" etc. */
  action?: ReactNode;
}

/**
 * Toast — Sprint 12 / v11.0.0 (new component).
 *
 * Presentational notification primitive. The `ToastProvider` and
 * `useToast()` hook (queue management + portal mount + auto-dismiss
 * timing) ship in Phase 4 alongside the `/design-system` showcase
 * route. This file is the visual unit alone — usable directly for
 * static demos or wrapped by the upcoming provider for app-wide
 * notification surface.
 *
 * Per PRODUCT.md §3 voice rules: error toasts say what broke + what
 * the user can do; never apologise. Forbidden: "Oops! Something went
 * wrong." Always specific.
 *
 * Token-only styling.
 */
export function Toast({ variant = 'info', title, body, onDismiss, action }: ToastProps) {
  return (
    <div
      className={[styles.root, styles[variant]].join(' ')}
      role={variant === 'danger' ? 'alert' : 'status'}
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
    >
      <div className={styles.indicator} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        {body ? <p className={styles.body}>{body}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
