import { useMemo } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import type { StreakData } from '../../lib/streak';
import styles from './StreakHeatmap.module.css';

interface StreakHeatmapProps {
  data: StreakData;
}

/**
 * StreakHeatmap — 12 columns × 7 rows. Each cell is one day; intensity
 * scales with ride count. Today pulses in accent.
 */
export function StreakHeatmap({ data }: StreakHeatmapProps) {
  const cols = useMemo(() => {
    // 84 cells, oldest first → 12 columns of 7 rows each.
    const out: typeof data.cells[] = [];
    for (let i = 0; i < 12; i++) {
      out.push(data.cells.slice(i * 7, (i + 1) * 7));
    }
    return out;
  }, [data.cells]);

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <Eyebrow rule>Streak · last 12 weeks</Eyebrow>
        <div className={styles.numbers}>
          <div>
            <span className={styles.numVal}>{data.current}</span>
            <span className={styles.numLabel}>day streak</span>
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <div>
            <span className={styles.numVal}>{data.best}</span>
            <span className={styles.numLabel}>best</span>
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <div>
            <span className={styles.numVal}>{data.totalDays}</span>
            <span className={styles.numLabel}>days ridden</span>
          </div>
        </div>
      </header>

      <div className={styles.grid} role="img" aria-label={`${data.current} day current streak; ${data.best} day best streak`}>
        {cols.map((week, ci) => (
          <div className={styles.col} key={ci}>
            {week.map((cell) => (
              <span
                key={cell.date}
                className={`${styles.cell} ${styles[`l${cell.level}`]} ${cell.isToday ? styles.today : ''}`}
                title={`${cell.date} — ${cell.count === 0 ? 'rest' : `${cell.count} ride${cell.count === 1 ? '' : 's'}`}`}
              />
            ))}
          </div>
        ))}
      </div>

      <footer className={styles.legend}>
        <span>Less</span>
        <span className={`${styles.cell} ${styles.l0} ${styles.legendCell}`} />
        <span className={`${styles.cell} ${styles.l1} ${styles.legendCell}`} />
        <span className={`${styles.cell} ${styles.l2} ${styles.legendCell}`} />
        <span className={`${styles.cell} ${styles.l3} ${styles.legendCell}`} />
        <span className={`${styles.cell} ${styles.l4} ${styles.legendCell}`} />
        <span>More</span>
      </footer>
    </section>
  );
}
