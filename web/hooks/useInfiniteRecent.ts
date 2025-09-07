'use client';

import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RecentResponse, RecentMediaNode } from '@/lib/types';
import { fetchUserMedia, type UserMediaResponse } from '@/lib/http';

export const RECENT_QUERY_KEY = 'recent';

type Page = RecentResponse | UserMediaResponse;
type QK = [typeof RECENT_QUERY_KEY, number, 'ownerHandle', string | null];

/**
 * 기본: /media/recent
 * ownerHandle이 있으면: /u/:handle/media
 */
export function useInfiniteRecent(
  limit = 8,
  opts?: { ownerHandle?: string | null }
) {
  const ownerHandle = opts?.ownerHandle ?? null;
  const client = useQueryClient();

  const query = useInfiniteQuery<Page, unknown, Page, QK, string | undefined>({
    queryKey: [RECENT_QUERY_KEY, limit, 'ownerHandle', ownerHandle],
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam;
      if (ownerHandle) {
        return fetchUserMedia(ownerHandle, limit, cursor);
      }
      const res = await api.get<RecentResponse>('/media/recent', {
        params: { limit, cursor },
      });
      return res.data;
    },
    getNextPageParam: last =>
      last.pageInfo?.hasNextPage
        ? (last.pageInfo.endCursor ?? undefined)
        : undefined,
  });

  const inf = query.data as InfiniteData<Page> | undefined;
  const pages: Page[] = inf?.pages ?? [];
  const items: RecentMediaNode[] = pages.flatMap(
    p => (p as any).nodes as RecentMediaNode[]
  );

  const refreshHard = () =>
    client.removeQueries({
      queryKey: [RECENT_QUERY_KEY, limit, 'ownerHandle', ownerHandle],
    });

  return { ...query, items, refreshHard };
}
