import { Link } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { TopBar } from '../components/TopBar/TopBar';
import {
  ROADMAP,
  PRIORITY_LABEL,
  AREA_LABEL,
  type RoadmapItem,
  type Priority,
} from '../lib/roadmap';
import styles from './WhatsNext.module.css';

const STATUS_TONE: Record<RoadmapItem['status'], 'accent' | 'success' | 'warn' | 'neutral'> = {
  shipped: 'success',
  'in-progress': 'accent',
  open: 'neutral',
};
const STATUS_LABEL: Record<RoadmapItem['status'], string> = {
  shipped: 'Shipped',
  'in-progress': 'In progress',
  open: 'Open',
};

const PRIORITY_TONE: Record<Priority, 'danger' | 'warn' | 'neutral'> = {
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
};

export function WhatsNext() {
  const grouped = groupByStatus(ROADMAP);
  return (
    <div className={styles.page}>
      <TopBar
        trailing={
          <>
            <Link to="/dashboard" className={styles.navLink}>Dashboard</Link>
            <Link to="/privacy" className={styles.navLink}>Privacy</Link>
          </>
        }
      />
      <main>
        <Container width="narrow">
          <header className={styles.head}>
            <Eyebrow rule tone="accent">№ — Roadmap</Eyebrow>
            <h1 className={styles.h1}>
              What's <em>next</em>.
            </h1>
            <p className={styles.lede}>
              The honest list — what's shipped, what's open, what's in flight, with target
              versions where we have them. Everything below mirrors the GitHub issue list at{' '}
              <code>.github/ISSUES_v8.0.0.md</code>.
            </p>
            <div className={styles.summary}>
              <Stat n={grouped.shipped.length} label="Shipped" tone="success" />
              <Stat n={grouped['in-progress'].length} label="In progress" tone="accent" />
              <Stat n={grouped.open.length} label="Open" tone="neutral" />
            </div>
          </header>

          {(['in-progress', 'open', 'shipped'] as const).map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            return (
              <section key={status} className={styles.section}>
                <Eyebrow rule>
                  {STATUS_LABEL[status]} · {items.length}
                </Eyebrow>
                <ul className={styles.list}>
                  {items.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <header className={styles.itemHead}>
                        <h2 className={styles.itemTitle}>{item.title}</h2>
                        <div className={styles.itemMeta}>
                          <Pill tone={PRIORITY_TONE[item.priority]}>{PRIORITY_LABEL[item.priority]}</Pill>
                          <Pill tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Pill>
                        </div>
                      </header>
                      <p className={styles.itemBody}>{item.body}</p>
                      <footer className={styles.itemFoot}>
                        <span className={styles.itemArea}>{AREA_LABEL[item.area]}</span>
                        {item.target ? (
                          <span className={styles.itemTarget}>Target · {item.target}</span>
                        ) : null}
                      </footer>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <footer className={styles.foot}>
            <p>
              Have a feature request? Open an issue on{' '}
              <a
                href="https://github.com/jose-reboredo/cycling-coach/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              .
            </p>
          </footer>
        </Container>
      </main>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: 'success' | 'accent' | 'neutral';
}) {
  return (
    <div className={`${styles.stat} ${styles[`stat-${tone}`]}`}>
      <span className={styles.statN}>{n}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function groupByStatus(items: RoadmapItem[]): Record<RoadmapItem['status'], RoadmapItem[]> {
  return items.reduce(
    (acc, item) => {
      acc[item.status].push(item);
      return acc;
    },
    { shipped: [] as RoadmapItem[], 'in-progress': [] as RoadmapItem[], open: [] as RoadmapItem[] },
  );
}
