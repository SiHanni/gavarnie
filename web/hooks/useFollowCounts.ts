'use client';
import { useQuery } from '@tanstack/react-query';
import { getFollowCounts } from '@/lib/http';

export function useFollowCounts(handle: string) {
  return useQuery({
    queryKey: ['followCounts', handle],
    queryFn: () => getFollowCounts(handle),
  });
}
