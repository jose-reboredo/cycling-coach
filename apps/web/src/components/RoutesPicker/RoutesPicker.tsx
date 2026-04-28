import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { ZonePill, type Zone } from '../ZonePill/ZonePill';
import { MOCK_ROUTES, type MockRoute, type Surface } from '../../lib/mockRoutes';
import styles from './RoutesPicker.module.css';

interface RoutesPickerProps {
  /** today's workout text from the AI plan, used to score routes */
  todaysPlanText?: string | undefined;
  surface: Surface | 'any';
  onSurfaceChange: (s: Surface | 'any') => void;
  startAddress: string;
  onStartAddressChange: (s: string) => void;
}

const SURFACE_OPTIONS: { id: Surface | 'any'; label: string; em: string }[] = [
  { id: 'any', label: 'Any', em: '·' },
  { id: 'paved', label: 'Tarmac', em: '═' },
  { id: 'dirt', label: 'Gravel', em: '⚞' },
];

/**
 * RoutesPicker — surfaces top saved Strava routes ranked against today's plan.
 * Currently uses mock routes; will swap to /api/athlete/routes when wired.
 */
export function RoutesPicker({
  todaysPlanText,
  surface,
  onSurfaceChange,
  startAddress,
  onStartAddressChange,
}: RoutesPickerProps) {
  const [editingAddress, setEditingAddress] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const target = useMemo(() => deriveTarget(todaysPlanText), [todaysPlanText]);

  const ranked = useMemo(() => {
    return MOCK_ROUTES.map((r) => ({
      route: r,
      score: scoreRoute(r, target, surface),
    }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);
  }, [target, surface]);

  const visible = showAll ? ranked : ranked.slice(0, 3);

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <Eyebrow rule>Routes for today</Eyebrow>
        {target.label ? <Pill tone="accent">{target.label}</Pill> : <Pill>No plan</Pill>}
      </header>

      <p className={styles.lede}>
        {target.intent ?? 'Generate your AI plan to match routes against today’s workout target.'}
      </p>

      {/* Surface preference */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <Eyebrow>Surface</Eyebrow>
          <div className={styles.surfaceRow}>
            {SURFACE_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.surfaceBtn} ${surface === s.id ? styles.surfaceActive : ''}`}
                onClick={() => onSurfaceChange(s.id)}
                aria-pressed={surface === s.id}
              >
                <span className={styles.surfaceEm} aria-hidden="true">{s.em}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <Eyebrow>Start from</Eyebrow>
          {editingAddress ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setEditingAddress(false);
              }}
              className={styles.addressForm}
            >
              <input
                value={startAddress}
                onChange={(e) => onStartAddressChange(e.target.value)}
                placeholder="Zürich, Switzerland"
                className={styles.addressInput}
                autoFocus
              />
              <Button size="sm" variant="primary" type="submit">
                Save
              </Button>
              <button
                type="button"
                className={styles.addressCancel}
                onClick={() => setEditingAddress(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className={styles.addressDisplay}>
              <span>{startAddress || 'No address set'}</span>
              <button
                type="button"
                className={styles.addressEdit}
                onClick={() => setEditingAddress(true)}
              >
                {startAddress ? 'Change' : 'Set address'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Route list */}
      <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {visible.map(({ route, score }) => (
            <motion.li
              key={route.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className={styles.item}
            >
              <RouteRow route={route} score={score} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      {ranked.length > 3 ? (
        <button
          type="button"
          className={styles.showAll}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? `Hide all` : `Show all ${ranked.length} routes`}
        </button>
      ) : null}

      {ranked.length === 0 ? (
        <p className={styles.empty}>
          No routes match today's filters. Try a different surface or generate a plan.
        </p>
      ) : null}
    </section>
  );
}

function RouteRow({ route, score }: { route: MockRoute; score: number }) {
  const matchClass = score >= 80 ? styles.matchHigh : score >= 50 ? styles.matchMed : styles.matchLow;
  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowName}>
          {route.starred ? <span className={styles.star} aria-hidden="true">★</span> : null}
          <h4>{route.name}</h4>
        </div>
        <p className={styles.rowBlurb}>{route.blurb}</p>
        <div className={styles.rowMeta}>
          <span>{route.distanceKm} km</span>
          <span>·</span>
          <span>{route.elevationM.toLocaleString()} m</span>
          <span>·</span>
          <span className={styles.surfaceTag}>{route.surface}</span>
          {route.zones.length ? (
            <>
              <span>·</span>
              <span className={styles.zoneRow}>
                {route.zones.map((z) => (
                  <ZonePill key={z} zone={z as Zone} size="sm" />
                ))}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className={styles.rowMatch}>
        <span className={`${styles.match} ${matchClass}`}>{score}%</span>
        <span className={styles.matchLabel}>match</span>
      </div>
    </article>
  );
}

/* ---------- scoring ---------- */

interface Target {
  label?: string;
  intent?: string;
  /** ideal route distance for today */
  idealKm: number;
  /** range tolerance */
  toleranceKm: number;
  /** preferred zones */
  zones: number[];
}

function deriveTarget(planText: string | undefined): Target {
  if (!planText) return { idealKm: 50, toleranceKm: 25, zones: [2, 3] };
  const t = planText.toLowerCase();

  if (/long\s*ride|long ride/.test(t)) {
    return {
      label: 'Long ride',
      intent: 'Looking for a sustained Z2 loop with rolling terrain.',
      idealKm: 80,
      toleranceKm: 30,
      zones: [2, 3],
    };
  }
  if (/threshold|tempo|sweet[- ]spot|interval|hard/.test(t)) {
    return {
      label: 'Intervals',
      intent: 'Need climbs or sustained drags to hold target watts.',
      idealKm: 35,
      toleranceKm: 15,
      zones: [3, 4],
    };
  }
  if (/hill|climb/.test(t)) {
    return {
      label: 'Hill repeats',
      intent: 'Routes with climbs you can repeat — bonus for big VAM.',
      idealKm: 30,
      toleranceKm: 15,
      zones: [4, 5],
    };
  }
  if (/recovery|easy|gentle/.test(t)) {
    return {
      label: 'Recovery',
      intent: 'Flat, conversational pace — keep it boring.',
      idealKm: 25,
      toleranceKm: 15,
      zones: [1, 2],
    };
  }
  if (/^rest/.test(t)) {
    return {
      label: 'Rest',
      intent: 'Today is rest day. Browsing routes for tomorrow?',
      idealKm: 50,
      toleranceKm: 30,
      zones: [2, 3],
    };
  }
  return {
    label: 'Ride',
    intent: 'Pick what feels right.',
    idealKm: 50,
    toleranceKm: 25,
    zones: [2, 3],
  };
}

function scoreRoute(route: MockRoute, target: Target, surface: Surface | 'any'): number {
  let score = 0;

  // Distance fit (40 pts)
  const dist = Math.abs(route.distanceKm - target.idealKm);
  const distFit = Math.max(0, 1 - dist / target.toleranceKm);
  score += distFit * 40;

  // Zone overlap (30 pts)
  const zoneOverlap = route.zones.filter((z) => target.zones.includes(z)).length;
  if (target.zones.length > 0) {
    score += (zoneOverlap / target.zones.length) * 30;
  }

  // Surface fit (20 pts)
  if (surface === 'any') {
    score += 15;
  } else if (route.surface === surface) {
    score += 20;
  } else if (route.surface === 'mixed') {
    score += 10;
  }

  // Starred bonus (10 pts)
  if (route.starred) score += 10;

  return Math.round(Math.max(0, Math.min(100, score)));
}
