'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listComments,
  createComment,
  deleteComment,
  likeComment,
  unlikeComment,
  type CommentNode,
} from '@/lib/comments';
import { hasStoredToken } from '@/lib/http';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useState } from 'react';

const qKey = (mediaId: string | null, parentId?: string | null) =>
  ['comments', mediaId ?? null, parentId ?? null] as const;

export function useInfiniteComments(params: {
  mediaId: string | null;
  parentId?: string;
}) {
  const { mediaId, parentId } = params;

  const q = useInfiniteQuery({
    queryKey: qKey(mediaId, parentId ?? null),
    queryFn: ({ pageParam }) =>
      listComments({
        mediaId: mediaId!, // enabled가 false일 때는 실행 안 됨
        parentId,
        limit: 20,
        cursor: (pageParam as string | null) ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: last =>
      last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined,
    enabled: !!mediaId, // ✅ mediaId 없으면 호출 안 함
  });

  const nodes: CommentNode[] = (q.data?.pages ?? []).flatMap(p => p.nodes);
  return { ...q, nodes };
}

export function useCreateComment() {
  const qc = useQueryClient();
  const { open } = useAuthModal();

  return useMutation({
    mutationFn: async (body: {
      mediaId: string;
      text: string;
      parentId?: string;
    }) => {
      if (!hasStoredToken()) {
        open('login');
        throw new Error('AUTH');
      }
      return createComment(body);
    },
    onSuccess: (_created, vars) => {
      qc.invalidateQueries({
        queryKey: qKey(vars.mediaId, vars.parentId ?? null),
      });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  const { open } = useAuthModal();
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      if (!hasStoredToken()) {
        open('login');
        throw new Error('AUTH');
      }
      return deleteComment(commentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

/**
 * ✅ 좋아요 카운트는 항상 "서버 값 그대로" 노출.
 * 클라이언트는 내가 눌렀는지만 관리(하트 색 등).
 * 낙관적 토글은 liked 상태만 바꾸고, 카운트는 서버 재조회로 갱신.
 */
export function useCommentLike(commentId: string, serverCount: number) {
  const qc = useQueryClient();
  const { open } = useAuthModal();

  const initialLiked =
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(`cmt_like:${commentId}`) === '1';

  const [liked, setLiked] = useState<boolean>(!!initialLiked);

  const mut = useMutation({
    mutationFn: async (currentlyLiked: boolean) => {
      if (!hasStoredToken()) {
        open('login');
        throw new Error('AUTH');
      }
      return currentlyLiked ? unlikeComment(commentId) : likeComment(commentId);
    },
    onMutate: () => {
      setLiked(v => !v); // 카운트는 손대지 않음
    },
    onSuccess: res => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          `cmt_like:${commentId}`,
          res.liked ? '1' : ''
        );
      }
      qc.invalidateQueries({ queryKey: ['comments'] }); // 서버 카운트 최신화
    },
    onError: () => {
      setLiked(v => !v); // 롤백
    },
  });

  return {
    liked,
    displayCount: serverCount,
    toggling: mut.isPending,
    toggle: () => mut.mutate(liked),
  };
}
