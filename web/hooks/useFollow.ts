'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, unfollowUser, getFollowStatus } from '@/lib/http';
import { getAccessToken } from '@/lib/http'; // ⬅️ 추가

export function useFollow(
  targetUserId: string,
  opts?: { enabled?: boolean } // ⬅️ 로그인 여부로 enable 제어
) {
  const qc = useQueryClient();
  const qKey = ['isFollowing', targetUserId];

  const enabled = opts?.enabled ?? !!getAccessToken(); // ⬅️ 기본: 토큰 있을 때만

  const q = useQuery({
    queryKey: qKey,
    queryFn: () => getFollowStatus(targetUserId),
    enabled, // ⬅️ 중요: 로그아웃이면 요청 안 함
    staleTime: 30_000,
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
    isFollowing: !!q.data?.following, // 로그아웃이면 false
    isLoading: (enabled && q.isLoading) || mut.isPending,
    toggle: () => mut.mutate(!!q.data?.following),
  };
}
