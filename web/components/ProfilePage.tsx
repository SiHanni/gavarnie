'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
const PLACEHOLDER = '/images/video_placeholder.png';
const GUTTER = 24;

/** 마키(제목 슬라이드) 속도: px/sec */
const MARQUEE_PX_PER_SEC = 10;

const GRADE_LABEL: Record<UserGrade, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
};

/** 좌측 사이드바 실제 폭 + 여백(GUTTER) 측정 */
function useSidebarSpace(extraGapPx = GUTTER) {
  const [space, setSpace] = useState(0);
  const observedElRef = useRef<HTMLElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const measure = useMemo(
    () => () => {
      const el = document.getElementById('left-sidebar') as HTMLElement | null;

      if (el !== observedElRef.current) {
        if (roRef.current && observedElRef.current) {
          try {
            roRef.current.unobserve(observedElRef.current);
          } catch {}
        }
        if (!roRef.current) roRef.current = new ResizeObserver(() => measure());
        if (el) roRef.current.observe(el);
        observedElRef.current = el;
      }

      const w = el ? el.getBoundingClientRect().width : 0;
      setSpace(w > 0 ? Math.round(w + extraGapPx) : 0);
    },
    [extraGapPx]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    measure();

    const docMo = new MutationObserver(measure);
    docMo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    window.addEventListener('resize', measure);
    const onCustom = () => measure();
    window.addEventListener('sidebar:changed', onCustom);

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('sidebar:changed', onCustom);
      docMo.disconnect();
      if (roRef.current && observedElRef.current) {
        try {
          roRef.current.unobserve(observedElRef.current);
        } catch {}
      }
    };
  }, [measure]);

  return space; // px
}

/** 제목 마키(넘칠 때만 왕복 슬라이드) */
function MarqueeTitle({
  text,
  speedPxPerSec = MARQUEE_PX_PER_SEC,
  className = '',
  style,
}: {
  text: string;
  speedPxPerSec?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [needAnim, setNeedAnim] = useState(false);

  const measure = () => {
    const w = wrapRef.current;
    const t = textRef.current;
    if (!w || !t) return;
    const box = Math.floor(w.clientWidth);
    const inner = Math.ceil(t.scrollWidth);
    const dist = Math.max(0, inner - box);
    setDistance(dist);
    if (dist > 0) {
      setDuration(Math.max(1.2, dist / Math.max(10, speedPxPerSec)));
      setNeedAnim(true);
    } else {
      setDuration(0);
      setNeedAnim(false);
    }
  };

  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [text, speedPxPerSec]);

  return (
    <div
      ref={wrapRef}
      className={`relative block w-full min-w-0 overflow-hidden whitespace-nowrap ${className}`}
      style={style}
      aria-label={text}
      title={text}
    >
      <span
        ref={textRef}
        className={
          needAnim
            ? 'marquee-x will-change-transform inline-block'
            : 'inline-block'
        }
        style={
          needAnim
            ? ({
                ['--mx-distance' as any]: `${distance}px`,
                ['--mx-duration' as any]: `${duration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>

      <style jsx global>{`
        @keyframes mx-pingpong {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-1 * var(--mx-distance)));
          }
        }
        .marquee-x {
          animation-name: mx-pingpong;
          animation-duration: var(--mx-duration);
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
      `}</style>
    </div>
  );
}

export default function ProfilePage({ userId }: { userId: string }) {
  const router = useRouter();
  const sidebarSpace = useSidebarSpace();

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
      if (typeof window !== 'undefined') {
        const isMobile = window.matchMedia('(max-width:560px)').matches;
        if (isMobile) router.push('/');
      }
    };
    window.addEventListener('auth:login', onLogin as EventListener);
    window.addEventListener('auth:logout', onLogout as EventListener);
    return () => {
      window.removeEventListener('auth:login', onLogin as EventListener);
      window.removeEventListener('auth:logout', onLogout as EventListener);
    };
  }, [router]);

  const isMine = !!authed && !!me && String(me.id) === String(userId);

  // 데이터
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
      <div className='h-[100svh] grid place-items-center text-white bg-black'>
        불러오는 중…
      </div>
    );
  if (!user)
    return (
      <div className='h-[100svh] grid place-items-center text-red-400 bg-black'>
        프로필을 찾지 못했습니다.
      </div>
    );

  // 등급
  const grade: UserGrade | undefined = isMine
    ? ((user.userGrade as UserGrade | undefined) ??
      (me?.userGrade as UserGrade | undefined))
    : (user.userGrade as UserGrade | undefined);
  const gradeLabel = grade ? GRADE_LABEL[grade] : null;

  const postsCount = items.length;

  /** 정확히 해당 미디어로 이동 — 앵커(+SPA) 모두 사용 */
  const goToMedia = (id: string, e?: React.MouseEvent) => {
    const href = `/?m=${encodeURIComponent(id)}#mid-${encodeURIComponent(id)}`;
    if (e) e.preventDefault();
    router.push(href);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const hasQuery = location.search.includes(`m=${id}`);
        const hasHash = location.hash === `#mid-${id}`;
        if (!hasQuery || !hasHash) window.location.assign(href);
      }, 0);
    }
  };

  return (
    <main
      className='h-[100svh] overflow-y-auto overflow-x-hidden bg-black text-white md:pl-[72px] lg:pl-[260px]'
      style={{ paddingLeft: sidebarSpace || undefined }}
    >
      {/* === 프로필 헤더 === */}
      <div
        className='relative w-[100vw] pt-6'
        style={{
          left: '50%',
          transform: `translateX(calc(-50% - ${Math.round(sidebarSpace / 2)}px))`,
        }}
      >
        <div className='mx-auto max-w-[560px] px-5 text-center'>
          {/* 이름 + see_more */}
          <div className='relative flex items-center justify-center'>
            <h1
              className='font-medium text-white/90 leading-tight'
              style={{ fontSize: 'clamp(16px, 2.6vw, 19px)' }}
            >
              {user.displayName}
            </h1>

            {isMine && (
              <div
                className='absolute'
                style={{
                  top: '50%',
                  right: 'clamp(24px, 6vw, 56px)',
                  transform: 'translateY(-50%) scale(1.6)',
                  transformOrigin: 'right center',
                }}
              >
                <ProfileActionsMenu
                  canEdit
                  onEdit={() => router.push('/settings/profile')}
                  onAfterLogout={() => {
                    if (typeof window !== 'undefined') {
                      const isMobile =
                        window.matchMedia('(max-width:560px)').matches;
                      if (isMobile) router.push('/');
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* 뱃지 */}
          {gradeLabel && (
            <div className='mt-2'>
              <span
                className='px-3 py-[3px] rounded-full font-semibold border'
                style={{
                  fontSize: 'clamp(11px, 2.2vw, 13px)',
                  color: BRAND,
                  backgroundColor: 'rgba(90,49,159,0.15)',
                  borderColor: 'rgba(90,49,159,0.35)',
                }}
              >
                {gradeLabel}
              </span>
            </div>
          )}

          {/* 프로필 이미지 */}
          <div className='mt-4 grid place-items-center'>
            <div
              className='rounded-full overflow-hidden border border-white/15'
              style={{
                width: 'clamp(88px, 19vw, 128px)',
                height: 'clamp(88px, 19vw, 128px)',
              }}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=''
                  className='w-full h-full object-cover'
                  referrerPolicy='no-referrer'
                />
              ) : (
                <div
                  className='w-full h-full grid place-items-center bg-white/10'
                  style={{ fontSize: 'clamp(20px, 5vw, 30px)' }}
                >
                  {user.displayName?.[0] ?? 'U'}
                </div>
              )}
            </div>
          </div>

          {/* 카운트 */}
          <div
            className='mt-5 flex items-center justify-center'
            style={{ gap: 'clamp(10px, 4vw, 40px)' }}
          >
            <Count label='Posts' value={postsCount} />
            <Count label='Followers' value={followerCount} />
            <Count label='Following' value={followingCount} />
          </div>

          {/* 상태메시지 */}
          {(user.statusMessage?.trim()?.length ?? 0) > 0 && (
            <p
              className='mt-3 text-white/85 whitespace-pre-line break-words leading-relaxed'
              style={{ fontSize: 'clamp(12px, 2.6vw, 13px)' }}
            >
              {user.statusMessage}
            </p>
          )}

          {/* 내 프로필이 아닐 때: Follow / Message(비활성) */}
          {!isMine && (
            <div className='mt-4 mx-auto flex items-center gap-3 w-full max-w-[420px]'>
              <FollowButton
                targetUserId={user.id}
                size='lg'
                variant='pill'
                className='flex-1 h-[clamp(40px,5.5vw,44px)] text-[14px] md:text-[15px]'
              />
              <button
                type='button'
                aria-disabled='true'
                onClick={e => e.preventDefault()}
                className='flex-1 rounded-xl border border-white/20 bg-white/10 font-semibold
                           h-[clamp(40px,5.5vw,44px)] text-[14px] md:text-[15px] cursor-default select-none opacity-80'
                style={{ paddingInline: 20 }}
              >
                메시지
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === 미디어 그리드 === */}
      <section
        className='px-5 pb-8 pt-6'
        style={{ width: 'min(1040px, 100%)' }}
      >
        {items.length === 0 ? (
          <div className='h-[40vh] grid place-items-center text-white/70'>
            {isMine ? '첫 동영상을 올려보세요!' : '영상이 아직 없습니다.'}
          </div>
        ) : (
          <ul className='grid grid-cols-3 lg:grid-cols-4 gap-[2px] md:gap-1'>
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
                  <a
                    href={`/?m=${encodeURIComponent(n.id)}#mid-${encodeURIComponent(n.id)}`}
                    onClick={e => goToMedia(n.id, e)}
                    className='block w-full rounded-md overflow-hidden bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition-colors'
                    title={n.title}
                  >
                    <div className='aspect-[9/16] relative'>
                      <img
                        src={src}
                        srcSet={srcSet}
                        sizes='(min-width:1024px) 23vw, 30vw'
                        alt=''
                        className='absolute inset-0 w-full h-full object-cover'
                        loading='lazy'
                        decoding='async'
                        onError={e => {
                          e.currentTarget.src = PLACEHOLDER;
                          (e.currentTarget as HTMLImageElement).srcset = '';
                        }}
                      />
                    </div>

                    {/* 제목: 높이 고정 + 넘치면 마키 */}
                    <div
                      className='px-3 flex items-center min-w-0'
                      style={{
                        height: 36,
                        fontSize: 'clamp(12px, 2.4vw, 14px)',
                      }}
                    >
                      <MarqueeTitle text={n.title} className='w-full min-w-0' />
                    </div>
                  </a>
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

/* ── 작은 컴포넌트 ── */
function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className='min-w-[86px] text-center'>
      <div
        className='font-semibold leading-tight'
        style={{ fontSize: 'clamp(15px, 2.6vw, 17px)' }}
      >
        {fmtK(value)}
      </div>
      <div
        className='text-white/60'
        style={{ fontSize: 'clamp(10px, 2.2vw, 11px)' }}
      >
        {label}
      </div>
    </div>
  );
}
function fmtK(n: number) {
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000) / 10}만`;
  if (n >= 1_000) return `${Math.floor(n / 100) / 10}천`;
  return String(n);
}
