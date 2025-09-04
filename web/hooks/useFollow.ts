'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, unfollowUser, getFollowStatus } from '@/lib/http';

export function useFollow(targetUserId: string) {
  const qc = useQueryClient();
  const qKey = ['isFollowing', targetUserId];

  const q = useQuery({
    queryKey: qKey,
    queryFn: () => getFollowStatus(targetUserId),
  });

  const mut = useMutation({
    mutationFn: async (now: boolean) => {
      return now ? unfollowUser(targetUserId) : followUser(targetUserId);
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
    isLoading: q.isLoading || mut.isPending,
    toggle: () => mut.mutate(!!q.data?.following),
  };
}
