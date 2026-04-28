import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'strava';
type Size = 'sm' | 'md' | 'lg';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  withArrow?: boolean;
  children: ReactNode;
}

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: undefined };

type LinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & { href: string };

/**
 * Button — primary surface for action.
 * Renders <button> by default; <a> when `href` is provided.
 *  Accent moments use the molten-orange glow shadow on focus + active.
 */
export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', fullWidth, withArrow, children, ...rest } = props;
  const cls = [
    styles.root,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : null,
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <span className={styles.label}>{children}</span>
      {withArrow ? <span className={styles.arrow} aria-hidden="true">→</span> : null}
    </>
  );

  if ('href' in rest && typeof rest.href === 'string') {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}
