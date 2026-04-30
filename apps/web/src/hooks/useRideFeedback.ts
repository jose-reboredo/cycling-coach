import { useCallback, useState } from 'react';
import { storage, KEYS } from '../lib/storage';
import {
  generateRideFeedback,
  CoachError,
  type RideFeedback,
  type RideForCoach,
  type RideContext,
} from '../lib/coachApi';

type FeedbackMap = Record<string, RideFeedback>;

export function useRideFeedback() {
  const [map, setMap] = useState<FeedbackMap>(
    () => storage.get<FeedbackMap>(KEYS.rideFeedback) ?? {},
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stravaExpired, setStravaExpired] = useState(false);

  const get = useCallback((rideId: string | number) => map[String(rideId)], [map]);

  const fetch = useCallback(
    async (
      rideId: string | number,
      args: {
        apiKey: string;
        athlete: { firstname: string };
        context: RideContext;
        ride: RideForCoach;
      },
    ) => {
      const id = String(rideId);
      setLoadingId(id);
      setStravaExpired(false);
      setErrors((e) => ({ ...e, [id]: '' }));
      try {
        const feedback = await generateRideFeedback({
          athlete: args.athlete,
          context: args.context,
          ride: args.ride,
          apiKey: args.apiKey,
        });
        setMap((prev) => {
          const next = { ...prev, [id]: feedback };
          storage.set(KEYS.rideFeedback, next);
          return next;
        });
        return feedback;
      } catch (e) {
        if (e instanceof CoachError) {
          setErrors((es) => ({ ...es, [id]: e.message }));
          setStravaExpired(e.stravaExpired);
        } else {
          // network / unknown error: generic message, stravaExpired stays false (#40)
          setErrors((es) => ({ ...es, [id]: e instanceof Error ? e.message : 'Network error' }));
          setStravaExpired(false);
        }
        throw e;
      } finally {
        setLoadingId(null);
      }
    },
    [],
  );

  const clear = useCallback((rideId: string | number) => {
    const id = String(rideId);
    setMap((prev) => {
      const next = { ...prev };
      delete next[id];
      storage.set(KEYS.rideFeedback, next);
      return next;
    });
  }, []);

  return { get, fetch, loadingId, errors, stravaExpired, clear };
}
