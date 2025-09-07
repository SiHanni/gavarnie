'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  followUser,
  unfollowUser,
  getFollowStatus,
  getAccessToken,
} from '@/lib/http';

export function useFollow(targetHandle: string, opts?: { enabled?: boolean }) {
  const qc = useQueryClient();
  const qKey = ['isFollowing', targetHandle];

  const enabled = opts?.enabled ?? (!!getAccessToken() && !!targetHandle);

  const q = useQuery({
    queryKey: qKey,
    queryFn: () => getFollowStatus(targetHandle),
    enabled,
    staleTime: 30_000,
  });

  const mut = useMutation({
    mutationFn: async (now: boolean) => {
      return now ? unfollowUser(targetHandle) : followUser(targetHandle);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qKey });
      const prev = qc.getQueryData<{ following: boolean }>(qKey);
      qc.setQueryData(qKey, { following: !prev?.following });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  return {
    isFollowing: !!q.data?.following,
    isLoading: (enabled && q.isLoading) || mut.isPending,
    toggle: () => mut.mutate(!!q.data?.following),
  };
}
