'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RecentResponse, RecentMediaNode } from '@/lib/types';

export const RECENT_QUERY_KEY = 'recent';
/**
 * /media/recent를 커서 기반으로 불러오는 훅
 * - limit: 페이지당 개수
 * - getNextPageParam: hasNextPage면 endCursor 반환
 */
export function useInfiniteRecent(limit = 8) {
  const client = useQueryClient();

  const query = useInfiniteQuery<RecentResponse>({
    queryKey: [RECENT_QUERY_KEY, limit],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await api.get<RecentResponse>('/media/recent', {
        params: { limit, cursor: pageParam },
      });
      return res.data;
    },

    getNextPageParam: lastPage =>
      lastPage.pageInfo?.hasNextPage
        ? (lastPage.pageInfo.endCursor ?? undefined)
        : undefined,
  });

  const items: RecentMediaNode[] = (query.data?.pages ?? []).flatMap(
    p => p.nodes
  );
  const refreshHard = () =>
    client.removeQueries({ queryKey: [RECENT_QUERY_KEY, limit] });

  return { ...query, items, refreshHard };
}
