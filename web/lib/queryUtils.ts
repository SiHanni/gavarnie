import { QueryClient, type InfiniteData } from '@tanstack/react-query';

type RecentPage = {
  nodes: { id: string; commentCount?: number }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

/** 액션바에 쓰이는 commentCount를 캐시에서 즉시 증감 */
export function bumpRecentCommentCount(
  qc: QueryClient,
  mediaId: string,
  delta: number
) {
  const entries = qc.getQueriesData<InfiniteData<RecentPage>>({
    queryKey: ['recent'],
  });

  for (const [key, data] of entries) {
    if (!data) continue;
    qc.setQueryData<InfiniteData<RecentPage>>(key, old => {
      if (!old) return old;
      return {
        pageParams: [...old.pageParams],
        pages: old.pages.map(p => ({
          ...p,
          nodes: p.nodes.map(n =>
            n.id === mediaId
              ? {
                  ...n,
                  commentCount: Math.max(0, (n.commentCount ?? 0) + delta),
                }
              : n
          ),
        })),
      };
    });
  }
}
