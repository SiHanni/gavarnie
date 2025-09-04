// web/src/hooks/useFollow.ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowerCount,
} from '@/lib/http';

export function useFollow(userId: string | null) {
  const qc = useQueryClient();

  // 상태 조회
  const statusQ = useQuery({
    queryKey: ['follow', 'status', userId],
    queryFn: () => getFollowStatus(userId!),
    enabled: !!userId,
  });

  // 카운트 조회
  const countQ = useQuery({
    queryKey: ['follow', 'followers-count', userId],
    queryFn: () => getFollowerCount(userId!),
    enabled: !!userId,
  });

  const followMut = useMutation({
    mutationFn: () => followUser(userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow', 'status', userId] });
      qc.invalidateQueries({ queryKey: ['follow', 'followers-count', userId] });
    },
  });

  const unfollowMut = useMutation({
    mutationFn: () => unfollowUser(userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow', 'status', userId] });
      qc.invalidateQueries({ queryKey: ['follow', 'followers-count', userId] });
    },
  });

  const toggle = () => {
    const following = statusQ.data?.following ?? false;
    return following ? unfollowMut.mutate() : followMut.mutate();
  };

  return {
    following: statusQ.data?.following ?? false,
    followerCount: countQ.data?.count ?? 0,
    isLoading: statusQ.isLoading || countQ.isLoading,
    toggling: followMut.isPending || unfollowMut.isPending,
    toggle,
    refetch: () => {
      statusQ.refetch();
      countQ.refetch();
    },
  };
}
