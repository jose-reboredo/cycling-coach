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
  disconnectRwgps,
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
      /** v10.10.0 — 1-2 plain-English reasons for the match score. */
      reasons: string[];
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
      reasons: string[];
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
      reasons: string[];
    };

interface SessionRoutePickerProps {
  sessionId: number;
  zone: number | null;
  durationMinutes: number | null;
  /** v10.8.0 — AI plan target elevation gain (m). Used to default the
   *  elevation pref selector to the right band. */
  targetElevationM?: number | null;
  /** v10.8.0 — AI plan / user surface preference. Used to default the
   *  cycling type. */
  targetSurface?: string | null;
}

function surfaceToCyclingType(surface: string | undefined): CyclingType {
  if (surface === 'gravel') return 'gravel';
  if (surface === 'paved') return 'road';
  return 'road';
}

/** v10.10.0 — Build 1-2 plain-English match reasons for a route card.
 *  Surfaces what made (or hurt) the score so the user trusts the ranking
 *  and can pick a route faster. Reasons rendered as a bullet list under
 *  each card in the picker. */
function buildReasons({
  distanceKm,
  targetDistanceKm,
  elevationM,
  targetElevationM,
  surfaceType,
  cyclingType,
}: {
  distanceKm: number;
  targetDistanceKm: number | null;
  elevationM: number;
  targetElevationM: number | null;
  surfaceType: string;
  cyclingType: CyclingType;
}): string[] {
  const reasons: string[] = [];

  // Distance — primary signal. Always lead.
  if (targetDistanceKm != null && targetDistanceKm > 0) {
    const pct = Math.round((distanceKm / targetDistanceKm) * 100);
    if (pct >= 90 && pct <= 110) {
      reasons.push(`✓ ${distanceKm.toFixed(0)} km matches target (${pct}%)`);
    } else {
      reasons.push(`${distanceKm.toFixed(0)} km vs ${targetDistanceKm} km target (${pct}%)`);
    }
  }

  // Elevation — surface only when target known.
  if (targetElevationM != null && targetElevationM > 0 && elevationM > 0) {
    const pct = Math.round((elevationM / targetElevationM) * 100);
    if (pct >= 80 && pct <= 125) {
      reasons.push(`✓ ${elevationM} m vs ${targetElevationM} m target`);
    } else if (pct < 80) {
      reasons.push(`${elevationM} m — flatter than target (${pct}%)`);
    } else {
      reasons.push(`${elevationM} m — hillier than target (${pct}%)`);
    }
  }

  // Surface — only call out when it's a strong match for the cycling type.
  const wantPaved = cyclingType === 'road';
  const wantUnpaved = cyclingType === 'gravel' || cyclingType === 'mtb';
  if (reasons.length < 2) {
    if (wantPaved && (surfaceType === 'asphalt' || surfaceType === 'paved')) {
      reasons.push('Mostly paved');
    } else if (wantUnpaved && (surfaceType === 'gravel' || surfaceType === 'unpaved')) {
      reasons.push('Mostly off-road');
    } else if (surfaceType !== 'unknown') {
      reasons.push(`Surface: ${surfaceType}`);
    }
  }

  return reasons.slice(0, 2);
}

const STRAVA_ROUTES_UPLOAD_URL = 'https://www.strava.com/routes/new';
const RWGPS_UPLOAD_URL = 'https://ridewithgps.com/upload';
const KOMOOT_PLAN_URL = 'https://www.komoot.com/plan';
const GARMIN_CONNECT_URL = 'https://connect.garmin.com/modern/courses-by-activity/cycling';

export function SessionRoutePicker({ sessionId, zone, durationMinutes, targetElevationM, targetSurface }: SessionRoutePickerProps) {
  const { prefs, update: updatePrefs } = useTrainingPrefs();
  const [tab, setTab] = useState<SourceTab>('generate');
  const [address, setAddress] = useState(prefs.start_address ?? '');
  const [routes, setRoutes] = useState<DisplayRoute[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<SourceTab | null>(null);
  const [error, setError] = useState<string | null>(null);
  // v10.8.0 — initialize elevation pref from AI plan target when present.
  // Bands: low <15 m/km, medium 15-30 m/km, high 30+ m/km.
  const [elevationPref, setElevationPref] = useState<ElevationPreference>(() => {
    if (targetElevationM == null || durationMinutes == null || durationMinutes <= 0) return 'medium';
    const targetKm = (durationMinutes / 60) * 25; // rough Z2 pace baseline
    if (targetKm <= 0) return 'medium';
    const mPerKm = targetElevationM / targetKm;
    if (mPerKm < 15) return 'low';
    if (mPerKm < 30) return 'medium';
    return 'high';
  });
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
  // v10.7.0 — auto-fetch on switch for the saved-route tabs (founder
  // feedback: "i miss the saved routes from strava" — making the user
  // click an extra button hides the routes by default). Generate-new
  // tab still requires explicit submit because it has form inputs.
  useEffect(() => {
    setRoutes(null);
    setSelectedId(null);
    setError(null);
    if (tab === 'strava') {
      handleFindStravaSaved();
    } else if (tab === 'rwgps' && rwgpsConnected === true) {
      handleFindRwgpsSaved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rwgpsConnected]);

  const targetDistance = estimateDistanceKm(durationMinutes, zone);
  // v10.8.0 — prefer per-session surface (AI plan) over user-pref baseline.
  const sessionSurface = targetSurface
    ? targetSurface.toLowerCase() === 'paved' ? 'paved'
      : targetSurface.toLowerCase() === 'gravel' ? 'gravel'
      : prefs.surface_pref
    : prefs.surface_pref;
  const cyclingType = surfaceToCyclingType(sessionSurface);

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
          reasons: buildReasons({
            distanceKm: r.distance_km,
            targetDistanceKm: targetDistance,
            elevationM: r.elevation_gain_m,
            targetElevationM: targetElevationM ?? null,
            surfaceType: r.surface_type,
            cyclingType,
          }),
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
  // v10.13.0 (Sprint 11 bug 2): geocode the saved start_address (when
  // present) and pass lat/lng to the backend so saved routes that don't
  // start near the user's session anchor (e.g. a hike in Positano while
  // they're cycling in Zurich) can be filtered out by a 50 km radius
  // gate. We don't *block* fetching when no address is configured — we
  // just skip the anchor filter. Better to surface routes than nag.
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
      // Try to geocode the saved start_address for anchor relevance.
      // Failures here are non-fatal — fall through to a non-anchored
      // fetch so the user still sees their saved routes.
      let anchor: { lat: number; lng: number } | null = null;
      const trimmed = (prefs.start_address ?? address).trim();
      if (trimmed) {
        try {
          const geo = await geocodeAddress(trimmed);
          if (geo) anchor = { lat: geo.lat, lng: geo.lng };
        } catch {
          // Network blip on Nominatim — don't block the Strava fetch.
        }
      }
      const saved = await fetchSavedStravaRoutes({
        distanceKm: targetDistance,
        surface,
        ...(anchor ? { lat: anchor.lat, lng: anchor.lng } : {}),
      });
      if (!Array.isArray(saved) || saved.length === 0) {
        setError(`No Strava saved routes match ~${targetDistance} km.`);
        return;
      }
      const display: DisplayRoute[] = saved
        .map<DisplayRoute>((r) => {
          const km = r.distance_m / 1000;
          const delta = Math.abs(km - targetDistance) / targetDistance;
          const score = Math.max(0, 1 - delta * 5);
          const distanceRounded = Number(km.toFixed(1));
          const elevationRounded = Math.round(r.elevation_gain_m);
          return {
            source: 'strava' as const,
            id: `strava_${r.id}`,
            name: r.name,
            distance_km: distanceRounded,
            elevation_gain_m: elevationRounded,
            surface_type: r.surface,
            score: Number(score.toFixed(3)),
            strava_url: r.strava_url,
            reasons: buildReasons({
              distanceKm: distanceRounded,
              targetDistanceKm: targetDistance,
              elevationM: elevationRounded,
              targetElevationM: targetElevationM ?? null,
              surfaceType: r.surface,
              cyclingType,
            }),
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
          const distanceRounded = Number(km.toFixed(1));
          const elevationRounded = Math.round(r.elevation_gain_m);
          return {
            source: 'rwgps' as const,
            id: `rwgps_${r.id}`,
            name: r.name,
            distance_km: distanceRounded,
            elevation_gain_m: elevationRounded,
            surface_type: r.surface,
            score: Number(score.toFixed(3)),
            rwgps_url: r.rwgps_url,
            reasons: buildReasons({
              distanceKm: distanceRounded,
              targetDistanceKm: targetDistance,
              elevationM: elevationRounded,
              targetElevationM: targetElevationM ?? null,
              surfaceType: r.surface,
              cyclingType,
            }),
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

  // v10.7.0 — Disconnect RWGPS. Deletes server-side tokens row and resets
  // the local connected flag so the tab reverts to the "Connect" empty state.
  const handleDisconnectRwgps = async () => {
    try {
      await disconnectRwgps();
      setRwgpsConnected(false);
      setRoutes(null);
      setSelectedId(null);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not disconnect.';
      setError(msg);
    }
  };

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

      {/* Tab 2 — Strava saved (auto-loads on tab switch in v10.7.0) */}
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
              {pending === 'strava' ? 'Loading Strava…' : 'Refresh Strava routes'}
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
                      : 'Refresh Ride with GPS routes'}
                </Button>
                {/* v10.7.0 — Disconnect button. Calls /api/rwgps/disconnect
                    and resets local state so user can re-connect from a
                    different RWGPS account if desired. */}
                <button
                  type="button"
                  className={styles.disconnectBtn}
                  onClick={handleDisconnectRwgps}
                  disabled={pending !== null}
                  title="Disconnect Ride with GPS"
                >
                  Disconnect
                </button>
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
                  {/* v10.10.0 — match-reasons. 1-2 plain-English bullets
                      explaining why this route scored where it did. */}
                  {r.reasons.length > 0 && (
                    <ul className={styles.cardReasons}>
                      {r.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  )}
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
