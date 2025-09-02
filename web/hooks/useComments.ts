'use client';

import {
  useMutation,
  useInfiniteQuery,
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

const qKey = (mediaId: string, parentId?: string) =>
  ['comments', mediaId, parentId ?? null] as const;

export function useInfiniteComments(params: {
  mediaId: string;
  parentId?: string;
}) {
  const { mediaId, parentId } = params;

  const q = useInfiniteQuery({
    queryKey: qKey(mediaId, parentId),
    queryFn: ({ pageParam }) =>
      listComments({
        mediaId,
        parentId,
        limit: 20,
        cursor: (pageParam as string | null) ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: last =>
      last.pageInfo.hasNextPage ? last.pageInfo.endCursor : undefined,
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
      qc.invalidateQueries({ queryKey: qKey(vars.mediaId, vars.parentId) });
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

export function useCommentLike(commentId: string, initialCount: number) {
  const { open } = useAuthModal();
  const qc = useQueryClient();

  const currentLiked =
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(`cmt_like:${commentId}`) === '1';
  const likeCount = initialCount + (currentLiked ? 1 : 0);

  const mut = useMutation({
    mutationFn: async (likedNow: boolean) => {
      if (!hasStoredToken()) {
        open('login');
        throw new Error('AUTH');
      }
      return likedNow ? unlikeComment(commentId) : likeComment(commentId);
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
  });

  return {
    liked: currentLiked,
    likeCount,
    toggling: mut.isPending,
    toggle: () => mut.mutate(currentLiked),
  };
}
