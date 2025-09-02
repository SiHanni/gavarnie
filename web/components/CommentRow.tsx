'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useAuthModal } from '@/contexts/AuthModalContext';
import {
  useCommentLike,
  useCreateComment,
  useDeleteComment,
  useInfiniteComments,
} from '@/hooks/useComments';
import type { CommentNode } from '@/lib/comments';
import { hasStoredToken } from '@/lib/http';
import { loadUserProfile } from '@/lib/user';

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export default function CommentRow({
  mediaId,
  comment,
}: {
  mediaId: string;
  comment: CommentNode;
}) {
  const { open: openAuth } = useAuthModal();

  const { liked, displayCount, toggle, toggling } = useCommentLike(
    comment.id,
    comment.likeCount
  );
  const { mutate: del, isPending: deleting } = useDeleteComment();

  const [repliesOpen, setRepliesOpen] = useState(false);

  const {
    nodes: replies,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: repliesLoading,
  } = useInfiniteComments({ mediaId, parentId: comment.id });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!bottomRef.current || !hasNextPage) return;
    const io = new IntersectionObserver(
      es => {
        if (es.some(e => e.isIntersecting)) fetchNextPage();
      },
      { rootMargin: '600px' }
    );
    io.observe(bottomRef.current);
    return () => io.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const [reply, setReply] = useState('');
  const { mutate: createReply, isPending: creatingReply } = useCreateComment();
  const submitReply = () => {
    const v = reply.trim();
    if (!v) return;
    if (!hasStoredToken()) {
      openAuth('login');
      return;
    }
    createReply(
      { mediaId, parentId: comment.id, text: v },
      { onSuccess: () => setReply('') }
    );
  };

  return (
    <div className='flex items-start gap-3'>
      <Avatar src={comment.author.avatarUrl} size={36} />
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <div className='text-sm font-semibold'>
            {comment.author.displayName}
          </div>
          <div className='text-xs text-white/40'>
            {timeAgo(comment.createdAt)}
          </div>
        </div>

        <div className='mt-1 text-[15px] leading-5'>
          {comment.isDeleted ? (
            <span className='text-white/40'>(삭제된 댓글)</span>
          ) : (
            comment.text
          )}
        </div>

        <div className='mt-2 flex items-center gap-5 text-sm text-white/60'>
          <button
            className={`hover:text-white ${liked ? 'text-white' : ''}`}
            onClick={() => {
              if (!hasStoredToken()) {
                openAuth('login');
                return;
              }
              toggle();
            }}
            disabled={toggling}
          >
            좋아요{' '}
            {displayCount > 0 && (
              <span className='text-white/50'>{displayCount}</span>
            )}
          </button>

          <button
            className='hover:text-white'
            onClick={() => setRepliesOpen(v => !v)}
          >
            {repliesOpen
              ? '답글 닫기'
              : `답글 ${comment.replyCount ?? ''}개 보기`.trim()}
          </button>

          <button
            className='hover:text-white'
            onClick={() => {
              if (!hasStoredToken()) {
                openAuth('login');
                return;
              }
              setRepliesOpen(true);
            }}
          >
            답글
          </button>

          <button
            className='hover:text-white'
            onClick={() => {
              if (!hasStoredToken()) {
                openAuth('login');
                return;
              }
              del({ commentId: comment.id });
            }}
            disabled={deleting}
          >
            삭제
          </button>
        </div>

        {repliesOpen && (
          <div className='mt-3 pl-3 border-l border-white/10 space-y-3'>
            <div className='space-y-3'>
              {repliesLoading && (
                <div className='text-white/50 text-sm'>불러오는 중…</div>
              )}
              {replies.map(r => (
                <div key={r.id} className='flex items-start gap-2'>
                  <Avatar src={r.author.avatarUrl} size={28} />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <div className='text-sm font-semibold'>
                        {r.author.displayName}
                      </div>
                      <div className='text-xs text-white/40'>
                        {timeAgo(r.createdAt)}
                      </div>
                    </div>
                    <div className='mt-1 text-[14px] leading-5'>
                      {r.isDeleted ? (
                        <span className='text-white/40'>(삭제됨)</span>
                      ) : (
                        r.text
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className='h-4' />
              {isFetchingNextPage && (
                <div className='text-white/40 text-xs'>더 불러오는 중…</div>
              )}
            </div>

            <div className='flex items-start gap-2'>
              <Avatar
                src={
                  hasStoredToken()
                    ? (loadUserProfile()?.avatarUrl ?? null)
                    : null
                }
                size={28}
              />
              <div className='flex-1'>
                <div className='relative'>
                  <textarea
                    rows={2}
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder='답글 추가...'
                    className='w-full resize-none bg-transparent outline-none px-0 py-1 text-[14px]'
                  />
                  <div className='h-px bg-white/20' />
                </div>
                <div className='mt-2 flex justify-end gap-2'>
                  <button
                    className='px-3 py-1.5 rounded-full text-xs bg-white/10 hover:bg-white/15'
                    onClick={() => setReply('')}
                  >
                    취소
                  </button>
                  <button
                    className='px-3 py-1.5 rounded-full text-xs bg-white text-black font-semibold disabled:opacity-50'
                    onClick={submitReply}
                    disabled={!reply.trim() || creatingReply}
                  >
                    답글
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
