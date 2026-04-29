import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import styles from './ProgressRing.module.css';

interface ProgressRingProps {
  /** 0..1 */
  value: number;
  /** outer diameter in px */
  size?: number;
  /** stroke thickness — defaults to size/14 */
  thickness?: number;
  /** color override (defaults to molten orange) */
  color?: string;
  /** text rendered in the center */
  children?: ReactNode;
  /** label below the value */
  label?: string;
  /** label above the value */
  eyebrow?: string;
}

/**
 * ProgressRing — token-driven SVG ring with elastic fill animation.
 * Used for goal progress, PMC dials, weekly TSS targets.
 */
export function ProgressRing({
  value,
  size = 200,
  thickness,
  color = 'var(--c-accent)',
  children,
  label,
  eyebrow,
}: ProgressRingProps) {
  const t = thickness ?? Math.max(8, Math.round(size / 14));
  const radius = (size - t) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div className={styles.root} style={{ width: size, height: size }}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--c-line-strong)"
          strokeWidth={t}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={t}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            filter: `drop-shadow(0 0 8px ${color === 'var(--c-accent)' ? 'rgba(255,77,0,.45)' : 'transparent'})`,
          }}
        />
      </svg>
      <div className={styles.center}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        {children}
        {label ? <span className={styles.label}>{label}</span> : null}
      </div>
    </div>
  );
}
