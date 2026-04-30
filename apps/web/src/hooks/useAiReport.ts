import { useCallback, useState } from 'react';
import { storage, KEYS } from '../lib/storage';
import {
  generateWeeklyReport,
  CoachError,
  type AiReport,
  type CoachStats,
  type CoachRecentRide,
} from '../lib/coachApi';

export function useAiReport() {
  const [report, setReport] = useState<AiReport | null>(() =>
    storage.get<AiReport>(KEYS.aiReport),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidKey, setInvalidKey] = useState(false);
  const [stravaExpired, setStravaExpired] = useState(false);

  const generate = useCallback(
    async (args: {
      apiKey: string;
      sessionsPerWeek: number;
      athlete: { firstname: string };
      stats: CoachStats;
      recent: CoachRecentRide[];
    }) => {
      setLoading(true);
      setError(null);
      setInvalidKey(false);
      setStravaExpired(false);
      try {
        const fresh = await generateWeeklyReport({
          athlete: args.athlete,
          stats: args.stats,
          recent: args.recent,
          apiKey: args.apiKey,
          sessionsPerWeek: args.sessionsPerWeek,
        });
        storage.set(KEYS.aiReport, fresh);
        setReport(fresh);
        return fresh;
      } catch (e) {
        if (e instanceof CoachError) {
          setError(e.message);
          setInvalidKey(e.invalidKey);
          setStravaExpired(e.stravaExpired);
        } else {
          // network / unknown error: show generic message, NOT invalidKey (#40)
          setError(e instanceof Error ? e.message : 'Network error');
          setInvalidKey(false);
          setStravaExpired(false);
        }
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    storage.del(KEYS.aiReport);
    setReport(null);
  }, []);

  return { report, loading, error, invalidKey, stravaExpired, generate, clear };
}
