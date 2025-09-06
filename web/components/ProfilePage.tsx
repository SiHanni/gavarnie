'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchPublicUser,
  fetchUserMedia,
  getFollowCounts,
  getAccessToken,
  type PublicUser,
  type UserMediaNode,
} from '@/lib/http';
import { loadUserProfile, type UserGrade } from '@/lib/user';
import FollowButton from '@/components/FollowButton';
import ProfileActionsMenu from '@/components/ProfileActionsMenu';
import { joinMediaObject, buildThumbSrcSet } from '@/lib/url';

const BRAND = '#5a319f';
const GRADE_LABEL: Record<UserGrade, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
};

const PLACEHOLDER = '/images/video_placeholder.png';

export default function ProfilePage({ userId }: { userId: string }) {
  const router = useRouter();

  // 로그인/내 계정 상태
  const [me, setMe] = useState(() =>
    typeof window !== 'undefined' ? loadUserProfile() : null
  );
  const [authed, setAuthed] = useState(() =>
    typeof window !== 'undefined' ? !!getAccessToken() : false
  );
  useEffect(() => {
    const onLogin = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMe(detail || loadUserProfile());
      setAuthed(true);
    };
    const onLogout = () => {
      setMe(null);
      setAuthed(false);
    };
    window.addEventListener('auth:login', onLogin as EventListener);
    window.addEventListener('auth:logout', onLogout as EventListener);
    return () => {
      window.removeEventListener('auth:login', onLogin as EventListener);
      window.removeEventListener('auth:logout', onLogout as EventListener);
    };
  }, []);

  const isMine = !!authed && !!me && String(me.id) === String(userId);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [items, setItems] = useState<UserMediaNode[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 최초 로드
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const [u, firstPage, counts] = await Promise.all([
          fetchPublicUser(userId),
          fetchUserMedia(userId, 12),
          getFollowCounts(userId).catch(() => ({
            followerCount: 0,
            followingCount: 0,
          })),
        ]);
        if (stop) return;
        setUser(u);
        setItems(firstPage.nodes);
        setCursor(firstPage.pageInfo.endCursor);
        setHasNext(firstPage.pageInfo.hasNextPage);
        setFollowerCount(counts.followerCount);
        setFollowingCount(counts.followingCount);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [userId]);

  // 무한 스크롤
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

  if (loading)
    return (
      <div className='h-[100svh] grid place-items-center'>불러오는 중…</div>
    );
  if (!user)
    return (
      <div className='h-[100svh] grid place-items-center text-red-400'>
        프로필을 찾지 못했습니다.
      </div>
    );

  // 등급: 내 프로필이면 public 응답이 비어도 로컬(me)로 보강
  const grade: UserGrade | undefined = isMine
    ? ((user.userGrade as UserGrade | undefined) ??
      (me?.userGrade as UserGrade | undefined))
    : (user.userGrade as UserGrade | undefined);
  const gradeLabel = grade ? GRADE_LABEL[grade] : null;

  const postsCount = items.length; // 임시

  return (
    <main className='h-[100svh] overflow-y-auto bg-black text-white'>
      <div className='max-w-screen-sm mx-auto px-5 pt-6 pb-4'>
        {/* 상단 우측 ⋯ (내 프로필에서만) */}
        <div className='flex justify-end'>
          <ProfileActionsMenu
            canEdit={isMine}
            onEdit={() => router.push('/settings/profile')}
          />
        </div>

        {/* 닉네임 */}
        <div className='mt-2 text-center'>
          <h1 className='text-[18px] md:text-[20px] font-semibold'>
            {user.displayName}
          </h1>

          {/* ✅ 등급 뱃지 — 이름 바로 아래 라인 */}
          {gradeLabel && (
            <div className='mt-1'>
              <span
                className='px-2 py-[2px] rounded-full text-[13px] font-semibold border'
                style={{
                  color: BRAND,
                  backgroundColor: 'rgba(90,49,159,0.15)',
                  borderColor: 'rgba(90,49,159,0.35)',
                }}
                title={`회원 등급: ${gradeLabel}`}
              >
                {gradeLabel}
              </span>
            </div>
          )}
        </div>

        {/* 프로필 이미지 */}
        <div className='mt-4 grid place-items-center'>
          <div className='w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border border-white/15'>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=''
                className='w-full h-full object-cover'
                referrerPolicy='no-referrer'
              />
            ) : (
              <div className='w-full h-full grid place-items-center bg-white/10 text-3xl'>
                {user.displayName?.[0] ?? 'U'}
              </div>
            )}
          </div>
        </div>

        {/* 카운트 */}
        <div className='mt-5 flex items-center justify-center gap-10'>
          <Count label='Posts' value={postsCount} />
          <Count label='Followers' value={followerCount} />
          <Count label='Following' value={followingCount} />
        </div>

        {/* 상태메시지 */}
        {(user.statusMessage?.trim()?.length ?? 0) > 0 && (
          <p className='mt-3 text-center text-[13px] text-white/85 whitespace-pre-line break-words leading-relaxed'>
            {user.statusMessage}
          </p>
        )}

        {/* 액션(내 프로필이 아닐 때만) */}
        {!isMine && (
          <div className='mt-4 mx-auto flex items-center gap-3 w-full max-w-[420px]'>
            <FollowButton
              targetUserId={user.id}
              size='lg'
              variant='pill'
              className='flex-1'
            />
            <button
              type='button'
              className='flex-1 h-10 md:h-11 px-5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/16 text-sm font-semibold'
              onClick={() => router.push(`/dm/${user.id}`)}
            >
              Message
            </button>
          </div>
        )}
      </div>

      {/* 미디어 그리드 */}
      <section className='max-w-screen-lg mx-auto px-5 pb-8 pt-4'>
        {items.length === 0 ? (
          <div className='h-[40vh] grid place-items-center text-white/70'>
            {isMine
              ? '첫 동영상을 올려보세요! (좌측 업로드)'
              : '영상이 아직 없습니다.'}
          </div>
        ) : (
          <ul className='grid grid-cols-4 gap-[2px] md:gap-1'>
            {items.map(n => {
              const v = (n as any).thumbnailVersion ?? 1;
              const hasThumb = !!(n as any).thumbnailKey;
              const src = hasThumb
                ? joinMediaObject((n as any).thumbnailKey, v)
                : PLACEHOLDER;
              const srcSet = hasThumb
                ? buildThumbSrcSet((n as any).thumbnailKey, v)
                : undefined;

              return (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      // TODO: 홈에서 특정 미디어로 점프
                      window.location.href = '/';
                    }}
                    className='block w-full rounded-md overflow-hidden bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition-colors'
                    title={n.title}
                  >
                    {/* [CHANGED] 썸네일 적용: 고정 비율 + object-cover */}
                    <div className='aspect-[9/16] relative'>
                      <img
                        src={src}
                        srcSet={srcSet}
                        sizes='(max-width: 768px) 33vw, 240px'
                        alt=''
                        className='absolute inset-0 w-full h-full object-cover'
                        loading='lazy'
                        decoding='async'
                        onError={e => {
                          e.currentTarget.src = PLACEHOLDER;
                          e.currentTarget.srcset = '';
                        }}
                      />
                    </div>
                    <div className='px-3 py-1 text-[14px] line-clamp-2 text-left'>
                      {n.title}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} className='h-2' />
      </section>
    </main>
  );
}

/* 작은 컴포넌트 */
function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className='min-w-[86px] text-center'>
      <div className='text-[17px] font-semibold leading-tight'>
        {fmtK(value)}
      </div>
      <div className='text-[11px] text-white/60'>{label}</div>
    </div>
  );
}
function fmtK(n: number) {
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000) / 10}만`;
  if (n >= 1_000) return `${Math.floor(n / 100) / 10}천`;
  return String(n);
}
