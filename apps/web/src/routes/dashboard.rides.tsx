import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Container } from '../components/Container/Container';
import { Pill } from '../components/Pill/Pill';
import { ZonePill } from '../components/ZonePill/ZonePill';
import { RideDetail } from '../components/RideDetail/RideDetail';
import { RideFeedbackPanel } from '../components/RideFeedback/RideFeedback';
import { useAthleteProfile } from '../hooks/useAthleteProfile';
import { useApiKey } from '../hooks/useApiKey';
import { useRideFeedback } from '../hooks/useRideFeedback';
import { useRides } from '../hooks/useStravaData';
import { readTokens } from '../lib/auth';
import { fmtKm, fmtDurationShort, fmtRelative } from '../lib/format';
import { computeStats } from '../lib/coachUtils';
import { MARCO, MOCK_ACTIVITIES, type MockActivity } from '../lib/mockMarco';
import styles from './TabShared.module.css';

export const Route = createFileRoute('/dashboard/rides')({
  component: RidesTab,
});

const PAGE_SIZE = 10;

function RidesTab() {
  const tokens = readTokens();
  const isDemo = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('demo') === '1',
    [],
  );
  const usingMock = !tokens || isDemo;

  const profile = useAthleteProfile();
  const ftpForRides = usingMock ? MARCO.ftp : profile.profile.ftp ?? 0;
  const { rides: realRides, athlete } = useRides({
    enabled: !usingMock,
    ftp: ftpForRides,
  });

  const activities = usingMock ? MOCK_ACTIVITIES : realRides;
  const firstName = usingMock ? MARCO.firstName : athlete?.firstname ?? 'You';
  // All rides sorted by date descending
  const allRides = useMemo(
    () => activities.slice().sort((a, b) => b.date.localeCompare(a.date)),
    [activities],
  );

  const totalPages = Math.max(1, Math.ceil(allRides.length / PAGE_SIZE));

  // Pagination state
  const [page, setPage] = useState(1);
  const [openFeedbackId, setOpenFeedbackId] = useState<number | null>(null);
  const [openDetailId, setOpenDetailId] = useState<number | null>(null);

  const { key: apiKey } = useApiKey();
  const rideFeedback = useRideFeedback();

  const coachStats = useMemo(() => {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const yearKm = activities.filter((a) => a.date >= yearStart).reduce((s, a) => s + a.distanceKm, 0);
    return computeStats(activities, yearKm);
  }, [activities]);

  const pageRides = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return allRides.slice(start, start + PAGE_SIZE);
  }, [allRides, page]);

  const handleAskRide = async (rideId: number, ride: MockActivity) => {
    if (!apiKey) return;
    setOpenFeedbackId(rideId);
    try {
      await rideFeedback.fetch(rideId, {
        apiKey,
        athlete: { firstname: firstName },
        context: {
          totalRides: coachStats.rideCount,
          avgDistance: Math.round(coachStats.totalDistance / Math.max(coachStats.rideCount, 1)),
          longestRide: coachStats.longestRide,
          avgSpeed: coachStats.avgSpeed,
        },
        ride: {
          name: ride.name,
          distance_km: Math.round(ride.distanceKm * 10) / 10,
          duration_min: Math.round(ride.durationSec / 60),
          elevation_m: Math.round(ride.elevationM),
          avg_speed_kmh: Number(
            (ride.distanceKm / Math.max(ride.durationSec / 3600, 0.001)).toFixed(1),
          ),
          heartrate: ride.hr,
          pr_count: ride.prCount,
        },
      });
    } catch {
      /* error captured in rideFeedback.errors */
    }
  };

  return (
    <div className={styles.tabRoot}>
      <Container width="wide">
        <h1 className={styles.tabHeading}>Recent rides</h1>

        {allRides.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No rides yet. Once you log a ride on Strava it will show up here.</p>
          </div>
        ) : (
          <>
            <motion.div
              className={styles.rides}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              {pageRides.map((r) => {
                const cached = rideFeedback.get(r.id);
                const fbOpen = openFeedbackId === r.id || !!cached;
                const fbLoading = rideFeedback.loadingId === String(r.id);
                const fbError = rideFeedback.errors[String(r.id)];
                const detailOpen = openDetailId === r.id;
                return (
                  <article key={r.id} className={styles.ride}>
                    <button
                      type="button"
                      className={styles.rideTop}
                      onClick={() => setOpenDetailId(detailOpen ? null : r.id)}
                      aria-expanded={detailOpen}
                      aria-label={`Toggle detail for ${r.name}`}
                    >
                      <div className={styles.rideMain}>
                        <h4 className={styles.rideName}>
                          {r.name}
                          <span
                            className={`${styles.rideChev} ${detailOpen ? styles.rideChevOpen : ''}`}
                            aria-hidden="true"
                          >
                            ›
                          </span>
                        </h4>
                        <div className={styles.rideMeta}>
                          <ZonePill zone={r.primaryZone} size="sm" />
                          <span>{fmtRelative(r.date)}</span>
                          {r.type === 'VirtualRide' ? <Pill>Indoor</Pill> : null}
                          {r.prCount > 0 ? <Pill tone="accent">{r.prCount} PR</Pill> : null}
                        </div>
                      </div>
                      <div className={styles.rideStats}>
                        <span>
                          <strong>{fmtKm(r.distanceKm * 1000)}</strong> km
                        </span>
                        <span>
                          <strong>{fmtDurationShort(r.durationSec)}</strong>
                        </span>
                        <span>
                          <strong>{r.tss}</strong> TSS
                        </span>
                        <span>
                          <strong>{r.npWatts || '—'}</strong> NP
                        </span>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {detailOpen ? (
                        <RideDetail
                          key="detail"
                          rideId={r.id}
                          enabled={detailOpen}
                          {...(usingMock
                            ? {
                                fallback: {
                                  name: r.name,
                                  distanceKm: r.distanceKm,
                                  durationSec: r.durationSec,
                                  elevationM: r.elevationM,
                                  avgWatts: r.avgWatts,
                                  npWatts: r.npWatts,
                                  hr: r.hr,
                                  tss: r.tss,
                                },
                              }
                            : {})}
                        />
                      ) : null}
                    </AnimatePresence>

                    <div className={styles.rideActions}>
                      {fbOpen ? (
                        <RideFeedbackPanel
                          loading={fbLoading}
                          {...(fbError !== undefined ? { error: fbError } : {})}
                          {...(cached !== undefined ? { feedback: cached } : {})}
                          onAsk={() => handleAskRide(r.id, r)}
                          disabled={!apiKey}
                        />
                      ) : (
                        <RideFeedbackPanel
                          loading={false}
                          onAsk={() => handleAskRide(r.id, r)}
                          disabled={!apiKey}
                        />
                      )}
                    </div>
                  </article>
                );
              })}
            </motion.div>

            {/* PAGINATION */}
            <nav className={styles.pagination} aria-label="Rides pagination">
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                ← Prev
              </button>
              <span className={styles.pageInfo}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                Next →
              </button>
            </nav>
          </>
        )}
      </Container>
    </div>
  );
}
