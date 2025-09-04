'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  listComments,
  createComment as apiCreateComment,
  deleteComment as apiDeleteComment,
  likeComment,
  unlikeComment,
  type CommentNode,
} from '@/lib/comments';
import { hasStoredToken } from '@/lib/http';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useState } from 'react';
import { bumpRecentCommentCount } from '@/lib/queryUtils';
// FIX: 내 프로필 로드해서 낙관적 노드 author 채우기
import { loadUserProfile } from '@/lib/user';

const qKey = (mediaId: string | null, parentId?: string | null) =>
  ['comments', mediaId ?? null, parentId ?? null] as const;

type CommentsPage = {
  nodes: CommentNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export function useInfiniteComments(params: {
  mediaId: string | null;
  parentId?: string;
}) {
  const { mediaId, parentId } = params;

  const q = useInfiniteQuery({
    queryKey: qKey(mediaId, parentId ?? null),
    queryFn: ({ pageParam }) =>
      listComments({
        mediaId: mediaId!, // enabled=false면 호출 안 됨
        parentId,
        limit: 20,
        cursor: (pageParam as string | null) ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: last =>
      last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined,
    enabled: !!mediaId,
  });

  const nodes: CommentNode[] = (q.data?.pages ?? []).flatMap(p => p.nodes);
  return { ...q, nodes };
}

/** 작성(낙관적 삽입 + 실패 롤백) */
export function useCreateComment() {
  const qc = useQueryClient();
  const { open } = useAuthModal();

  return useMutation({
    mutationFn: async (vars: {
      mediaId: string;
      text: string;
      parentId?: string;
    }) => {
      if (!hasStoredToken()) {
        open('login');
        throw new Error('AUTH');
      }
      return apiCreateComment(vars);
    },

    onMutate: async vars => {
      const { mediaId, parentId, text } = vars;
      const key = qKey(mediaId, parentId ?? null);

      await qc.cancelQueries({ queryKey: key });

      const prev = qc.getQueryData<InfiniteData<CommentsPage>>(key);
      const optimisticId = `opt:${Date.now()}`;

      // FIX: 내 프로필로 author 채우기 (UI가 author를 바로 참조해도 안전)
      const me = typeof window !== 'undefined' ? loadUserProfile() : null;

      qc.setQueryData<InfiniteData<CommentsPage>>(key, old => {
        const optimisticNode = {
          id: optimisticId,
          parentId: parentId ?? null,
          text,
          createdAt: new Date().toISOString(),
          likeCount: 0,
          replyCount: 0,
          isDeleted: false, // FIX: 안전하게 기본값
          author: me
            ? {
                id: me.id,
                displayName: me.displayName ?? '나',
                avatarUrl: me.avatarUrl ?? null,
              }
            : // 프로필이 없더라도 안전한 기본값
              {
                id: 'me',
                displayName: '나',
                avatarUrl: null,
              },
        } as unknown as CommentNode;

        if (!old) {
          return {
            pageParams: [null],
            pages: [
              {
                nodes: [optimisticNode],
                pageInfo: { endCursor: null, hasNextPage: false },
              },
            ],
          };
        }
        const first = old.pages[0];
        const newFirst: CommentsPage = {
          ...first,
          nodes: [optimisticNode, ...first.nodes],
        };
        return {
          pageParams: [...old.pageParams],
          pages: [newFirst, ...old.pages.slice(1)],
        };
      });

      // 액션바 카운트 +1
      bumpRecentCommentCount(qc, mediaId, +1);

      return { prev, key, mediaId, optimisticId } as const;
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && ctx.key) qc.setQueryData(ctx.key, ctx.prev);
      if (ctx?.mediaId) bumpRecentCommentCount(qc, ctx.mediaId, -1);
    },

    onSettled: (_res, _err, vars) => {
      qc.invalidateQueries({
        queryKey: qKey(vars.mediaId, vars.parentId ?? null),
      });
    },
  });
}

/** 삭제 — 같은 미디어의 모든 댓글 쿼리에서 즉시 제거(낙관적), 실패 시 롤백 */
export function useDeleteComment() {
  const qc = useQueryClient();
  const { open } = useAuthModal();

  return useMutation({
    mutationFn: async (vars: {
      mediaId: string; // FIX: 반드시 전달 필요
      commentId: string;
      parentId?: string | null;
    }) => {
      if (!hasStoredToken()) {
        open('login');
        throw new Error('AUTH');
      }
      return apiDeleteComment(vars.commentId);
    },

    onMutate: async vars => {
      const { mediaId, commentId } = vars;

      // FIX: mediaId 스코프로 취소/스냅샷 수집
      const keyPrefix = ['comments', mediaId] as const;

      await qc.cancelQueries({ queryKey: keyPrefix });

      const prevEntries = qc.getQueriesData<InfiniteData<CommentsPage>>({
        queryKey: keyPrefix,
      });

      // 모든 관련 쿼리에서 해당 코멘트 제거
      for (const [key, data] of prevEntries) {
        if (!data) continue;
        qc.setQueryData<InfiniteData<CommentsPage>>(key, old => {
          if (!old) return old;
          return {
            pageParams: [...old.pageParams],
            pages: old.pages.map(p => ({
              ...p,
              nodes: p.nodes.filter(n => n.id !== commentId),
            })),
          };
        });
      }

      // 액션바 카운트 -1
      bumpRecentCommentCount(qc, mediaId, -1);

      return { prevEntries, mediaId } as const;
    },

    onError: (_err, vars, ctx) => {
      if (ctx?.prevEntries) {
        for (const [key, snapshot] of ctx.prevEntries) {
          qc.setQueryData(key, snapshot);
        }
      }
      bumpRecentCommentCount(qc, vars.mediaId, +1);
    },

    onSettled: (_data, _err, vars) => {
      // 같은 미디어의 모든 댓글 쿼리 동기화
      qc.invalidateQueries({ queryKey: ['comments', vars.mediaId] });
    },
  });
}

/** 좋아요(카운트는 서버 응답으로만 최신화) */
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
      setLiked(v => !v); // 카운트는 서버 재조회로
    },
    onSuccess: res => {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          `cmt_like:${commentId}`,
          res.liked ? '1' : ''
        );
      }
      qc.invalidateQueries({ queryKey: ['comments'] });
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
