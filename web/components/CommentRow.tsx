'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
  const me = typeof window !== 'undefined' ? loadUserProfile() : null;

  // 상위 댓글 좋아요
  const { liked, displayCount, toggle, toggling } = useCommentLike(
    comment.id,
    comment.likeCount ?? 0
  );

  // FIX: author 접근 시 안전 가드
  const authorId = comment.author?.id;
  const authorName = comment.author?.displayName ?? '알 수 없음';
  const authorAvatar = comment.author?.avatarUrl ?? null;

  // 삭제(내가 쓴 댓글만)
  // FIX: optional chaining
  const iAmAuthor = !!(me?.id && authorId && me.id === authorId);
  const { mutate: del, isPending: deleting } = useDeleteComment();

  // 대댓글 목록/페이징
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

  // 대댓글 작성
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

  // 서버가 준 replyCount 우선 사용
  const serverReplyCount =
    typeof comment.replyCount === 'number'
      ? comment.replyCount
      : (replies?.length ?? 0);
  const hasReplies = serverReplyCount > 0;

  const isDeleted = !!comment.isDeleted;

  return (
    <div className='flex items-start gap-3'>
      <Avatar src={authorAvatar} size={36} />
      <div className='flex-1 min-w-0'>
        {/* 이름/시간 */}
        <div className='flex items-center gap-2'>
          <div className='text-sm font-semibold'>{authorName}</div>
          <div className='text-xs text-white/40'>
            {timeAgo(comment.createdAt)}
          </div>
        </div>

        {/* 본문 */}
        <div className='mt-1 text-[15px] leading-5'>
          {isDeleted ? (
            <span className='text-white/40'>(삭제된 댓글)</span>
          ) : (
            comment.text
          )}
        </div>

        {/* 액션 라인 */}
        <div className='mt-2 flex items-center gap-5 text-sm text-white/60'>
          <button
            className={`hover:text-white inline-flex items-center gap-1 ${!isDeleted && liked ? 'text-white' : ''}`}
            onClick={() => {
              if (!hasStoredToken()) {
                openAuth('login');
                return;
              }
              if (isDeleted) return; // FIX: 삭제된 댓글 보호
              toggle();
            }}
            disabled={toggling || isDeleted}
            aria-disabled={toggling || isDeleted}
            title={
              isDeleted ? '삭제된 댓글에는 좋아요를 사용할 수 없어요' : '좋아요'
            }
          >
            <Image
              src={liked ? '/images/like.png' : '/images/empty_heart.png'}
              alt='heart'
              width={16}
              height={16}
            />
            <span>좋아요</span>
            {displayCount > 0 && (
              <span className='text-white/50'>{displayCount}</span>
            )}
          </button>

          {!isDeleted && (
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
          )}

          {iAmAuthor && (
            <button
              className='hover:text-white'
              onClick={() => {
                if (!hasStoredToken()) {
                  openAuth('login');
                  return;
                }
                // FIX: mediaId 반드시 전달
                del({
                  mediaId,
                  commentId: comment.id,
                  parentId: comment.parentId ?? null,
                });
              }}
              disabled={deleting}
            >
              삭제
            </button>
          )}
        </div>

        {/* ▼ “답글 N개 보기” */}
        {!repliesOpen && hasReplies && !isDeleted && (
          <div className='mt-2'>
            <button
              className='flex items-center gap-2 text-[15px] text-[#3ea6ff] hover:underline'
              onClick={() => setRepliesOpen(true)}
            >
              <span className='inline-block rotate-90'>⌄</span>
              <span>답글 {serverReplyCount}개 보기</span>
            </button>
          </div>
        )}

        {/* 대댓글 섹션 */}
        {repliesOpen && (
          <div className='mt-3 pl-3 border-l border-white/10 space-y-3'>
            {/* 대댓글 목록 */}
            <div className='space-y-3'>
              {repliesLoading && (
                <div className='text-white/50 text-sm'>불러오는 중…</div>
              )}
              {replies.map(r => (
                // FIX: mediaId 전달
                <ReplyRow key={r.id} reply={r} mediaId={mediaId} />
              ))}
              <div ref={bottomRef} className='h-4' />
              {isFetchingNextPage && (
                <div className='text-white/40 text-xs'>더 불러오는 중…</div>
              )}
            </div>

            {/* 대댓글 작성 */}
            {!isDeleted && (
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
                      className='w-full resize-none bg-transparent outline-none px-0 py-0 text-[14px] leading-[1.35]'
                    />
                    <div className='absolute left-0 right-0 bottom-[2px] h-px bg-white/35' />
                  </div>
                  <div className='mt-2 flex items-center gap-3'>
                    <button
                      className='text-[#3ea6ff] hover:underline'
                      onClick={() => setRepliesOpen(false)}
                    >
                      답글 닫기
                    </button>
                    <div className='flex-1' />
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** ▼ 대댓글 한 줄 — 훅을 여기서 호출 (map 내부 호출 금지) */
function ReplyRow({ reply, mediaId }: { reply: CommentNode; mediaId: string }) {
  const { open: openAuth } = useAuthModal();
  const me = typeof window !== 'undefined' ? loadUserProfile() : null;

  // FIX: author 안전 가드
  const rAuthorId = reply.author?.id;
  const iAmReplyAuthor = !!(me?.id && rAuthorId && me.id === rAuthorId);

  const {
    liked: rLiked,
    displayCount: rCount,
    toggle: rToggle,
    toggling: rToggling,
  } = useCommentLike(reply.id, reply.likeCount ?? 0);

  const { mutate: delReply, isPending: delReplying } = useDeleteComment();

  const rIsDeleted = !!reply.isDeleted;

  return (
    <div className='flex items-start gap-2'>
      <Avatar src={reply.author?.avatarUrl ?? null} size={28} />
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <div className='text-sm font-semibold'>
            {reply.author?.displayName ?? '알 수 없음'}
          </div>
          <div className='text-xs text-white/40'>
            {timeAgo(reply.createdAt)}
          </div>
        </div>
        <div className='mt-1 text-[14px] leading-5'>
          {rIsDeleted ? (
            <span className='text-white/40'>(삭제됨)</span>
          ) : (
            reply.text
          )}
        </div>

        <div className='mt-1 flex items-center gap-4 text-xs text-white/60'>
          <button
            className={`hover:text-white inline-flex items-center gap-1 ${!rIsDeleted && rLiked ? 'text-white' : ''}`}
            onClick={() => {
              if (!hasStoredToken()) {
                openAuth('login');
                return;
              }
              if (rIsDeleted) return; // FIX
              rToggle();
            }}
            disabled={rToggling || rIsDeleted}
            aria-disabled={rToggling || rIsDeleted}
            title={
              rIsDeleted
                ? '삭제된 댓글에는 좋아요를 사용할 수 없어요'
                : '좋아요'
            }
          >
            <Image
              src={rLiked ? '/images/like.png' : '/images/empty_heart.png'}
              alt='heart'
              width={14}
              height={14}
            />
            <span>좋아요</span>
            {rCount > 0 && <span className='text-white/50'>{rCount}</span>}
          </button>

          {iAmReplyAuthor && (
            <button
              className='hover:text-white'
              onClick={() => {
                if (!hasStoredToken()) {
                  openAuth('login');
                  return;
                }
                // FIX: mediaId 전달
                delReply({
                  mediaId,
                  commentId: reply.id,
                  parentId: reply.parentId ?? null,
                });
              }}
              disabled={delReplying}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
