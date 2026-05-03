import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

type Variant = 'text' | 'circle' | 'rect' | 'card';

interface SkeletonProps {
  variant?: Variant;
  /** CSS dimension — number → px, string → as-given (e.g. '50%', '12rem'). */
  width?: number | string;
  height?: number | string;
  /** For `variant='text'` — number of stacked lines. */
  lines?: number;
  /** Optional aria-label override; defaults to "Loading". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Skeleton — Sprint 12 / v11.0.0 (new component).
 *
 * Loading-state primitive. Replaces ad-hoc spinner / "Loading..." copy.
 * Shimmer animation honoured at the token level — `prefers-reduced-motion`
 * clamps it to a static muted state.
 *
 * Token-only styling.
 */
export function Skeleton({
  variant = 'rect',
  width,
  height,
  lines,
  ariaLabel = 'Loading',
  className,
}: SkeletonProps) {
  if (variant === 'text' && lines && lines > 1) {
    return (
      <div className={[styles.stack, className].filter(Boolean).join(' ')} role="status" aria-label={ariaLabel}>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={[styles.root, styles.text].join(' ')}
            style={{
              ...sizeStyle(width, height),
              // Last line is shorter to mimic a real paragraph end.
              ...(i === lines - 1 ? { width: '60%' } : null),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <span
      className={[styles.root, styles[variant], className].filter(Boolean).join(' ')}
      style={sizeStyle(width, height)}
      role="status"
      aria-label={ariaLabel}
    />
  );
}

function sizeStyle(width?: number | string, height?: number | string): CSSProperties {
  return {
    ...(width != null ? { width: typeof width === 'number' ? `${width}px` : width } : null),
    ...(height != null ? { height: typeof height === 'number' ? `${height}px` : height } : null),
  };
}
