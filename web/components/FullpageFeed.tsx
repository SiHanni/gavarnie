'use client';

/**
 * 풀스크린 세로 스냅 컨테이너 + 무한 스크롤 피드
 * - 한 화면에 카드 1개만 보이도록 CSS scroll-snap 적용
 * - 마지막 근처에서 다음 페이지 자동 로드
 * - 키보드 ↑/↓ (PgUp/PgDn, Space)로도 한 장씩 이동
 * - ⬆️ 위로 올려 맨 위에 닿으면 최신 컨텐츠 유무를 빠르게 확인 후, 있으면 부드럽게 리프레시
 * - 홈 배너 클릭 시(LeftSidebar → feed:refresh 이벤트) 콘텐츠만 새로고침
 */

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/http';
import { useInfiniteRecent } from '@/hooks/useInfiniteRecent';
import FeedSnapItem from './FeedSnapItem';

// /media/recent 응답 중 "최신 1개"만 확인할 때 필요한 최소 타입
type RecentHeadResp = {
  nodes: { id: string; createdAt: string }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export default function FullPageFeed() {
  // 한 페이지당 가져올 개수 (현재 6 사용)
  const limit = 6;

  const {
    items,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    refreshHard, // 쿼리캐시 완전 리셋
  } = useInfiniteRecent(limit);

  // 스크롤 컨테이너 ref (키보드 네비게이션 & 스냅)
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 바닥 감지해서 페이징
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
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
    el.tabIndex = 0; // 포커스 가능하게
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

  // ====== 홈 배너 클릭 → feed:refresh → 컨텐츠만 새로고침 ======
  useEffect(() => {
    const onRefresh = () => {
      const el = containerRef.current;
      if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
      // 캐시 제거 후 즉시 리패치(커서 초기화)
      refreshHard();
      setTimeout(() => refetch(), 0);
    };
    window.addEventListener('feed:refresh', onRefresh as EventListener);
    return () =>
      window.removeEventListener('feed:refresh', onRefresh as EventListener);
  }, [refreshHard, refetch]);

  // ====== ⬆️ 맨 위에서 최신 확인 → 있으면 부드럽게 invalidate ======
  const qc = useQueryClient();

  // 현재 화면에 렌더된 가장 최신(맨 위) 아이템 id
  const currentFirstId = useMemo(() => items?.[0]?.id ?? null, [items]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const THRESHOLD_PX = 24; // "거의 맨 위"로 간주할 y 오프셋
    const COOLDOWN_MS = 1500; // 과도한 호출 방지

    let prevScrollTop = el.scrollTop;
    let lastCheckAt = 0;
    let checking = false;
    let latestKnownFirstId: string | null = currentFirstId ?? null;

    const fetchRecentHeadId = async (): Promise<string | null> => {
      const r = await request<RecentHeadResp>({
        url: '/media/recent',
        method: 'GET',
        params: { limit: 1 },
      });
      return r?.nodes?.[0]?.id ?? null;
    };

    const onScroll = async () => {
      const now = Date.now();
      const st = el.scrollTop;
      const goingUp = st < prevScrollTop;
      prevScrollTop = st;

      // 위로 스크롤 중이며, 거의 맨 위에 닿았을 때만 체크
      if (!goingUp || st > THRESHOLD_PX) return;

      if (checking) return;
      if (now - lastCheckAt < COOLDOWN_MS) return;
      lastCheckAt = now;
      checking = true;

      try {
        const headId = await fetchRecentHeadId();
        // 우리가 알고 있는 최신 id와 다르면 새 글이 생긴 것 → invalidate로 부드럽게 리페치
        if (headId && headId !== latestKnownFirstId) {
          await qc.invalidateQueries({ queryKey: ['recent', limit] });
          latestKnownFirstId = headId; // 이후 중복 invalidate 방지
        }
      } catch {
        // 네트워크 일시 오류 등은 무시
      } finally {
        checking = false;
      }
    };

    // currentFirstId가 바뀌면 최신 기준 갱신
    latestKnownFirstId = currentFirstId ?? latestKnownFirstId;

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [qc, limit, currentFirstId]);

  // ====== 로딩/에러 ======
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

      {/* 바닥 센티넬 */}
      <div ref={bottomSentinelRef} className='h-[1px]' />

      {isFetchingNextPage && (
        <div className='h-[40vh] grid place-items-center text-neutral-400'>
          더 불러오는 중…
        </div>
      )}
    </div>
  );
}
