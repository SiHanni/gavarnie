'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  mediaLike,
  mediaUnlike,
  mediaLikeCount,
  getAccessToken,
} from '@/lib/http';
import { useAuthModal } from '@/contexts/AuthModalContext';

const LS_KEY = 'likedMediaIds';

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeSet(s: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify([...s]));
}

export function useMediaLike(mediaUuid: string) {
  const qc = useQueryClient();
  const { open } = useAuthModal();

  // 카운트 조회
  const { data: count = 0 } = useQuery({
    queryKey: ['media-like-count', mediaUuid],
    queryFn: async () => {
      const r = await mediaLikeCount(mediaUuid);
      return r.count; // ✅ 서버 응답 필드: count
    },
    staleTime: 10_000,
  });

  // 내가 좋아요 했는지(로컬 세션 기반)
  const liked = useMemo(() => readSet().has(mediaUuid), [mediaUuid, count]);

  const toggle = useCallback(async () => {
    if (!getAccessToken()) {
      open('login');
      return;
    }
    const set = readSet();
    const currentlyLiked = set.has(mediaUuid);

    // 낙관적 업데이트
    qc.setQueryData<number>(['media-like-count', mediaUuid], old =>
      Math.max(0, (old ?? 0) + (currentlyLiked ? -1 : 1))
    );

    try {
      if (currentlyLiked) {
        set.delete(mediaUuid);
        writeSet(set);
        await mediaUnlike(mediaUuid);
      } else {
        set.add(mediaUuid);
        writeSet(set);
        await mediaLike(mediaUuid);
      }
    } catch {
      // 롤백은 invalidate로 간단히
      qc.invalidateQueries({ queryKey: ['media-like-count', mediaUuid] });
      // 로컬 표기도 되돌리기
      const s = readSet();
      if (currentlyLiked) s.add(mediaUuid);
      else s.delete(mediaUuid);
      writeSet(s);
    }
  }, [mediaUuid, open, qc]);

  return { liked, count, toggle };
}
