'use client';

import { RefObject, useEffect, useRef } from 'react';
import { request } from '@/lib/http';

// /media/recent 응답 최소 타입(필요한 필드만)
type RecentHeadResp = {
  nodes: { id: string; createdAt: string }[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

async function fetchRecentHeadId(): Promise<string | null> {
  const r = await request<RecentHeadResp>({
    url: '/media/recent',
    method: 'GET',
    params: { limit: 1 },
  });
  return r?.nodes?.[0]?.id ?? null;
}

/**
 * 사용법:
 * useAutoRefreshOnUp({
 *   containerRef,               // 스크롤 컨테이너 (100svh snap되는 div)
 *   currentFirstId,             // 현재 피드의 가장 최신 아이템 id (data.pages[0].nodes[0]?.id)
 *   onRefresh,                  // React Query refetch 또는 invalidateQueries
 *   thresholdPx: 24,            // 맨 위로 간주할 y오프셋
 *   cooldownMs: 1500,           // 과도한 호출 방지 쿨다운
 * });
 */
export function useAutoRefreshOnUp(opts: {
  containerRef: RefObject<HTMLElement>;
  currentFirstId?: string | null;
  onRefresh: () => void | Promise<unknown>;
  thresholdPx?: number;
  cooldownMs?: number;
}) {
  const {
    containerRef,
    currentFirstId,
    onRefresh,
    thresholdPx = 24,
    cooldownMs = 1500,
  } = opts;

  const prevScrollTop = useRef(0);
  const lastCheckAt = useRef(0);
  const checking = useRef(false);
  const latestKnownFirstId = useRef<string | null>(currentFirstId ?? null);

  // currentFirstId가 바뀌면 최신 기준 동기화
  useEffect(() => {
    if (currentFirstId) latestKnownFirstId.current = currentFirstId;
  }, [currentFirstId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = async () => {
      const now = Date.now();
      const st = el.scrollTop;
      const goingUp = st < prevScrollTop.current;
      prevScrollTop.current = st;

      // 맨 위 근처로 스크롤-업 했을 때만 체크
      if (!goingUp || st > thresholdPx) return;

      // 과도한 요청 방지
      if (checking.current) return;
      if (now - lastCheckAt.current < cooldownMs) return;
      lastCheckAt.current = now;
      checking.current = true;

      try {
        const headId = await fetchRecentHeadId();
        // 현재 우리가 알고 있는 최신 id와 다르면 → 최신 글이 생긴 것 → 리프레시
        if (headId && headId !== latestKnownFirstId.current) {
          await onRefresh();
          // refetch 후 최신 id 갱신(데이터가 반영되었을 것)
          latestKnownFirstId.current = headId;
        }
      } catch {
        // 무시(네트워크 일시 실패 등)
      } finally {
        checking.current = false;
      }
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef, onRefresh, thresholdPx, cooldownMs]);
}
