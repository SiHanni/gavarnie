'use client';
import { useQuery } from '@tanstack/react-query';
import { getFollowCounts } from '@/lib/http';

export function useFollowCounts(userId: string) {
  return useQuery({
    queryKey: ['followCounts', userId],
    queryFn: () => getFollowCounts(userId),
  });
}
