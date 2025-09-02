'use client';

import { useEffect, useRef, useState } from 'react';
import { useCommentsPanel } from '@/contexts/CommentsPanelContext';
import { useInfiniteComments, useCreateComment } from '@/hooks/useComments';
import Avatar from '@/components/Avatar';
import { hasStoredToken } from '@/lib/http';
import { loadUserProfile } from '@/lib/user';
import { useAuthModal } from '@/contexts/AuthModalContext';
import CommentRow from './CommentRow';

export default function CommentsPanel() {
  const { isOpen, mediaId, close } = useCommentsPanel();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const {
    nodes,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteComments({
    mediaId: isOpen ? mediaId : null,
    parentId: undefined,
  });

  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!bottomRef.current || !hasNextPage) return;
    const io = new IntersectionObserver(
      es => {
        if (es.some(e => e.isIntersecting)) fetchNextPage();
      },
      { rootMargin: '800px' }
    );
    io.observe(bottomRef.current);
    return () => io.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const [text, setText] = useState('');
  const { mutate: create, isPending: creating } = useCreateComment();
  const { open: openAuth } = useAuthModal();

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    if (!hasStoredToken()) {
      openAuth('login');
      return;
    }
    create({ mediaId: mediaId!, text: v }, { onSuccess: () => setText('') });
  };

  const panelCls = `
    absolute right-0 top-0 h-full w-[min(470px,96vw)]
    bg-neutral-950 text-white border-l border-white/10
    flex flex-col transform transition-transform duration-300
    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
  `;

  if (!mounted) return null;

  return (
    // ✅ 댓글 패널을 아주 높은 z-index로 고정해서 어떤 요소보다 항상 위
    <div
      className={`fixed inset-0 z-[1000] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      {/* 오버레이 */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          isOpen
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />
      {/* 패널 */}
      <aside
        className={panelCls + ' pointer-events-auto'}
        aria-hidden={!isOpen}
      >
        <div className='flex items-center justify-between p-4 border-b border-white/10'>
          <div className='text-base font-semibold'>댓글</div>
          <button
            onClick={close}
            className='text-2xl leading-none px-2 hover:opacity-80'
          >
            ×
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-3 py-3 space-y-4'>
          {isLoading && <div className='text-white/60 p-3'>불러오는 중…</div>}
          {isError && (
            <div className='text-red-400 p-3'>댓글을 불러오지 못했어요.</div>
          )}
          {nodes.map(c => (
            <CommentRow key={c.id} mediaId={mediaId!} comment={c} />
          ))}
          <div ref={bottomRef} className='h-6' />
          {isFetchingNextPage && (
            <div className='text-white/50 text-sm p-3'>더 불러오는 중…</div>
          )}
          {!isLoading && nodes.length === 0 && (
            <div className='text-white/40 text-sm p-4'>
              첫 댓글을 작성해보세요.
            </div>
          )}
        </div>

        {/* 하단 작성 */}
        <div className='p-3 border-t border-white/10'>
          <div className='flex items-start gap-3'>
            <Avatar
              src={
                hasStoredToken() ? (loadUserProfile()?.avatarUrl ?? null) : null
              }
              size={32}
            />
            <div className='flex-1'>
              <div className='relative'>
                <textarea
                  rows={2}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder='댓글 추가...'
                  className='w-full resize-none bg-transparent outline-none px-0 py-1 text-[15px]'
                />
                <div className='h-px bg-white/20' />
              </div>
              <div className='mt-2 flex justify-end gap-2'>
                <button
                  className='px-3 py-1.5 rounded-full text-sm bg-white/10 hover:bg-white/15'
                  onClick={() => setText('')}
                >
                  취소
                </button>
                <button
                  className='px-3 py-1.5 rounded-full text-sm bg-white text-black font-semibold disabled:opacity-50'
                  onClick={submit}
                  disabled={!text.trim() || creating}
                >
                  댓글
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
