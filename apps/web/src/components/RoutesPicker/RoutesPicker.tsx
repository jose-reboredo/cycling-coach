import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { ensureValidToken } from '../../lib/auth';
import styles from './RoutesPicker.module.css';

/** Surface preference values that match the /api/routes/saved query param vocabulary */
type SurfacePref = 'paved' | 'gravel' | 'any';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LiveRoute {
  id: number | string;
  name: string;
  distance_m: number;
  elevation_gain_m: number;
  surface: string;
  map_url?: string;
  strava_url?: string;
}

type Difficulty = 'any' | 'flat' | 'rolling' | 'hilly';

interface RoutesPickerProps {
  /** today's workout text from the AI plan, used to score routes */
  todaysPlanText?: string | undefined;
  surface: SurfacePref;
  onSurfaceChange: (s: SurfacePref) => void;
  startAddress: string;
  onStartAddressChange: (s: string) => void;
}

// ---------------------------------------------------------------------------
// Filter chip options
// ---------------------------------------------------------------------------

const SURFACE_OPTIONS: { id: SurfacePref; label: string; em: string }[] = [
  { id: 'any', label: 'Any', em: '·' },
  { id: 'paved', label: 'Paved', em: '═' },
  { id: 'gravel', label: 'Gravel', em: '⚞' },
];

const DISTANCE_OPTIONS: { id: number | 'any'; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 30, label: '30 km' },
  { id: 60, label: '60 km' },
  { id: 100, label: '100 km' },
];

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'flat', label: 'Flat' },
  { id: 'rolling', label: 'Rolling' },
  { id: 'hilly', label: 'Hilly' },
];

// ---------------------------------------------------------------------------
// PATCH /api/training-prefs helper (fire-and-forget, debounced)
// ---------------------------------------------------------------------------

async function patchTrainingPrefs(patch: Record<string, unknown>) {
  try {
    const tokens = await ensureValidToken();
    if (!tokens) return;
    const res = await fetch('/api/training-prefs', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.access_token}`,
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.warn('[RoutesPicker] PATCH /api/training-prefs failed:', res.status);
    }
  } catch (err) {
    console.warn('[RoutesPicker] PATCH /api/training-prefs error:', err);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RoutesPicker — surfaces top saved Strava routes ranked against today's plan.
 * Fetches from /api/routes/saved with surface/distance/difficulty filters;
 * persists filter changes via PATCH /api/training-prefs (debounced).
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

  // Filter state — distance and difficulty are internal (not lifted)
  const [distance, setDistance] = useState<number | 'any'>('any');
  const [difficulty, setDifficulty] = useState<Difficulty>('any');

  // Fetch state
  const [routes, setRoutes] = useState<LiveRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const target = useMemo(() => deriveTarget(todaysPlanText), [todaysPlanText]);

  // -------------------------------------------------------------------------
  // Live fetch: on mount and whenever filters change
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    async function load() {
      try {
        const tokens = await ensureValidToken();

        if (!tokens) {
          if (!cancelled) {
            setFetchError("Couldn't load your Strava routes — try again later.");
            setRoutes([]);
            setLoading(false);
          }
          return;
        }

        const params = new URLSearchParams();
        if (surface !== 'any') params.set('surface', surface);
        if (distance !== 'any') params.set('distance', String(distance));
        if (difficulty !== 'any') params.set('difficulty', difficulty);

        const url = `/api/routes/saved${params.toString() ? `?${params}` : ''}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!cancelled) {
          if (res.status === 401) {
            setFetchError("Couldn't load your Strava routes — try again later.");
            setRoutes([]);
          } else if (!res.ok) {
            setFetchError("Couldn't load your Strava routes — try again later.");
            setRoutes([]);
          } else {
            const data = (await res.json()) as { routes: LiveRoute[] };
            setRoutes(data.routes ?? []);
            setFetchError(null);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFetchError("Couldn't load your Strava routes — try again later.");
          setRoutes([]);
          setLoading(false);
        }
      }
    }

    // DEV fallback: use mock routes when no tokens and running in dev mode
    if (import.meta.env.DEV) {
      import('../../lib/mockRoutes').then(({ MOCK_ROUTES }) => {
        ensureValidToken().then((tokens) => {
          if (tokens) {
            // Real tokens exist in dev — run the real fetch
            load();
          } else if (!cancelled) {
            // No tokens in dev — fall back to mocks
            const mapped: LiveRoute[] = MOCK_ROUTES.map((r) => ({
              id: r.id,
              name: r.name,
              distance_m: r.distanceKm * 1000,
              elevation_gain_m: r.elevationM,
              surface: r.surface,
            }));
            setRoutes(mapped);
            setFetchError(null);
            setLoading(false);
          }
        });
      });
    } else {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [surface, distance, difficulty]);

  // -------------------------------------------------------------------------
  // Debounced PATCH /api/training-prefs on filter changes
  // -------------------------------------------------------------------------
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedulePatch(patch: Record<string, unknown>) {
    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    patchTimerRef.current = setTimeout(() => {
      void patchTrainingPrefs(patch);
    }, 800);
  }

  function handleSurfaceChange(s: SurfacePref) {
    onSurfaceChange(s);
    schedulePatch({ surface_pref: s });
  }

  function handleDistanceChange(d: number | 'any') {
    setDistance(d);
    schedulePatch({ preferred_distance_km: d === 'any' ? null : d });
  }

  function handleDifficultyChange(d: Difficulty) {
    setDifficulty(d);
    schedulePatch({ preferred_difficulty: d === 'any' ? null : d });
  }

  function handleStartAddressBlur() {
    setEditingAddress(false);
    schedulePatch({ start_address: startAddress });
  }

  // -------------------------------------------------------------------------
  // Scoring — applied on live routes; zones/starred degrade gracefully
  // -------------------------------------------------------------------------
  const ranked = useMemo(() => {
    return routes
      .map((r) => ({ route: r, score: scoreRoute(r, target, surface) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);
  }, [routes, target, surface]);

  const visible = showAll ? ranked : ranked.slice(0, 3);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <Eyebrow rule>Routes for today</Eyebrow>
        {target.label ? <Pill tone="accent">{target.label}</Pill> : <Pill>No plan</Pill>}
      </header>

      <p className={styles.lede}>
        {target.intent ?? 'Generate your AI plan to match routes against today’s workout target.'}
      </p>

      {/* Filters */}
      <div className={styles.controls}>
        {/* Surface */}
        <div className={styles.controlGroup}>
          <Eyebrow>Surface</Eyebrow>
          <div className={styles.surfaceRow}>
            {SURFACE_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.surfaceBtn} ${surface === s.id ? styles.surfaceActive : ''}`}
                onClick={() => handleSurfaceChange(s.id)}
                aria-pressed={surface === s.id}
              >
                <span className={styles.surfaceEm} aria-hidden="true">{s.em}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Distance */}
        <div className={styles.controlGroup}>
          <Eyebrow>Distance</Eyebrow>
          <div className={styles.surfaceRow}>
            {DISTANCE_OPTIONS.map((d) => (
              <button
                key={String(d.id)}
                type="button"
                className={`${styles.surfaceBtn} ${distance === d.id ? styles.surfaceActive : ''}`}
                onClick={() => handleDistanceChange(d.id)}
                aria-pressed={distance === d.id}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className={styles.controlGroup}>
          <Eyebrow>Difficulty</Eyebrow>
          <div className={styles.surfaceRow}>
            {DIFFICULTY_OPTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`${styles.surfaceBtn} ${difficulty === d.id ? styles.surfaceActive : ''}`}
                onClick={() => handleDifficultyChange(d.id)}
                aria-pressed={difficulty === d.id}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start from */}
        <div className={styles.controlGroup}>
          <Eyebrow>Start from</Eyebrow>
          {editingAddress ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStartAddressBlur();
              }}
              className={styles.addressForm}
            >
              <input
                value={startAddress}
                onChange={(e) => onStartAddressChange(e.target.value)}
                onBlur={handleStartAddressBlur}
                placeholder="Zürich, Switzerland"
                className={styles.addressInput}
                aria-label="Start address"
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

      {/* Loading state */}
      {loading ? (
        <p className={styles.empty}>Loading routes…</p>
      ) : fetchError ? (
        /* Error state */
        <p className={styles.empty}>{fetchError}</p>
      ) : (
        <>
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
              No routes match these filters. Try widening the distance band or surface.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// RouteRow
// ---------------------------------------------------------------------------

function RouteRow({ route, score }: { route: LiveRoute; score: number }) {
  const matchClass = score >= 80 ? styles.matchHigh : score >= 50 ? styles.matchMed : styles.matchLow;
  const distanceKm = Math.round(route.distance_m / 1000);
  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowName}>
          <h4>{route.name}</h4>
        </div>
        <div className={styles.rowMeta}>
          <span>{distanceKm} km</span>
          <span>·</span>
          <span>{route.elevation_gain_m.toLocaleString()} m</span>
          <span>·</span>
          <span className={styles.surfaceTag}>{route.surface}</span>
          {route.strava_url ? (
            <>
              <span>·</span>
              <a
                href={route.strava_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.stravaLink}
              >
                View on Strava
              </a>
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

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface Target {
  label?: string;
  intent?: string;
  /** ideal route distance for today */
  idealKm: number;
  /** range tolerance */
  toleranceKm: number;
  /** preferred zones — kept for future zone data; gracefully empty */
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

/**
 * Score a live route against today's target. zones/starred are not present
 * on the live response — degrade gracefully (route still ranks by distance
 * fit + surface fit only).
 */
function scoreRoute(route: LiveRoute, target: Target, surface: SurfacePref): number {
  let score = 0;

  const distanceKm = route.distance_m / 1000;

  // Distance fit (40 pts)
  const dist = Math.abs(distanceKm - target.idealKm);
  const distFit = Math.max(0, 1 - dist / target.toleranceKm);
  score += distFit * 40;

  // Zone overlap — live routes don't carry zone data; award baseline points
  // so routes aren't penalised for missing metadata (30 pts max → 15 pts floor)
  score += 15;

  // Surface fit (20 pts)
  if (surface === 'any') {
    score += 15;
  } else if (route.surface === surface) {
    score += 20;
  } else if (route.surface === 'mixed') {
    score += 10;
  }

  // No starred bonus without metadata — leave the 10 pts unawarded

  return Math.round(Math.max(0, Math.min(100, score)));
}

