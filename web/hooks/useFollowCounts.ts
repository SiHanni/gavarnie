'use client';
import { useQuery } from '@tanstack/react-query';
import { getFollowerCount } from '@/lib/http';

export function useFollowCounts(userId: string) {
  return useQuery({
    queryKey: ['followCounts', userId],
    queryFn: () => getFollowerCount(userId),
  });
}
