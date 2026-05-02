// v10.8.0 Phase A — Client for the AI plan endpoints.

import { ensureValidToken } from './auth';

export interface AiPlanSession {
  id: number;
  week_start_date: string;
  suggested_date: string;
  title: string;
  target_zone: string | null;
  duration: number | null;
  elevation_gained: number | null;
  surface: string | null;
  reasoning: string | null;
}

export interface AiPlan {
  athlete_id: number;
  generated_at?: number;
  week_start_date?: string;
  weeks_count: number;
  sessions: AiPlanSession[];
}

export interface AlternativeGoal {
  name_suggestion?: string;
  distance_km: number;
  elevation_m: number;
  weeks_required: number;
}

export type PlanResponse =
  | { feasible: true; plan: AiPlan }
  | { feasible: false; block_reason: string; alternative_goal: AlternativeGoal | null };

export async function generatePlan(opts: { weeks?: number; force?: boolean } = {}): Promise<PlanResponse> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/plan/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ weeks: opts.weeks ?? 4, force: opts.force ?? false }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `plan generate failed (${res.status})`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await res.json()) as PlanResponse;
}

export async function fetchCurrentPlan(): Promise<PlanResponse> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/plan/current', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (res.status === 404) {
    throw new Error('no_plan');
  }
  if (!res.ok) {
    const text = await res.text();
    let msg = `plan fetch failed (${res.status})`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await res.json()) as PlanResponse;
}

export interface SchedulePlanInput {
  ai_plan_session_id: number;
  /** ISO datetime or unix sec. */
  session_date: string | number;
  overrides?: {
    title?: string;
    duration_minutes?: number;
    elevation_gained?: number;
    surface?: string;
    target_zone?: string;
  };
}

export interface SchedulePlanResult {
  planned_session_id: number;
  session_date: number;
  ai_plan_session_id: number;
}

// v10.9.0 — server-side Strava OAuth status. When `server_side: true`,
// the user has migrated to D1-stored tokens and Strava webhooks can
// auto-regenerate their AI plan. UI surfaces "Auto-updates ON" badge.
export interface StravaAuthStatus {
  server_side: boolean;
  expires_at: number | null;
}

export async function fetchStravaAuthStatus(): Promise<StravaAuthStatus> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/auth/strava-status', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!res.ok) throw new Error(`strava-status ${res.status}`);
  return (await res.json()) as StravaAuthStatus;
}

export async function schedulePlanSession(input: SchedulePlanInput): Promise<SchedulePlanResult> {
  const tokens = await ensureValidToken();
  if (!tokens) throw new Error('not_authenticated');
  const res = await fetch('/api/plan/schedule', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `plan schedule failed (${res.status})`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return (await res.json()) as SchedulePlanResult;
}
