import type { ReactNode, MouseEvent, KeyboardEvent } from 'react';
import styles from './Card.module.css';

/**
 * Sprint 12 — single-depth-strategy rule per `DESIGN.md` §4.
 * - `base` / `elev` / `pressed` use border, no shadow (default cards).
 * - `accent` uses the molten-orange glow shadow without an extra
 *   coloured border (the accent ring IS the visual emphasis; doubling
 *   with a coloured border was the v1 "belt-and-suspenders depth" tell).
 */
type Tone = 'base' | 'elev' | 'pressed' | 'accent';

interface CardProps {
  children: ReactNode;
  tone?: Tone;
  /** Vertical accent bar on the left edge — used for "next ride" emphasis */
  rule?: boolean;
  /** Internal padding scale */
  pad?: 'sm' | 'md' | 'lg';
  /** Sprint 12 — when set, the card is keyboard + mouse interactive
   *  (hover-lift, focus-ring, role=button). Pair with `onClick`. */
  interactive?: boolean;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  className?: string;
  as?: 'div' | 'article' | 'section' | 'aside';
}

/**
 * Card — surface primitive.
 *
 * Single depth strategy: border OR shadow, never both (per DESIGN.md §4).
 * Token-only styling — no hex literals.
 */
export function Card({
  children,
  tone = 'base',
  rule = false,
  pad = 'md',
  interactive = false,
  onClick,
  className,
  as: As = 'div',
}: CardProps) {
  const cls = [
    styles.root,
    styles[tone],
    styles[`pad-${pad}`],
    rule ? styles.rule : null,
    interactive ? styles.interactive : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const interactiveProps = interactive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(e as unknown as MouseEvent<HTMLElement>);
          }
        },
      }
    : {};

  return (
    <As className={cls} {...interactiveProps}>
      {children}
    </As>
  );
}
