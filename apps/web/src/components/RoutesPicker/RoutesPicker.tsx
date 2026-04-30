import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { ensureValidToken } from '../../lib/auth';
import styles from './RoutesPicker.module.css';

export type SurfacePref = 'paved' | 'gravel' | 'any';

export interface SavedRoute {
  source: 'strava';
  id: number | string;
  name: string;
  distance_m: number;
  elevation_gain_m: number;
  surface: string;
  strava_url?: string | undefined;
}

export interface AiRoute {
  source: 'ai';
  name: string;
  narrative: string;
  start_address: string;
  target_distance_km: number;
  estimated_elevation_m: number;
}

export type SelectableRoute = SavedRoute | AiRoute;

export function routeKey(route: SelectableRoute): string {
  return route.source === 'strava' ? `strava:${route.id}` : `ai:${route.name}`;
}

interface TodaysSession {
  /** workout text from the AI plan — e.g. "Tempo 4×4 min, 1h15" */
  intent?: string;
  /** ideal route distance for today (km) — used to filter saved routes ±20% */
  target_km?: number;
  /** terrain band derived from intent — passed to AI discover */
  difficulty?: 'flat' | 'rolling' | 'hilly';
}

interface RoutesPickerProps {
  /** Today's session — drives saved-route filtering + seeds the AI prompt. */
  todaysSession?: TodaysSession;
  surface: SurfacePref;
  onSurfaceChange: (s: SurfacePref) => void;
  startAddress: string;
  onStartAddressChange: (s: string) => void;
  /** Optional — when present, route rows show a Pick/Selected button. */
  onRouteSelected?: ((route: SelectableRoute | null) => void) | undefined;
  selectedRouteKey?: string | null | undefined;
}

const SURFACE_OPTIONS: { id: SurfacePref; label: string; em: string }[] = [
  { id: 'any', label: 'Any', em: '·' },
  { id: 'paved', label: 'Paved', em: '═' },
  { id: 'gravel', label: 'Gravel', em: '⚞' },
];

const DISTANCE_TOLERANCE = 0.2;

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

/**
 * RoutesPicker — surfaces top saved Strava routes filtered by surface +
 * matched against today's session distance. When zero saved routes match,
 * a "Discover AI routes near you" CTA generates 3-5 narrative briefs via
 * POST /api/routes/discover (system-paid Haiku, rate-limited 10/h/athlete).
 */
export function RoutesPicker({
  todaysSession,
  surface,
  onSurfaceChange,
  startAddress,
  onStartAddressChange,
  onRouteSelected,
  selectedRouteKey,
}: RoutesPickerProps) {
  const [editingAddress, setEditingAddress] = useState(false);

  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [aiRoutes, setAiRoutes] = useState<AiRoute[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const targetKm = todaysSession?.target_km ?? null;

  // Fetch saved routes on mount + when surface changes.
  useEffect(() => {
    let cancelled = false;
    setSavedLoading(true);
    setSavedError(null);
    setAiRoutes([]);
    setAiError(null);

    async function load() {
      try {
        const tokens = await ensureValidToken();
        if (!tokens) {
          if (!cancelled) {
            setSavedError("Couldn't load your Strava routes — try again later.");
            setSavedRoutes([]);
            setSavedLoading(false);
          }
          return;
        }
        const params = new URLSearchParams();
        if (surface !== 'any') params.set('surface', surface);
        const url = `/api/routes/saved${params.toString() ? `?${params}` : ''}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setSavedError("Couldn't load your Strava routes — try again later.");
          setSavedRoutes([]);
        } else {
          const data = (await res.json()) as { routes?: unknown };
          const list = Array.isArray(data.routes) ? data.routes : [];
          const mapped: SavedRoute[] = list
            .filter((r: any) => r && typeof r.id !== 'undefined')
            .map((r: any) => ({
              source: 'strava',
              id: r.id,
              name: typeof r.name === 'string' && r.name.trim() ? r.name : 'Untitled route',
              distance_m: Number(r.distance_m) || 0,
              elevation_gain_m: Number(r.elevation_gain_m) || 0,
              surface: typeof r.surface === 'string' ? r.surface : 'unknown',
              strava_url: typeof r.strava_url === 'string' ? r.strava_url : undefined,
            }));
          setSavedRoutes(mapped);
          setSavedError(null);
        }
        setSavedLoading(false);
      } catch {
        if (!cancelled) {
          setSavedError("Couldn't load your Strava routes — try again later.");
          setSavedRoutes([]);
          setSavedLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  // Filter saved routes against today's session target distance (±20%).
  // When no session target is known, show all saved routes (browse mode).
  const matchingRoutes = useMemo(() => {
    if (!targetKm) return savedRoutes;
    const minKm = targetKm * (1 - DISTANCE_TOLERANCE);
    const maxKm = targetKm * (1 + DISTANCE_TOLERANCE);
    return savedRoutes.filter((r) => {
      const km = r.distance_m / 1000;
      return km >= minKm && km <= maxKm;
    });
  }, [savedRoutes, targetKm]);

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
    onRouteSelected?.(null);
  }

  function handleStartAddressBlur() {
    setEditingAddress(false);
    if (startAddress.trim()) {
      schedulePatch({ start_address: startAddress, home_region: startAddress });
    }
  }

  async function discoverAiRoutes() {
    if (!startAddress.trim()) {
      setAiError('Set your start address first to discover routes near you.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const tokens = await ensureValidToken();
      if (!tokens) {
        setAiError("Sign in to Strava first — can't generate routes without auth.");
        setAiLoading(false);
        return;
      }
      const res = await fetch('/api/routes/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access_token}`,
        },
        body: JSON.stringify({
          location: startAddress,
          surface,
          distance_km: targetKm ?? 40,
          difficulty: todaysSession?.difficulty ?? 'rolling',
        }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const mins = Math.max(1, Math.ceil((data.retry_after_seconds || 60) / 60));
        setAiError(`Hit the AI rate limit — try again in ${mins} min.`);
        setAiLoading(false);
        return;
      }
      if (!res.ok) {
        setAiError('AI routes unavailable right now — try again later.');
        setAiLoading(false);
        return;
      }
      const data = (await res.json()) as { routes?: unknown[] };
      const routes: AiRoute[] = (data.routes ?? [])
        .filter((r: any): r is Record<string, unknown> => r && typeof r === 'object')
        .map(
          (r: any): AiRoute => ({
            source: 'ai',
            name: String(r.name ?? 'Untitled'),
            narrative: String(r.narrative ?? ''),
            start_address: String(r.start_address ?? ''),
            target_distance_km: Number(r.target_distance_km) || 0,
            estimated_elevation_m: Number(r.estimated_elevation_m) || 0,
          }),
        );
      setAiRoutes(routes);
      setAiLoading(false);
    } catch {
      setAiError('AI routes unavailable right now — try again later.');
      setAiLoading(false);
    }
  }

  const showAiSection = !savedLoading && !savedError && matchingRoutes.length === 0;

  return (
    <section className={styles.root}>
      <header className={styles.head}>
        <Eyebrow rule>Pick a route</Eyebrow>
        {targetKm ? (
          <Pill tone="accent">{`~${Math.round(targetKm)} km target`}</Pill>
        ) : (
          <Pill>Browse</Pill>
        )}
      </header>

      <div className={styles.controls}>
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
                <span className={styles.surfaceEm} aria-hidden="true">
                  {s.em}
                </span>
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
                handleStartAddressBlur();
              }}
              className={styles.addressForm}
            >
              <input
                value={startAddress}
                onChange={(e) => onStartAddressChange(e.target.value)}
                onBlur={handleStartAddressBlur}
                placeholder="e.g. Zürich, Switzerland"
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

      {savedLoading ? (
        <p className={styles.empty}>Loading your saved routes…</p>
      ) : savedError ? (
        <p className={styles.empty}>{savedError}</p>
      ) : (
        <>
          {matchingRoutes.length > 0 ? (
            <ol className={styles.list}>
              <AnimatePresence initial={false}>
                {matchingRoutes.slice(0, 5).map((route) => {
                  const key = routeKey(route);
                  const selected = selectedRouteKey === key;
                  return (
                    <motion.li
                      key={key}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className={`${styles.item} ${selected ? styles.selected : ''}`}
                    >
                      <SavedRouteRow
                        route={route}
                        selected={selected}
                        onSelect={onRouteSelected ? () => onRouteSelected(route) : undefined}
                      />
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          ) : null}

          {showAiSection ? (
            <div className={styles.aiSection}>
              {aiRoutes.length === 0 ? (
                <>
                  <p className={styles.empty}>
                    {targetKm
                      ? `No saved routes near ~${Math.round(targetKm)} km for this filter.`
                      : 'No saved routes match this filter.'}
                  </p>
                  <Button
                    size="md"
                    variant="primary"
                    onClick={() => void discoverAiRoutes()}
                    disabled={aiLoading || !startAddress.trim()}
                  >
                    {aiLoading ? 'Generating…' : 'Discover AI routes near you'}
                  </Button>
                  {!startAddress.trim() ? (
                    <p className={styles.aiHint}>Set your start address above first.</p>
                  ) : null}
                  {aiError ? <p className={styles.aiError}>{aiError}</p> : null}
                </>
              ) : (
                <>
                  <Eyebrow rule tone="accent">
                    AI-suggested routes
                  </Eyebrow>
                  <ol className={styles.list}>
                    {aiRoutes.map((route, idx) => {
                      const key = `${routeKey(route)}:${idx}`;
                      const selected = selectedRouteKey === key;
                      return (
                        <li
                          key={key}
                          className={`${styles.item} ${selected ? styles.selected : ''}`}
                        >
                          <AiRouteRow
                            route={route}
                            selected={selected}
                            onSelect={
                              onRouteSelected ? () => onRouteSelected(route) : undefined
                            }
                          />
                        </li>
                      );
                    })}
                  </ol>
                  <p className={styles.aiHint}>
                    Briefs only — plan one in Strava routes or Komoot, then tap Start workout.
                  </p>
                </>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function SavedRouteRow({
  route,
  selected,
  onSelect,
}: {
  route: SavedRoute;
  selected: boolean;
  onSelect?: (() => void) | undefined;
}) {
  const distanceKm = Math.round(route.distance_m / 1000);
  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <h4 className={styles.rowName}>{route.name}</h4>
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
                View on Strava ↗
              </a>
            </>
          ) : null}
        </div>
      </div>
      {onSelect ? (
        <Button size="sm" variant={selected ? 'primary' : 'secondary'} onClick={onSelect}>
          {selected ? 'Selected' : 'Pick'}
        </Button>
      ) : null}
    </article>
  );
}

function AiRouteRow({
  route,
  selected,
  onSelect,
}: {
  route: AiRoute;
  selected: boolean;
  onSelect?: (() => void) | undefined;
}) {
  return (
    <article className={styles.row}>
      <div className={styles.rowMain}>
        <h4 className={styles.rowName}>{route.name}</h4>
        <p className={styles.rowNarrative}>{route.narrative}</p>
        <div className={styles.rowMeta}>
          <span>~{route.target_distance_km} km</span>
          <span>·</span>
          <span>~{route.estimated_elevation_m} m</span>
          <span>·</span>
          <span>From {route.start_address}</span>
        </div>
      </div>
      {onSelect ? (
        <Button size="sm" variant={selected ? 'primary' : 'secondary'} onClick={onSelect}>
          {selected ? 'Selected' : 'Pick'}
        </Button>
      ) : null}
    </article>
  );
}
