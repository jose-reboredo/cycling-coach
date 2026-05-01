// SessionRoutePicker — Sprint 5 / v10.5.0 → v10.5.4.
// Embedded inside EventDetailDrawer for personal sessions only. Two route
// sources, ranked by match to the session's target distance:
//
//   1. Generated (v10.4.0 backend) — fresh OSM-based loops from a start
//      address. Handoff is "Download GPX" + "Open Strava upload" (manual
//      drag-drop on the Strava side; Strava has no public route-create API).
//
//   2. Strava saved (v9.3.0 #47 backend, /api/routes/saved) — the user's
//      already-saved Strava routes filtered by the session's target band.
//      Handoff is one click "Open in Strava ↗" — the route is already
//      there, no GPX dance needed.
//
// Hidden for club events (clubs define their own routes) and for sessions
// already cancelled or completed.

import { useEffect, useState } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import { Pill } from '../Pill/Pill';
import { Button } from '../Button/Button';
import { useTrainingPrefs } from '../../hooks/useTrainingPrefs';
import { geocodeAddress } from '../../lib/geocode';
import { estimateDistanceKm } from '../../lib/cyclingPace';
import {
  generateRoutes,
  fetchSavedStravaRoutes,
  downloadGpx,
  type CyclingType,
  type ElevationPreference,
} from '../../lib/routesApi';
import styles from './SessionRoutePicker.module.css';

// ---------------------------------------------------------------------------
// Unified display type — generated and Strava-saved routes share a card UX
// but diverge on handoff. The discriminator drives both rendering and the
// post-pick action area.
// ---------------------------------------------------------------------------

type DisplayRoute =
  | {
      source: 'generated';
      id: string;
      distance_km: number;
      elevation_gain_m: number;
      surface_type: string;
      score: number;
      gpx: string;
    }
  | {
      source: 'strava';
      id: string;
      name: string;
      distance_km: number;
      elevation_gain_m: number;
      surface_type: string;
      score: number;
      strava_url: string | null;
    };

interface SessionRoutePickerProps {
  sessionId: number;
  zone: number | null;
  durationMinutes: number | null;
}

function surfaceToCyclingType(surface: string | undefined): CyclingType {
  if (surface === 'gravel') return 'gravel';
  if (surface === 'paved') return 'road';
  return 'road';
}

const STRAVA_ROUTES_UPLOAD_URL = 'https://www.strava.com/routes/new';

export function SessionRoutePicker({ sessionId, zone, durationMinutes }: SessionRoutePickerProps) {
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const [address, setAddress] = useState(prefs.start_address ?? '');
  const [routes, setRoutes] = useState<DisplayRoute[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<'generate' | 'strava' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elevationPref, setElevationPref] = useState<ElevationPreference>('medium');
  const [downloadedRouteId, setDownloadedRouteId] = useState<string | null>(null);

  // Reset picker state when the drawer is opened for a different session.
  useEffect(() => {
    setRoutes(null);
    setSelectedId(null);
    setError(null);
    setDownloadedRouteId(null);
  }, [sessionId]);

  // Sync from prefs when they update via another surface.
  useEffect(() => {
    if (prefs.start_address) setAddress(prefs.start_address);
  }, [prefs.start_address]);

  // Reset the "downloaded" state when the user picks a different card.
  useEffect(() => {
    setDownloadedRouteId(null);
  }, [selectedId, routes]);

  const targetDistance = estimateDistanceKm(durationMinutes, zone);
  const cyclingType = surfaceToCyclingType(prefs.surface_pref);

  // -------------------------------------------------------------------------
  // Source 1 — generate fresh OSM-based loops via the v10.4.0 backend.
  // -------------------------------------------------------------------------
  const handleFindGenerated = async () => {
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
    setPending('generate');
    setError(null);
    setRoutes(null);
    setSelectedId(null);
    try {
      const geo = await geocodeAddress(trimmed);
      if (!geo) {
        setError(`Couldn't find "${trimmed}". Try a different address.`);
        setPending(null);
        return;
      }
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
        const display: DisplayRoute[] = generated.map((r) => ({
          source: 'generated' as const,
          id: `gen_${r.id}`,
          distance_km: r.distance_km,
          elevation_gain_m: r.elevation_gain_m,
          surface_type: r.surface_type,
          score: r.score,
          gpx: r.gpx,
        }));
        setRoutes(display);
        setSelectedId(display[0]!.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate routes.';
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
      setPending(null);
    }
  };

  // -------------------------------------------------------------------------
  // Source 2 — fetch the user's saved Strava routes (existing /api/routes/
  // saved endpoint, v9.3.0 #47). Backend already filters to ±20% distance
  // band; we score and sort client-side by closest match.
  // -------------------------------------------------------------------------
  const handleShowStravaSaved = async () => {
    if (pending) return;
    if (targetDistance == null) {
      setError('Session needs a duration to estimate distance. Edit the session first.');
      return;
    }
    setPending('strava');
    setError(null);
    setRoutes(null);
    setSelectedId(null);
    try {
      const surface = prefs.surface_pref === 'gravel' ? 'gravel' : prefs.surface_pref === 'paved' ? 'paved' : 'any';
      const saved = await fetchSavedStravaRoutes({
        distanceKm: targetDistance,
        surface,
      });
      if (!Array.isArray(saved) || saved.length === 0) {
        setError(`No Strava saved routes match ~${targetDistance} km. Try generating a new route instead.`);
        return;
      }
      // Score: closeness to target distance (0 = exact match, drops to 0 at ±20%).
      const display: DisplayRoute[] = saved
        .map<DisplayRoute>((r) => {
          const km = r.distance_m / 1000;
          const delta = Math.abs(km - targetDistance) / targetDistance;
          const score = Math.max(0, 1 - delta * 5); // mirrors generated scoring curve
          return {
            source: 'strava' as const,
            id: `strava_${r.id}`,
            name: r.name,
            distance_km: Number(km.toFixed(1)),
            elevation_gain_m: Math.round(r.elevation_gain_m),
            surface_type: r.surface,
            score: Number(score.toFixed(3)),
            strava_url: r.strava_url,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setRoutes(display);
      setSelectedId(display[0]!.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load Strava routes.';
      if (msg === 'strava unavailable') {
        setError('Strava is unreachable right now. Try again or generate routes instead.');
      } else if (msg === 'unauthorized' || msg === 'not_authenticated') {
        setError('Reconnect Strava in Profile to load your saved routes.');
      } else {
        setError(msg);
      }
    } finally {
      setPending(null);
    }
  };

  const selected = routes?.find((r) => r.id === selectedId) ?? null;
  const isDownloaded = selected?.source === 'generated' && selected.id === downloadedRouteId;

  const handleDownloadGpx = () => {
    if (!selected || selected.source !== 'generated') return;
    const km = Math.round(selected.distance_km);
    downloadGpx(`cadence-${km}km-${selected.surface_type}.gpx`, selected.gpx);
    setDownloadedRouteId(selected.id);
  };

  const handleOpenStravaUpload = () => {
    window.open(STRAVA_ROUTES_UPLOAD_URL, '_blank', 'noopener,noreferrer');
  };

  const handleOpenStravaSaved = () => {
    if (!selected || selected.source !== 'strava' || !selected.strava_url) return;
    window.open(selected.strava_url, '_blank', 'noopener,noreferrer');
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
        Generate fresh OpenStreetMap loops from your start address, or pick from your existing Strava saved routes — ranked by match to this session.
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
          disabled={pending !== null}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="route-elevation">Elevation</label>
        <select
          id="route-elevation"
          className={styles.input}
          value={elevationPref}
          onChange={(e) => setElevationPref(e.target.value as ElevationPreference)}
          disabled={pending !== null}
        >
          <option value="low">Low (≤15 m/km, lakeshore)</option>
          <option value="medium">Medium (15–30 m/km, rolling)</option>
          <option value="high">High (30+ m/km, climbing)</option>
        </select>
      </div>

      <div className={styles.actionsRow}>
        <Button
          variant="secondary"
          size="md"
          onClick={handleFindGenerated}
          disabled={pending !== null || !address.trim()}
        >
          {pending === 'generate' ? 'Finding routes…' : 'Find 3 routes'}
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={handleShowStravaSaved}
          disabled={pending !== null}
        >
          {pending === 'strava' ? 'Loading Strava…' : 'Show Strava routes'}
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
                  <span className={styles.cardStatPrimary}>
                    {r.source === 'strava' ? r.name : `${r.distance_km} km`}
                  </span>
                  <span className={styles.cardStatSecondary}>
                    {r.source === 'strava' ? `${r.distance_km} km · ` : ''}
                    {r.elevation_gain_m} m
                  </span>
                  <span className={styles.cardStatBucket}>
                    {r.source === 'strava' ? 'Strava saved' : 'Generated'} · {r.surface_type}
                  </span>
                </div>
                <span className={styles.cardScore}>{Math.round(r.score * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Handoff branches on the selected route's source. */}
      {selected && selected.source === 'generated' && (
        <div className={styles.handoff}>
          <p className={styles.handoffTitle}>Ready to ride.</p>
          <p className={styles.handoffLede}>
            Save the GPX, then upload it to Strava — or import to Komoot, RideWithGPS, Garmin Connect, anywhere that takes GPX.
          </p>
          <div className={styles.handoffButtons}>
            <Button variant="primary" size="md" onClick={handleDownloadGpx}>
              {isDownloaded ? '✓ Downloaded' : '↓ Download GPX'}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleOpenStravaUpload}
              disabled={!isDownloaded}
            >
              Open Strava upload ↗
            </Button>
          </div>
          {isDownloaded && (
            <p className={styles.handoffPath}>
              Saved as <code>cadence-{Math.round(selected.distance_km)}km-{selected.surface_type}.gpx</code>.
              Find it in your Downloads, then drag it onto Strava's upload page.
            </p>
          )}
        </div>
      )}

      {selected && selected.source === 'strava' && (
        <div className={styles.handoff}>
          <p className={styles.handoffTitle}>Ready to ride.</p>
          <p className={styles.handoffLede}>
            This route is already on Strava — open it directly to view, sync, or start.
          </p>
          <div className={styles.handoffButtons}>
            <Button
              variant="primary"
              size="md"
              withArrow
              onClick={handleOpenStravaSaved}
              disabled={!selected.strava_url}
            >
              Open in Strava ↗
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
