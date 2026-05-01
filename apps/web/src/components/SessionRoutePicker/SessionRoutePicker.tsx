// SessionRoutePicker — Sprint 5+ / v10.6.0.
// Three honest tabs above one card list:
//
//   1. Generate new       — ORS-backed (v10.4.0). Fresh OSM loops from a start
//                           address. Output = GPX with multi-app handoff
//                           (Strava / RWGPS / Komoot / Garmin Connect).
//   2. My Strava          — User's saved Strava routes (existing /api/routes/
//                           saved, v9.3.0 #47). Output = direct "Open in
//                           Strava ↗" link.
//   3. My Ride with GPS   — User's saved RWGPS routes via OAuth (v10.6.0).
//                           Empty state if not connected; otherwise output =
//                           direct "Open in Ride with GPS ↗" link.
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
  fetchRwgpsRoutes,
  fetchRwgpsStatus,
  downloadGpx,
  type CyclingType,
  type ElevationPreference,
} from '../../lib/routesApi';
import styles from './SessionRoutePicker.module.css';

type SourceTab = 'generate' | 'strava' | 'rwgps';

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
    }
  | {
      source: 'rwgps';
      id: string;
      name: string;
      distance_km: number;
      elevation_gain_m: number;
      surface_type: string;
      score: number;
      rwgps_url: string;
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
const RWGPS_UPLOAD_URL = 'https://ridewithgps.com/upload';
const KOMOOT_PLAN_URL = 'https://www.komoot.com/plan';
const GARMIN_CONNECT_URL = 'https://connect.garmin.com/modern/courses-by-activity/cycling';

export function SessionRoutePicker({ sessionId, zone, durationMinutes }: SessionRoutePickerProps) {
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const [tab, setTab] = useState<SourceTab>('generate');
  const [address, setAddress] = useState(prefs.start_address ?? '');
  const [routes, setRoutes] = useState<DisplayRoute[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<SourceTab | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elevationPref, setElevationPref] = useState<ElevationPreference>('medium');
  const [downloadedRouteId, setDownloadedRouteId] = useState<string | null>(null);

  // RWGPS connection status — fetched once on mount + after returning from
  // the OAuth callback (recognised by the ?rwgps=connected query param).
  const [rwgpsConnected, setRwgpsConnected] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRwgpsStatus()
      .then((s) => { if (!cancelled) setRwgpsConnected(s.connected); })
      .catch(() => { if (!cancelled) setRwgpsConnected(false); });
    return () => { cancelled = true; };
  }, []);

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

  // Switching tabs clears the previous results so the user doesn't see a
  // stale list while they configure the new source.
  useEffect(() => {
    setRoutes(null);
    setSelectedId(null);
    setError(null);
  }, [tab]);

  const targetDistance = estimateDistanceKm(durationMinutes, zone);
  const cyclingType = surfaceToCyclingType(prefs.surface_pref);

  // -------------------------------------------------------------------------
  // Tab 1 — Generate via ORS.
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
      if (msg === 'route_service_disabled') setError('Route service is temporarily disabled. Try again later.');
      else if (msg === 'no_valid_paths') setError("Couldn't find good routes here. Try a different start point or distance.");
      else if (msg === 'rate-limited') setError('Too many requests. Wait a few minutes and try again.');
      else setError(msg);
    } finally {
      setPending(null);
    }
  };

  // -------------------------------------------------------------------------
  // Tab 2 — Strava saved routes.
  // -------------------------------------------------------------------------
  const handleFindStravaSaved = async () => {
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
      const saved = await fetchSavedStravaRoutes({ distanceKm: targetDistance, surface });
      if (!Array.isArray(saved) || saved.length === 0) {
        setError(`No Strava saved routes match ~${targetDistance} km.`);
        return;
      }
      const display: DisplayRoute[] = saved
        .map<DisplayRoute>((r) => {
          const km = r.distance_m / 1000;
          const delta = Math.abs(km - targetDistance) / targetDistance;
          const score = Math.max(0, 1 - delta * 5);
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
      if (msg === 'strava unavailable') setError('Strava is unreachable right now.');
      else if (msg === 'unauthorized' || msg === 'not_authenticated') setError('Reconnect Strava in Profile.');
      else setError(msg);
    } finally {
      setPending(null);
    }
  };

  // -------------------------------------------------------------------------
  // Tab 3 — Ride with GPS saved routes.
  // -------------------------------------------------------------------------
  const handleFindRwgpsSaved = async () => {
    if (pending) return;
    if (targetDistance == null) {
      setError('Session needs a duration to estimate distance. Edit the session first.');
      return;
    }
    setPending('rwgps');
    setError(null);
    setRoutes(null);
    setSelectedId(null);
    try {
      const saved = await fetchRwgpsRoutes({ distanceKm: targetDistance });
      if (!Array.isArray(saved) || saved.length === 0) {
        setError(`No Ride with GPS routes match ~${targetDistance} km.`);
        return;
      }
      const display: DisplayRoute[] = saved
        .map<DisplayRoute>((r) => {
          const km = r.distance_m / 1000;
          const delta = Math.abs(km - targetDistance) / targetDistance;
          const score = Math.max(0, 1 - delta * 5);
          return {
            source: 'rwgps' as const,
            id: `rwgps_${r.id}`,
            name: r.name,
            distance_km: Number(km.toFixed(1)),
            elevation_gain_m: Math.round(r.elevation_gain_m),
            surface_type: r.surface,
            score: Number(score.toFixed(3)),
            rwgps_url: r.rwgps_url,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      setRoutes(display);
      setSelectedId(display[0]!.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load Ride with GPS routes.';
      if (msg === 'rwgps_not_connected') {
        setRwgpsConnected(false);
        setError('Connect Ride with GPS to load your saved routes.');
      } else if (msg === 'rwgps_reauth_required') {
        setRwgpsConnected(false);
        setError('Your Ride with GPS session expired. Reconnect to continue.');
      } else if (msg === 'rwgps_unavailable') {
        setError('Ride with GPS is unreachable right now.');
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

  return (
    <section className={styles.picker} aria-label="Pick a route for this session">
      <header className={styles.head}>
        <Eyebrow rule>Pick a route</Eyebrow>
        {targetDistance != null && (
          <Pill>Target ~{targetDistance} km</Pill>
        )}
      </header>

      {/* Three-tab header */}
      <div className={styles.tabs} role="tablist" aria-label="Route source">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'generate'}
          className={`${styles.tab} ${tab === 'generate' ? styles.tabActive : ''}`}
          onClick={() => setTab('generate')}
        >
          Generate new
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'strava'}
          className={`${styles.tab} ${tab === 'strava' ? styles.tabActive : ''}`}
          onClick={() => setTab('strava')}
        >
          My Strava
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rwgps'}
          className={`${styles.tab} ${tab === 'rwgps' ? styles.tabActive : ''}`}
          onClick={() => setTab('rwgps')}
        >
          My Ride with GPS
        </button>
      </div>

      {/* Tab 1 — Generate */}
      {tab === 'generate' && (
        <>
          <p className={styles.lede}>
            Fresh OpenStreetMap loops from your start address. Saves as GPX — works in Strava, Ride with GPS, Komoot, Garmin Connect.
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
          </div>
        </>
      )}

      {/* Tab 2 — Strava saved */}
      {tab === 'strava' && (
        <>
          <p className={styles.lede}>
            Your Strava saved routes, ranked by closeness to ~{targetDistance ?? '—'} km. Pick one — opens directly on Strava.
          </p>
          <div className={styles.actionsRow}>
            <Button
              variant="secondary"
              size="md"
              onClick={handleFindStravaSaved}
              disabled={pending !== null}
            >
              {pending === 'strava' ? 'Loading Strava…' : 'Show Strava routes'}
            </Button>
          </div>
        </>
      )}

      {/* Tab 3 — RWGPS saved */}
      {tab === 'rwgps' && (
        <>
          {rwgpsConnected === false ? (
            <>
              <p className={styles.lede}>
                Connect your Ride with GPS account to surface saved routes ranked by today's session.
              </p>
              <div className={styles.actionsRow}>
                <a
                  className={styles.connectBtn}
                  href="/authorize-rwgps"
                >
                  Connect Ride with GPS ↗
                </a>
              </div>
            </>
          ) : (
            <>
              <p className={styles.lede}>
                Your Ride with GPS routes, ranked by closeness to ~{targetDistance ?? '—'} km. Pick one — opens directly on Ride with GPS.
              </p>
              <div className={styles.actionsRow}>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleFindRwgpsSaved}
                  disabled={pending !== null || rwgpsConnected !== true}
                >
                  {pending === 'rwgps'
                    ? 'Loading Ride with GPS…'
                    : rwgpsConnected === null
                      ? 'Checking connection…'
                      : 'Show Ride with GPS routes'}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* Result cards — common across all three tabs */}
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
                    {r.source === 'generated' ? `${r.distance_km} km` : r.name}
                  </span>
                  <span className={styles.cardStatSecondary}>
                    {r.source !== 'generated' ? `${r.distance_km} km · ` : ''}
                    {r.elevation_gain_m} m
                  </span>
                  <span className={styles.cardStatBucket}>
                    {r.source === 'generated' ? 'Generated' : r.source === 'strava' ? 'Strava' : 'Ride with GPS'} · {r.surface_type}
                  </span>
                </div>
                <span className={styles.cardScore}>{Math.round(r.score * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Handoff per source */}
      {selected && selected.source === 'generated' && (
        <div className={styles.handoff}>
          <p className={styles.handoffTitle}>Ready to ride.</p>
          <p className={styles.handoffLede}>
            Save the GPX, then drag it into your favourite cycling app. Strava and Ride with GPS don't accept route uploads via API — drag-drop is the universal way.
          </p>
          <div className={styles.handoffButtons}>
            <Button variant="primary" size="md" onClick={handleDownloadGpx}>
              {isDownloaded ? '✓ Downloaded' : '↓ Download GPX'}
            </Button>
          </div>
          {isDownloaded && (
            <>
              <p className={styles.handoffPath}>
                Saved as <code>cadence-{Math.round(selected.distance_km)}km-{selected.surface_type}.gpx</code>.
              </p>
              <p className={styles.handoffMulti}>Use it in:</p>
              <div className={styles.handoffApps}>
                <a className={styles.handoffApp} href={STRAVA_ROUTES_UPLOAD_URL} target="_blank" rel="noopener noreferrer">Strava ↗</a>
                <a className={styles.handoffApp} href={RWGPS_UPLOAD_URL} target="_blank" rel="noopener noreferrer">Ride with GPS ↗</a>
                <a className={styles.handoffApp} href={KOMOOT_PLAN_URL} target="_blank" rel="noopener noreferrer">Komoot ↗</a>
                <a className={styles.handoffApp} href={GARMIN_CONNECT_URL} target="_blank" rel="noopener noreferrer">Garmin Connect ↗</a>
              </div>
            </>
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
              onClick={() => {
                if (selected.strava_url) window.open(selected.strava_url, '_blank', 'noopener,noreferrer');
              }}
              disabled={!selected.strava_url}
            >
              Open in Strava ↗
            </Button>
          </div>
        </div>
      )}

      {selected && selected.source === 'rwgps' && (
        <div className={styles.handoff}>
          <p className={styles.handoffTitle}>Ready to ride.</p>
          <p className={styles.handoffLede}>
            This route is on Ride with GPS — open it directly to view, sync, or start.
          </p>
          <div className={styles.handoffButtons}>
            <Button
              variant="primary"
              size="md"
              withArrow
              onClick={() => window.open(selected.rwgps_url, '_blank', 'noopener,noreferrer')}
            >
              Open in Ride with GPS ↗
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
