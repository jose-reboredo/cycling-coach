// Vitest unit tests for useAiReport + useRideFeedback — instanceof CoachError
// guard (#40): a network TypeError must NOT set invalidKey=true.

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAiReport } from '../useAiReport';
import { useRideFeedback } from '../useRideFeedback';
import type { CoachStats, CoachRecentRide, RideForCoach, RideContext } from '../../lib/coachApi';

// Mock coachApi so we can force throws.
vi.mock('../../lib/coachApi', async (importActual) => {
  const actual = await importActual<typeof import('../../lib/coachApi')>();
  return {
    ...actual,
    generateWeeklyReport: vi.fn(),
    generateRideFeedback: vi.fn(),
  };
});

// Mock storage so hooks don't rely on localStorage for initial state.
vi.mock('../../lib/storage', () => ({
  storage: { get: () => null, set: vi.fn(), del: vi.fn() },
  KEYS: { aiReport: 'aiReport', rideFeedback: 'rideFeedback' },
}));

const minimalStats: CoachStats = {
  rideCount: 5,
  totalDistance: 200,
  totalElevation: 800,
  avgSpeed: 25,
  longestRide: 60,
  fastestRide: 35,
  yearDistance: 600,
  recentRideCount: 2,
  recentDistance: 80,
};

const minimalRecent: CoachRecentRide[] = [];

const minimalRide: RideForCoach = {
  name: 'Morning ride',
  distance_km: 40,
  duration_min: 80,
  elevation_m: 300,
  avg_speed_kmh: 30,
};

const minimalContext: RideContext = {
  totalRides: 20,
  avgDistance: 45,
  longestRide: 80,
  avgSpeed: 28,
};

describe('useAiReport — instanceof CoachError guard (#40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('network TypeError sets invalidKey=false and stravaExpired=false', async () => {
    const { generateWeeklyReport } = await import('../../lib/coachApi');
    vi.mocked(generateWeeklyReport).mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAiReport());

    await act(async () => {
      try {
        await result.current.generate({
          apiKey: 'sk-ant-test',
          sessionsPerWeek: 3,
          athlete: { firstname: 'Test' },
          stats: minimalStats,
          recent: minimalRecent,
        });
      } catch {
        // expected to rethrow
      }
    });

    expect(result.current.invalidKey).toBe(false);
    expect(result.current.stravaExpired).toBe(false);
    expect(result.current.error).toBe('Failed to fetch');
  });

  test('CoachError with invalidKey=true propagates correctly', async () => {
    const { generateWeeklyReport, CoachError } = await import('../../lib/coachApi');
    vi.mocked(generateWeeklyReport).mockRejectedValue(
      new CoachError('invalid-key', true, false),
    );

    const { result } = renderHook(() => useAiReport());

    await act(async () => {
      try {
        await result.current.generate({
          apiKey: 'bad-key',
          sessionsPerWeek: 3,
          athlete: { firstname: 'Test' },
          stats: minimalStats,
          recent: minimalRecent,
        });
      } catch {
        // expected to rethrow
      }
    });

    expect(result.current.invalidKey).toBe(true);
    expect(result.current.stravaExpired).toBe(false);
  });
});

describe('useRideFeedback — instanceof CoachError guard (#40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('network TypeError sets stravaExpired=false and generic error message', async () => {
    const { generateRideFeedback } = await import('../../lib/coachApi');
    vi.mocked(generateRideFeedback).mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useRideFeedback());

    await act(async () => {
      try {
        await result.current.fetch('ride-1', {
          apiKey: 'sk-ant-test',
          athlete: { firstname: 'Test' },
          context: minimalContext,
          ride: minimalRide,
        });
      } catch {
        // expected to rethrow
      }
    });

    expect(result.current.stravaExpired).toBe(false);
    expect(result.current.errors['ride-1']).toBe('Failed to fetch');
  });

  test('CoachError with stravaExpired=true propagates correctly', async () => {
    const { generateRideFeedback, CoachError } = await import('../../lib/coachApi');
    vi.mocked(generateRideFeedback).mockRejectedValue(
      new CoachError('strava-session-expired', false, true),
    );

    const { result } = renderHook(() => useRideFeedback());

    await act(async () => {
      try {
        await result.current.fetch('ride-2', {
          apiKey: 'sk-ant-test',
          athlete: { firstname: 'Test' },
          context: minimalContext,
          ride: minimalRide,
        });
      } catch {
        // expected to rethrow
      }
    });

    expect(result.current.stravaExpired).toBe(true);
  });
});
