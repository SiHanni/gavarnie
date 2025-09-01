'use client';

/**
 * 풀스크린 세로 스냅 컨테이너 + 무한 스크롤 피드
 * - 한 화면에 카드 1개만 보이도록 CSS scroll-snap 적용
 * - 마지막 근처에서 다음 페이지 자동 로드
 * - 키보드 ↑/↓ (PgUp/PgDn)로도 한 장씩 이동
 */

import { useEffect, useRef } from 'react';
import { useInfiniteRecent } from '@/hooks/useInfiniteRecent';
import FeedSnapItem from './FeedSnapItem';

export default function FullPageFeed() {
  const {
    items,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteRecent(6);

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

  // ↑ / ↓ 키로 한 장씩 스냅 이동
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
      {items.map((node, idx) => (
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
