import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

/**
 * Sprint 12 — extended variant set per `DESIGN.md` §8.
 * - `primary`     : accent fill, the headline action
 * - `secondary`   : outlined, the alternate
 * - `tertiary`    : subtle filled (warm-grey-700 bg), the third option
 * - `ghost`       : text-only with hover bg, low-emphasis
 * - `link`        : inline-link styled, no chrome
 * - `destructive` : danger-red fill, irreversible actions
 * - `strava`      : Strava brand colour, only for Strava-specific actions
 */
type Variant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'link'
  | 'destructive'
  | 'strava';

type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /**
   * Append a `→` glyph after the label. Opt-in only. Per the Sprint 12
   * design system audit, `withArrow` was being passed on every primary
   * CTA — that universal-arrow pattern is an AI-aesthetic tell. The
   * prop is preserved for cases where the arrow communicates direction
   * (e.g. "Next step →") but is no longer the default. Audit call sites
   * before passing.
   */
  withArrow?: boolean;
  /**
   * When true, renders a spinner in place of the label and the button
   * is non-interactive. Use for async actions; the parent owns the
   * pending boolean.
   */
  loading?: boolean;
  /** Icon slot before the label (ReactNode). Mutually exclusive with `withArrow`. */
  iconLeft?: ReactNode;
  /** Icon slot after the label (ReactNode). Mutually exclusive with `withArrow`. */
  iconRight?: ReactNode;
  children: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: undefined };

type LinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string };

/**
 * Button — primary surface for action.
 * Renders <button> by default; <a> when `href` is provided.
 *
 * Eight states honoured (per DESIGN.md §8 component principles):
 *   default · hover · active · focus · disabled · loading · icon-only · full-width
 *
 * Token-only styling — no hex literals (Sprint 12 contract).
 */
export function Button(props: ButtonProps | LinkProps) {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth,
    withArrow,
    loading,
    iconLeft,
    iconRight,
    children,
    ...rest
  } = props;

  const cls = [
    styles.root,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : null,
    loading ? styles.loading : null,
  ]
    .filter(Boolean)
    .join(' ');

  // The label is hidden visually during loading but kept in the DOM
  // so the button width doesn't jump (CLS). Spinner overlays absolutely.
  const inner = (
    <>
      {loading ? (
        <span className={styles.spinner} aria-hidden="true">
          <span className={styles.spinnerDot} />
          <span className={styles.spinnerDot} />
          <span className={styles.spinnerDot} />
        </span>
      ) : null}
      <span className={styles.body} aria-hidden={loading || undefined}>
        {iconLeft ? <span className={styles.icon}>{iconLeft}</span> : null}
        <span className={styles.label}>{children}</span>
        {iconRight ? <span className={styles.icon}>{iconRight}</span> : null}
        {withArrow && !iconRight ? (
          <span className={styles.arrow} aria-hidden="true">→</span>
        ) : null}
      </span>
    </>
  );

  // When loading, expose busy state semantically without disabling
  // (disabled buttons can't be focused; busy buttons can be).
  const busyAttrs = loading ? { 'aria-busy': true, disabled: true } : {};

  if ('href' in rest && typeof rest.href === 'string') {
    return (
      <a className={cls} {...busyAttrs} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      {...busyAttrs}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {inner}
    </button>
  );
}
