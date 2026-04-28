import type { ReactNode } from 'react';
import styles from './Container.module.css';

type Width = 'narrow' | 'base' | 'wide' | 'bleed';

interface ContainerProps {
  children: ReactNode;
  width?: Width;
  as?: 'div' | 'section' | 'header' | 'footer' | 'main' | 'nav' | 'article';
  className?: string;
}

/**
 * Container — single source of horizontal rhythm.
 * All real content lives inside one of these. Bleed = no max-width.
 */
export function Container({ children, width = 'base', as: As = 'div', className }: ContainerProps) {
  const cls = [styles.root, styles[width], className].filter(Boolean).join(' ');
  return <As className={cls}>{children}</As>;
}
