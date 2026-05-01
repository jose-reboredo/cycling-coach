// SessionRoutePicker — Sprint 5 / v10.5.0.
// Embedded inside EventDetailDrawer for personal sessions only. Lets the
// user enter a start address, generates 3 candidate routes from the v10.4.0
// /api/routes/generate backend, picks one, and hands off to Strava with a
// downloaded GPX file.
//
// Hidden for club events (clubs define their own routes). Also hidden for
// cancelled / completed sessions (no need to plan a route after the fact).

import { useEffect, useState } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { useTrainingPrefs } from '../../hooks/useTrainingPrefs';
import { geocodeAddress } from '../../lib/geocode';
import { estimateDistanceKm } from '../../lib/cyclingPace';
import {
  generateRoutes,
  downloadGpx,
  type GeneratedRoute,
  type CyclingType,
  type ElevationPreference,
} from '../../lib/routesApi';
import styles from './SessionRoutePicker.module.css';

interface SessionRoutePickerProps {
  /** Session metadata used to derive route criteria. */
  sessionId: number;
  zone: number | null;
  durationMinutes: number | null;
}

// Map training prefs surface_pref → cycling_type for the route gen API.
function surfaceToCyclingType(surface: string | undefined): CyclingType {
  if (surface === 'gravel') return 'gravel';
  if (surface === 'paved') return 'road';
  return 'road';
}

const STRAVA_ROUTES_UPLOAD_URL = 'https://www.strava.com/routes/new';

export function SessionRoutePicker({ sessionId, zone, durationMinutes }: SessionRoutePickerProps) {
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const [address, setAddress] = useState(prefs.start_address ?? '');
  const [routes, setRoutes] = useState<GeneratedRoute[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elevationPref, setElevationPref] = useState<ElevationPreference>('medium');

  // Reset picker state when the drawer is opened for a different session.
  useEffect(() => {
    setRoutes(null);
    setSelectedId(null);
    setError(null);
  }, [sessionId]);

  // Sync from prefs when they update via another surface.
  useEffect(() => {
    if (prefs.start_address) setAddress(prefs.start_address);
  }, [prefs.start_address]);

  const targetDistance = estimateDistanceKm(durationMinutes, zone);
  const cyclingType = surfaceToCyclingType(prefs.surface_pref);

  const handleFind = async () => {
    if (pending) return;
    const trimmed = address.trim();
    if (!trimmed) {
      setError('Enter a starting address.');
      return;
    }
    if (targetDistance == null) {
      setError('Session needs a duration to estimate distance. Edit the session first.');
      return;
    }
    setPending(true);
    setError(null);
    setRoutes(null);
    setSelectedId(null);
    try {
      const geo = await geocodeAddress(trimmed);
      if (!geo) {
        setError(`Couldn't find "${trimmed}". Try a different address.`);
        setPending(false);
        return;
      }
      // Persist the address so subsequent sessions prefill it.
      updatePrefs({ start_address: trimmed });
      const generated = await generateRoutes({
        lat: geo.lat,
        lng: geo.lng,
        distance_km: targetDistance,
        cycling_type: cyclingType,
        elevation_preference: elevationPref,
      });
      if (!Array.isArray(generated) || generated.length === 0) {
        setError("We couldn't generate routes for that area. Try a different start point.");
      } else {
        setRoutes(generated);
        setSelectedId(generated[0]!.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate routes.';
      // Re-shape known backend codes into user-friendly text.
      if (msg === 'route_service_disabled') {
        setError('Route service is temporarily disabled. Try again later.');
      } else if (msg === 'no_valid_paths') {
        setError("Couldn't find good routes here. Try a different start point or distance.");
      } else if (msg === 'rate-limited') {
        setError('Too many requests. Wait a few minutes and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  };

  const selected = routes?.find((r) => r.id === selectedId) ?? null;

  const handleStrava = () => {
    if (!selected) return;
    const km = Math.round(selected.distance_km);
    downloadGpx(`cadence-${km}km-${selected.surface_type}.gpx`, selected.gpx);
    window.open(STRAVA_ROUTES_UPLOAD_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className={styles.picker} aria-label="Pick a route for this session">
      <header className={styles.head}>
        <Eyebrow rule>Pick a route</Eyebrow>
        {targetDistance != null && (
          <Pill>Target ~{targetDistance} km</Pill>
        )}
      </header>

      <p className={styles.lede}>
        We'll generate three OpenStreetMap-based loops from your starting point that match this session's distance and surface.
      </p>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="route-address">Start address</label>
        <input
          id="route-address"
          className={styles.input}
          type="text"
          placeholder="e.g. Bahnhofstrasse, Zürich"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="street-address"
          disabled={pending}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="route-elevation">Elevation</label>
        <select
          id="route-elevation"
          className={styles.input}
          value={elevationPref}
          onChange={(e) => setElevationPref(e.target.value as ElevationPreference)}
          disabled={pending}
        >
          <option value="low">Low (≤15 m/km, lakeshore)</option>
          <option value="medium">Medium (15–30 m/km, rolling)</option>
          <option value="high">High (30+ m/km, climbing)</option>
        </select>
      </div>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="md"
          onClick={handleFind}
          disabled={pending || !address.trim()}
        >
          {pending ? 'Finding routes…' : 'Find 3 routes'}
        </Button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {routes && (
        <ul className={styles.cards}>
          {routes.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                className={`${styles.card} ${r.id === selectedId ? styles.cardSelected : ''}`}
                onClick={() => setSelectedId(r.id)}
                aria-pressed={r.id === selectedId}
              >
                <span className={styles.cardRank}>#{i + 1}</span>
                <div className={styles.cardStats}>
                  <span className={styles.cardStatPrimary}>{r.distance_km} km</span>
                  <span className={styles.cardStatSecondary}>{r.elevation_gain_m} m</span>
                  <span className={styles.cardStatBucket}>{r.surface_type}</span>
                </div>
                <span className={styles.cardScore}>{Math.round(r.score * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className={styles.startRow}>
          <Button
            variant="primary"
            size="md"
            withArrow
            onClick={handleStrava}
          >
            Start in Strava ↗
          </Button>
          <span className={styles.startHint}>
            Downloads the GPX and opens Strava's route upload — drag the file in to finish.
          </span>
        </div>
      )}
    </section>
  );
}
