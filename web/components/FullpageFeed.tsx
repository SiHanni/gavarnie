'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { request, fetchUserMedia } from '@/lib/http';
import { useInfiniteRecent } from '@/hooks/useInfiniteRecent';
import { useSearchParams } from 'next/navigation';
import FeedSnapItem from './FeedSnapItem';

// /media/recent 응답 중 "최신 1개"만 확인할 때 필요한 최소 타입
type RecentHeadResp = {
  nodes: { id: string; createdAt: string }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export default function FullPageFeed() {
  const limit = 6;

  // by 파라미터(@handle 또는 handle)
  const sp = useSearchParams();
  const byParam = sp?.get('by') || null;

  // @ 제거한 순수 handle (혹은 null)
  const ownerHandle = useMemo(() => {
    if (!byParam) return null;
    return byParam.startsWith('@') ? byParam.slice(1) : byParam;
  }, [byParam]);

  const {
    items,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    refreshHard,
  } = useInfiniteRecent(limit, { ownerHandle });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // 바닥 감지 → 다음 페이지 로드
  useEffect(() => {
    if (!hasNextPage || !bottomSentinelRef.current) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) fetchNextPage();
      },
      { rootMargin: '1200px' }
    );
    io.observe(bottomSentinelRef.current);
    return () => io.disconnect();
  }, [hasNextPage, fetchNextPage]);

  // ↑ / ↓ / PageUp / PageDown / Space 로 한 장씩 스냅 이동
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.tabIndex = 0;
    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(e.key))
        return;
      e.preventDefault();
      const dir =
        e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' ? 1 : -1;
      el.scrollBy({ top: dir * el.clientHeight, left: 0, behavior: 'smooth' });
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);

  // 홈 배너 클릭 → feed:refresh → 콘텐츠만 새로고침
  useEffect(() => {
    const onRefresh = () => {
      const el = containerRef.current;
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
      refreshHard();
      setTimeout(() => refetch(), 0);
    };
    window.addEventListener('feed:refresh', onRefresh as EventListener);
    return () =>
      window.removeEventListener('feed:refresh', onRefresh as EventListener);
  }, [refreshHard, refetch]);

  // 맨 위에서 최신 확인 (ownerHandle별 분기)
  const qc = useQueryClient();
  const currentFirstId = useMemo(() => items?.[0]?.id ?? null, [items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const THRESHOLD_PX = 24;
    const COOLDOWN_MS = 1500;

    let prevScrollTop = el.scrollTop;
    let lastCheckAt = 0;
    let checking = false;
    let latestKnownFirstId: string | null = currentFirstId ?? null;

    const fetchHeadId = async (): Promise<string | null> => {
      if (ownerHandle) {
        // 프로필 전용 피드(@handle)
        const r = await fetchUserMedia(ownerHandle, 1);
        return r?.nodes?.[0]?.id ?? null;
      } else {
        // 전체 피드
        const r = await request<RecentHeadResp>({
          url: '/media/recent',
          method: 'GET',
          params: { limit: 1 },
        });
        return r?.nodes?.[0]?.id ?? null;
      }
    };

    const onScroll = async () => {
      const now = Date.now();
      const st = el.scrollTop;
      const goingUp = st < prevScrollTop;
      prevScrollTop = st;
      if (!goingUp || st > THRESHOLD_PX) return;
      if (checking) return;
      if (now - lastCheckAt < COOLDOWN_MS) return;
      lastCheckAt = now;
      checking = true;

      try {
        const headId = await fetchHeadId();
        if (headId && headId !== latestKnownFirstId) {
          await qc.invalidateQueries({
            // 훅의 queryKey와 정확히 일치해야 함
            queryKey: ['recent', limit, 'ownerHandle', ownerHandle],
          });
          latestKnownFirstId = headId;
        }
      } catch {
        // ignore
      } finally {
        checking = false;
      }
    };

    latestKnownFirstId = currentFirstId ?? latestKnownFirstId;

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [qc, limit, currentFirstId, ownerHandle]);

  if (isLoading)
    return (
      <div className='h-[100svh] grid place-items-center'>
        피드를 불러오는 중…
      </div>
    );
  if (isError)
    return (
      <div className='h-[100svh] grid place-items-center text-red-600'>
        피드를 불러오지 못했습니다.
      </div>
    );

  return (
    <div
      ref={containerRef}
      className='
        h-[100svh] overflow-y-auto no-scrollbar
        overscroll-y-contain
        snap-y snap-mandatory
        bg-transparent
      '
    >
      {items.map(node => (
        <FeedSnapItem key={node.id} node={node} overlayAvatarSize={35} />
      ))}

      <div ref={bottomSentinelRef} className='h-[1px]' />

      {isFetchingNextPage && (
        <div className='h-[40vh] grid place-items-center text-neutral-400'>
          더 불러오는 중…
        </div>
      )}
    </div>
  );
}
