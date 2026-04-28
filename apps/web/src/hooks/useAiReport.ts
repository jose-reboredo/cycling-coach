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
        const err = e as CoachError;
        setError(err.message);
        setInvalidKey(err.invalidKey);
        throw err;
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

  return { report, loading, error, invalidKey, generate, clear };
}
