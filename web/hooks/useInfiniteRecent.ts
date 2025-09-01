'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RecentResponse, RecentMediaNode } from '@/lib/types';

/**
 * /media/recent를 커서 기반으로 불러오는 훅
 * - limit: 페이지당 개수
 * - getNextPageParam: hasNextPage면 endCursor 반환
 */
export function useInfiniteRecent(limit = 8) {
  const query = useInfiniteQuery<RecentResponse>({
    queryKey: ['recent', limit],
    queryFn: async ({ pageParam }) => {
      const res = await api.get<RecentResponse>('/media/recent', {
        params: { limit, cursor: pageParam },
      });
      return res.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.pageInfo?.hasNextPage
        ? (lastPage.pageInfo.endCursor ?? undefined)
        : undefined,
  });

  const items: RecentMediaNode[] = (query.data?.pages ?? []).flatMap(
    p => p.nodes
  );
  return { ...query, items };
}
