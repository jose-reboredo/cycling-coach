import type { ReactNode } from 'react';
import styles from './Card.module.css';

type Tone = 'base' | 'elev' | 'pressed' | 'accent';

interface CardProps {
  children: ReactNode;
  tone?: Tone;
  /** vertical bar on the left edge (used for "next ride" emphasis) */
  rule?: boolean;
  /** internal padding scale */
  pad?: 'sm' | 'md' | 'lg';
  className?: string;
  as?: 'div' | 'article' | 'section' | 'aside';
}

/** Card — surface primitive. 1px line + token-driven background. No shadow by default. */
export function Card({
  children,
  tone = 'base',
  rule = false,
  pad = 'md',
  className,
  as: As = 'div',
}: CardProps) {
  const cls = [
    styles.root,
    styles[tone],
    styles[`pad-${pad}`],
    rule ? styles.rule : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <As className={cls}>{children}</As>;
}
