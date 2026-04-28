import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Container } from '../components/Container/Container';
import { Eyebrow } from '../components/Eyebrow/Eyebrow';
import { Pill } from '../components/Pill/Pill';
import { TopBar } from '../components/TopBar/TopBar';
import { useRoadmap } from '../hooks/useRoadmap';
import {
  PRIORITY_LABEL,
  AREA_LABEL,
  type RoadmapItem,
  type Priority,
} from '../lib/roadmap';
import { fmtRelative } from '../lib/format';
import styles from './WhatsNext.module.css';

const STATUS_TONE: Record<string, 'accent' | 'success' | 'warn' | 'neutral' | 'danger'> = {
  shipped: 'success',
  'in-progress': 'accent',
  open: 'neutral',
};
const STATUS_LABEL: Record<string, string> = {
  shipped: 'Shipped',
  'in-progress': 'In progress',
  open: 'Open',
};

const PRIORITY_TONE: Record<string, 'danger' | 'warn' | 'neutral'> = {
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
};

const REPO_URL = 'https://github.com/jose-reboredo/cycling-coach';

export function WhatsNext() {
  const { items, fromGitHub, repo, fetchedAt, isLoading, error, refetch } = useRoadmap();
  const grouped = useMemo(() => groupByStatus(items), [items]);
  const repoUrl = repo ? `https://github.com/${repo}` : REPO_URL;

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
              GitHub Issues are the source of truth. Anything we add to{' '}
              <a href={`${repoUrl}/issues`} target="_blank" rel="noopener noreferrer">
                {repo ?? 'jose-reboredo/cycling-coach'}/issues
              </a>{' '}
              lands on this page within five minutes. Releases ship weekly.
            </p>

            <div className={styles.metaRow}>
              <Pill dot tone={fromGitHub ? 'success' : 'warn'}>
                {fromGitHub ? 'Live · GitHub' : 'Fallback · seed'}
              </Pill>
              {fetchedAt > 0 ? (
                <span className={styles.fetched}>Updated {fmtRelative(new Date(fetchedAt))}</span>
              ) : null}
              <button
                type="button"
                className={styles.refreshBtn}
                onClick={() => refetch()}
                disabled={isLoading}
                aria-label="Refresh roadmap"
              >
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </button>
              {error ? <Pill tone="danger">Couldn't reach GitHub</Pill> : null}
            </div>

            <div className={styles.summary}>
              <Stat n={grouped.shipped.length} label="Shipped" tone="success" />
              <Stat n={grouped['in-progress'].length} label="In progress" tone="accent" />
              <Stat n={grouped.open.length} label="Open" tone="neutral" />
            </div>
          </header>

          {(['in-progress', 'open', 'shipped'] as const).map((status) => {
            const list = grouped[status];
            if (list.length === 0) return null;
            return (
              <section key={status} className={styles.section}>
                <Eyebrow rule>
                  {STATUS_LABEL[status]} · {list.length}
                </Eyebrow>
                <ul className={styles.list}>
                  {list.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <header className={styles.itemHead}>
                        <h2 className={styles.itemTitle}>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                          {item.number ? (
                            <span className={styles.itemNum}>#{item.number}</span>
                          ) : null}
                        </h2>
                        <div className={styles.itemMeta}>
                          <Pill tone={PRIORITY_TONE[item.priority] ?? 'neutral'}>
                            {PRIORITY_LABEL[item.priority as Priority] ?? item.priority}
                          </Pill>
                          <Pill tone={STATUS_TONE[item.status] ?? 'neutral'}>
                            {STATUS_LABEL[item.status] ?? item.status}
                          </Pill>
                        </div>
                      </header>
                      <p className={styles.itemBody}>{item.body}</p>
                      <footer className={styles.itemFoot}>
                        <span className={styles.itemArea}>
                          {AREA_LABEL[item.area as keyof typeof AREA_LABEL] ?? item.area}
                        </span>
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
              Spot a bug or want to request a feature?{' '}
              <a href={`${repoUrl}/issues/new`} target="_blank" rel="noopener noreferrer">
                Open an issue on GitHub
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

function groupByStatus(
  items: RoadmapItem[],
): Record<'shipped' | 'in-progress' | 'open', RoadmapItem[]> {
  const out = {
    shipped: [] as RoadmapItem[],
    'in-progress': [] as RoadmapItem[],
    open: [] as RoadmapItem[],
  };
  for (const it of items) {
    const k = (
      it.status === 'shipped' || it.status === 'in-progress' || it.status === 'open'
        ? it.status
        : 'open'
    ) as keyof typeof out;
    out[k].push(it);
  }
  return out;
}
