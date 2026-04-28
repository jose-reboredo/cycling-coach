import styles from './GrainOverlay.module.css';

interface GrainOverlayProps {
  /** opacity 0..1 — defaults to .35 for hero, lower for inline cards */
  intensity?: number;
}

/**
 * GrainOverlay — film-noise overlay rendered as an SVG fractal.
 * Sits absolutely over a parent (which must be position: relative).
 * Helps photography + dark canvas read like analog film, not banding.
 */
export function GrainOverlay({ intensity = 0.35 }: GrainOverlayProps) {
  return (
    <div
      className={styles.root}
      aria-hidden="true"
      style={{ opacity: intensity }}
    />
  );
}
