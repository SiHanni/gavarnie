'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  fetchPublicUser,
  fetchUserMedia,
  type PublicUser,
  type UserMediaNode,
} from '@/lib/http';
import { loadUserProfile } from '@/lib/user';

export default function ProfilePage({ userId }: { userId: string }) {
  const router = useRouter();
  const me = useMemo(
    () => (typeof window !== 'undefined' ? loadUserProfile() : null),
    []
  );
  const isMine = me && String(me.id) === String(userId);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [items, setItems] = useState<UserMediaNode[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const u = await fetchPublicUser(userId);
        if (stop) return;
        setUser(u);
        const page = await fetchUserMedia(userId, 12);
        if (stop) return;
        setItems(page.nodes);
        setCursor(page.pageInfo.endCursor);
        setHasNext(page.pageInfo.hasNextPage);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!hasNext || !bottomRef.current) return;
    const io = new IntersectionObserver(
      es => {
        if (es.some(e => e.isIntersecting)) loadMore();
      },
      { rootMargin: '800px' }
    );
    io.observe(bottomRef.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNext, cursor]);

  const loadMore = async () => {
    if (!hasNext || !cursor) return;
    const page = await fetchUserMedia(userId, 12, cursor);
    setItems(prev => [...prev, ...page.nodes]);
    setCursor(page.pageInfo.endCursor);
    setHasNext(page.pageInfo.hasNextPage);
  };

  if (loading) {
    return (
      <div className='h-[100svh] grid place-items-center'>불러오는 중…</div>
    );
  }
  if (!user) {
    return (
      <div className='h-[100svh] grid place-items-center text-red-400'>
        프로필을 찾지 못했습니다.
      </div>
    );
  }

  return (
    <div className='min-h-[100svh] text-white px-4'>
      {/* 상단 영역 */}
      <header className='max-w-4xl mx-auto pt-8 pb-6'>
        <div className='flex items-center gap-5'>
          <div className='w-28 h-28 rounded-full overflow-hidden bg-white/10 border border-white/15'>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=''
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full grid place-items-center text-3xl'>
                🙂
              </div>
            )}
          </div>
          <div className='flex-1'>
            <h1 className='text-2xl font-extrabold'>{user.displayName}</h1>
            <p className='text-white/60 text-sm mt-1'>@{user.id}</p>
          </div>

          {isMine && (
            <button
              onClick={() => router.push('/settings/profile')}
              className='px-4 py-2 rounded-lg font-semibold'
              style={{ backgroundColor: '#5a319f' }}
            >
              프로필 편집
            </button>
          )}
        </div>
      </header>

      {/* 미디어 그리드 (간단 썸네일 카드 구성) */}
      <main className='max-w-5xl mx-auto pb-20'>
        {items.length === 0 ? (
          <div className='h-[40vh] grid place-items-center text-white/70'>
            {isMine
              ? '첫 동영상을 올려보세요! (좌측 +업로드)'
              : '영상이 아직 없습니다.'}
          </div>
        ) : (
          <ul className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3'>
            {items.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    // 홈 피드로 이동해 해당 미디어부터 보게 하려면 쿼리 파라미터 등으로 처리
                    // 우선은 홈(/)으로만 이동
                    window.location.href = '/';
                  }}
                  className='block w-full rounded-xl overflow-hidden bg-white/5 border border-white/10'
                >
                  <div className='aspect-[9/16] grid place-items-center'>
                    {/* 간단 썸네일: 아이콘 + 제목 2줄 */}
                    <Image
                      src='/images/video_placeholder.png'
                      alt=''
                      width={64}
                      height={64}
                    />
                  </div>
                  <div className='p-2 text-[12px] line-clamp-2 text-left'>
                    {n.title}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} className='h-2' />
      </main>
    </div>
  );
}
