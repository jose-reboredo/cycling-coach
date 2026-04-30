// Vitest unit tests for coachApi.ts
// Tests the postJson auth layer: stravaExpired path (null tokens) and
// happy path (valid tokens + 200 response).

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { generateWeeklyReport, type CoachStats, type CoachRecentRide } from './coachApi';

// Mock ./auth so we can control ensureValidToken return value per test.
vi.mock('./auth', () => ({
  ensureValidToken: vi.fn(),
}));

// Minimal valid args for generateWeeklyReport.
const minimalStats: CoachStats = {
  rideCount: 10,
  totalDistance: 500,
  totalElevation: 2000,
  avgSpeed: 28,
  longestRide: 80,
  fastestRide: 45,
  yearDistance: 1200,
  recentRideCount: 4,
  recentDistance: 200,
};

const minimalRecent: CoachRecentRide[] = [
  {
    name: 'Test Ride',
    distance_km: 50,
    duration_min: 90,
    elevation_m: 400,
    avg_speed_kmh: 28,
    date: '2026-04-28',
  },
];

const minimalArgs = {
  apiKey: 'sk-ant-test',
  sessionsPerWeek: 3,
  athlete: { firstname: 'Test' },
  stats: minimalStats,
  recent: minimalRecent,
};

describe('coachApi — postJson auth layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('throws CoachError with stravaExpired=true when ensureValidToken returns null', async () => {
    // Import the mocked module and set return value to null (no tokens).
    const { ensureValidToken } = await import('./auth');
    vi.mocked(ensureValidToken).mockResolvedValue(null);

    await expect(generateWeeklyReport(minimalArgs)).rejects.toMatchObject({
      stravaExpired: true,
      invalidKey: false,
    });
  });

  test('resolves successfully when tokens are valid and fetch returns 200', async () => {
    // Provide valid tokens.
    const { ensureValidToken } = await import('./auth');
    vi.mocked(ensureValidToken).mockResolvedValue({
      access_token: 'xxx',
      refresh_token: 'yyy',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    // Mock global fetch to return a valid AiReport shape.
    const mockReport = {
      summary: 'Good week',
      strengths: ['Consistency'],
      areasToImprove: ['Speed'],
      weeklyPlan: {
        monday: 'Rest',
        tuesday: 'Tempo 60min',
        wednesday: 'Easy spin',
        thursday: 'Rest',
        friday: 'Intervals',
        saturday: 'Long ride 90min',
        sunday: 'Recovery',
      },
      sessions_per_week: 3,
      motivation: 'Keep going!',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockReport), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await generateWeeklyReport(minimalArgs);

    expect(result).toMatchObject({
      summary: 'Good week',
      strengths: ['Consistency'],
      sessions_per_week: 3,
    });
    // generated_at stamped client-side
    expect(typeof result.generated_at).toBe('number');

    // Assert Authorization header was sent.
    expect(fetchSpy).toHaveBeenCalledOnce();
    const call = fetchSpy.mock.calls[0];
    const init = call?.[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer xxx');

    fetchSpy.mockRestore();
  });
});
