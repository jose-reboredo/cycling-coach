// apps/web/src/components/FeatureSpread/FeatureSpread.tsx
//
// Sprint 14 / v11.4.0 — extracted from Landing.tsx into a shared molecule.
// Used by both Landing's '/#what' section and the new /how-it-works route
// so the visual + structural pattern is consistent across surfaces (per
// feedback_atomic-design-extraction-from-bugs.md).
//
// Layout: a two-column spread on desktop (>=1024px), single column on
// mobile. Body left + visual right by default; `reverse` swaps to
// body-right on desktop. Above each block sits a № NN eyebrow, an
// italic kicker, a display-scale title, and a body paragraph.
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import styles from './FeatureSpread.module.css';

interface FeatureSpreadProps {
  /** Two-digit string like '01', '02', etc. — rendered as `№ 01`. */
  num: string;
  /** Italic line above the title, "kicker" framing the heading. */
  kicker: string;
  /** Heading. Display-scale weight 600. */
  title: string;
  /** Body paragraph. Use plain text; pass JSX via `bodyNode` instead if you need formatting. */
  body?: string;
  /** Optional richer body if `body` (string) isn't enough. */
  bodyNode?: ReactNode;
  /** The picture-side. Any React node — preview component, image, SVG. */
  visual: ReactNode;
  /** Reverse the desktop two-column order (puts the body on the right). */
  reverse?: boolean;
  /** Sprint 14 / v11.4.0 — Optional anchor target so other pages can deep-link
   *  to a specific section (e.g. /how-it-works#forecast). */
  id?: string;
}

export function FeatureSpread({
  num,
  kicker,
  title,
  body,
  bodyNode,
  visual,
  reverse = false,
  id,
}: FeatureSpreadProps) {
  return (
    <motion.article
      id={id}
      className={`${styles.feat} ${reverse ? styles.featReverse : ''}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={styles.featBody}>
        <div className={styles.featNum}>№ {num}</div>
        <p className={styles.featKicker}>{kicker}</p>
        <h3 className={styles.featTitle}>{title}</h3>
        {bodyNode ? (
          <div className={styles.featCopy}>{bodyNode}</div>
        ) : body ? (
          <p className={styles.featCopy}>{body}</p>
        ) : null}
      </div>
      <div className={styles.featVisual}>{visual}</div>
    </motion.article>
  );
}
