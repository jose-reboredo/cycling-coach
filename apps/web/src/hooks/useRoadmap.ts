// useRoadmap — pulls the public roadmap from /roadmap (which proxies GitHub
// Issues). Falls back to the static `lib/roadmap.ts` seed when the request
// fails or returns no items, so the page is never empty.

import { useQuery } from '@tanstack/react-query';
import { ROADMAP as FALLBACK, type RoadmapItem } from '../lib/roadmap';

export interface RoadmapResponse {
  repo?: string;
  fetched_at: number;
  count?: number;
  items: RoadmapItem[];
}

export function useRoadmap() {
  const q = useQuery<RoadmapResponse>({
    queryKey: ['roadmap'],
    queryFn: async () => {
      const res = await fetch('/roadmap');
      if (!res.ok) throw new Error(`roadmap ${res.status}`);
      return (await res.json()) as RoadmapResponse;
    },
    placeholderData: { fetched_at: 0, items: FALLBACK },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // When GitHub returns nothing yet (issues not bootstrapped) fall back so
  // the page still has something to render.
  const items: RoadmapItem[] =
    q.data && q.data.items.length > 0 ? q.data.items : FALLBACK;
  const fromGitHub = (q.data?.items.length ?? 0) > 0;

  return {
    items,
    fromGitHub,
    repo: q.data?.repo,
    fetchedAt: q.data?.fetched_at ?? 0,
    isLoading: q.isLoading,
    error: q.error as Error | null,
    refetch: q.refetch,
  };
}
