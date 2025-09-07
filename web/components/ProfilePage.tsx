'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  fetchPublicUser,
  fetchUserMedia,
  getFollowCounts,
  getAccessToken,
  deleteMyMedia,
  type PublicUser,
  type UserMediaNode,
} from '@/lib/http';
import { loadUserProfile, type UserGrade } from '@/lib/user';
import FollowButton from '@/components/FollowButton';
import ProfileActionsMenu from '@/components/ProfileActionsMenu';
import { joinMediaObject, buildThumbSrcSet } from '@/lib/url';

const BRAND = '#5a319f';
const PLACEHOLDER = '/images/video_placeholder.png';
const GUTTER = 24; // 좌측 메뉴와 콘텐츠 사이 여백
const MARQUEE_PX_PER_SEC = 10;

const GRADE_LABEL: Record<UserGrade, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
};

/* =========================
 * DeleteConfirmModal (NEW) - 항상 중앙, 반응형, 포커스 트랩, 스크롤락
 * ========================= */
function DeleteConfirmModal({
  open,
  title = '컨텐츠 삭제',
  detail,
  deleting = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  detail?: string;
  deleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [interactReady, setInteractReady] = useState(false); // 모바일 탭 즉시닫힘 방지
  const overlayDownOnSelf = useRef(false);
  const prevOverflow = useRef<string>('');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setInteractReady(false);
    overlayDownOnSelf.current = false;

    const t = window.setTimeout(() => setInteractReady(true), 320);

    // 스크롤 락
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 접근성 포커스
    const f = window.setTimeout(() => firstBtnRef.current?.focus(), 0);

    return () => {
      clearTimeout(t);
      clearTimeout(f);
      document.body.style.overflow = prevOverflow.current || '';
    };
  }, [open]);

  // ESC 닫기 + 탭 포커스 트랩
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && interactReady && !deleting) onCancel();

      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length < 2) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, interactReady, deleting, onCancel]);

  if (!open || !mounted) return null;

  // 오버레이 클릭: down/up 모두 오버레이여야 닫힘
  const onOverlayDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) overlayDownOnSelf.current = true;
  };
  const onOverlayUp = (e: React.PointerEvent) => {
    if (!interactReady || deleting) return;
    if (e.target !== e.currentTarget) return;
    if (!overlayDownOnSelf.current) return;
    onCancel();
  };

  const node = (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='dc-title'
      className='fixed inset-0 z-[9999]'
      style={{ overscrollBehaviorY: 'contain' }}
    >
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/70 backdrop-blur-[2px] select-none touch-none'
        onPointerDown={onOverlayDown}
        onPointerUp={onOverlayUp}
      />

      {/* Card: 모든 뷰포트에서 정중앙 */}
      <div
        ref={cardRef}
        className='absolute shadow-2xl border border-white/10 bg-neutral-950 text-white dc-pop'
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 24px))',
          maxHeight: 'min(78vh, 560px)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className='px-4 sm:px-5 py-3'
          style={{
            background:
              'linear-gradient(180deg, rgba(90,49,159,0.32) 0%, rgba(90,49,159,0.06) 100%)',
          }}
        >
          <h2
            id='dc-title'
            className='text-center font-extrabold'
            style={{ fontSize: 'clamp(17px,2.4vw,20px)' }}
          >
            {title}
          </h2>
        </div>

        {/* 본문 */}
        <div className='px-4 sm:px-5 py-4'>
          <p
            className='text-white/85'
            style={{ fontSize: 'clamp(12px,2.6vw,14px)' }}
          >
            정말로 이 컨텐츠를 삭제하시겠어요?
          </p>
          {!!detail && (
            <p
              className='text-white/55 mt-1 break-words'
              style={{ fontSize: 'clamp(11px,2.4vw,12px)' }}
            >
              {detail}
            </p>
          )}

          {/* 액션 */}
          <div className='mt-4 flex items-center gap-2'>
            <button
              ref={firstBtnRef}
              type='button'
              disabled={deleting}
              onClick={() => (!deleting ? onConfirm() : null)}
              className='flex-1 font-semibold rounded-lg disabled:opacity-60'
              style={{
                padding: '10px 12px',
                backgroundColor: '#b91c1c',
                fontSize: 'clamp(13px,2.6vw,15px)',
              }}
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
            <button
              type='button'
              disabled={deleting}
              onClick={() => (interactReady ? onCancel() : null)}
              className='flex-1 rounded-lg border'
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.2)',
                fontSize: 'clamp(13px,2.6vw,15px)',
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>

      {/* 애니메이션 */}
      <style jsx global>{`
        .dc-pop {
          animation: dc-pop-kf 140ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes dc-pop-kf {
          from {
            transform: translate(-50%, -50%) scale(0.97);
            opacity: 0.98;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}

/* =========================
 * 사이드바 공간 측정 훅
 * ========================= */
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

      const w = el ? Math.ceil(el.getBoundingClientRect().width) : 0;
      setSpace(w > 0 ? w + extraGapPx : 0);
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

  return space;
}

/* =========================
 * 제목 마퀴
 * ========================= */
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

/* =========================
 * 프로필 페이지
 * ========================= */
export default function ProfilePage({ handle }: { handle: string }) {
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

  // 데이터
  const [user, setUser] = useState<PublicUser | null>(null);
  const [items, setItems] = useState<UserMediaNode[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isMine =
    !!authed &&
    !!me &&
    (!!user
      ? String((me as any).handle || '') === String(user.handle || '')
      : false);

  const loadInitialData = async (normHandle: string) => {
    const [firstPage, counts] = await Promise.all([
      fetchUserMedia(normHandle, 12),
      getFollowCounts(normHandle).catch(() => ({
        followerCount: 0,
        followingCount: 0,
      })),
    ]);
    setItems(firstPage.nodes);
    setCursor(firstPage.pageInfo.endCursor);
    setHasNext(firstPage.pageInfo.hasNextPage);
    setFollowerCount(counts.followerCount);
    setFollowingCount(counts.followingCount);
  };

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        const norm = handle.startsWith('@') ? handle.slice(1) : handle;
        const u = await fetchPublicUser(norm);
        if (stop) return;
        setUser(u);
        await loadInitialData(norm);
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [handle]);

  useEffect(() => {
    const onUploaded = async () => {
      if (!user?.handle) return;
      const norm = user.handle.startsWith('@')
        ? user.handle.slice(1)
        : user.handle;
      await loadInitialData(norm);
    };
    window.addEventListener('media:uploaded', onUploaded);
    return () => window.removeEventListener('media:uploaded', onUploaded);
  }, [user]);

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
    if (!hasNext || !cursor || !user?.handle) return;
    const norm = user.handle.startsWith('@')
      ? user.handle.slice(1)
      : user.handle;
    const page = await fetchUserMedia(norm, 12, cursor);
    setItems(prev => [...prev, ...page.nodes]);
    setCursor(page.pageInfo.endCursor);
    setHasNext(page.pageInfo.hasNextPage);
  };

  // 메뉴 & 삭제 모달 상태
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (!openMenuFor) return;
      if (menuWrapRef.current && menuWrapRef.current.contains(e.target as Node))
        return;
      setOpenMenuFor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuFor(null);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuFor]);

  const [confirmFor, setConfirmFor] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const doDelete = async () => {
    if (!confirmFor) return;
    setDeleteErr(null);
    setDeleting(true);
    try {
      await deleteMyMedia(confirmFor.id);
      setItems(prev => prev.filter(x => x.id !== confirmFor.id));
      setConfirmFor(null);
      setOpenMenuFor(null);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.message || '삭제에 실패했습니다.';
      setDeleteErr(String(msg));
    } finally {
      setDeleting(false);
    }
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

  const grade: UserGrade | undefined = isMine
    ? ((user.userGrade as UserGrade | undefined) ??
      ((me as any)?.userGrade as UserGrade | undefined))
    : (user.userGrade as UserGrade | undefined);
  const gradeLabel = grade ? GRADE_LABEL[grade] : null;

  const postsCount = items.length;

  const goToMedia = (id: string, e?: React.MouseEvent) => {
    const by = user.handle ? `@${user.handle}` : '';
    const href = `/?m=${encodeURIComponent(id)}${by ? `&by=${encodeURIComponent(by)}` : ''}#mid-${encodeURIComponent(
      id
    )}`;
    if (e) e.preventDefault();
    router.push(href);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const hasQuery = location.search.includes(`m=${id}`);
        const hasBy = by
          ? location.search.includes(`by=${encodeURIComponent(by)}`)
          : true;
        const hasHash = location.hash === `#mid-${id}`;
        if (!hasQuery || !hasBy || !hasHash) window.location.assign(href);
      }, 0);
    }
  };

  const centeredWrapStyle: React.CSSProperties = {
    position: 'relative',
    left: '50%',
    transform: 'translateX(-50%)',
    width: `calc(100vw - ${sidebarSpace}px)`,
  };

  return (
    <main
      className='h-[100svh] overflow-y-auto overflow-x-hidden bg-black text-white'
      style={{ paddingLeft: sidebarSpace || undefined }}
    >
      {/* ====== 프로필/헤더 영역 ====== */}
      <div style={centeredWrapStyle} className='pt-6'>
        <div className='mx-auto max-w-[560px] px-5 text-center'>
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

          <div
            className='mt-5 flex items-center justify-center'
            style={{ gap: 'clamp(10px, 4vw, 40px)' }}
          >
            <Count label='Posts' value={postsCount} />
            <Count label='Followers' value={followerCount} />
            <Count label='Following' value={followingCount} />
          </div>

          {(user.statusMessage?.trim()?.length ?? 0) > 0 && (
            <p
              className='mt-3 text-white/85 whitespace-pre-line break-words leading-relaxed'
              style={{ fontSize: 'clamp(12px, 2.6vw, 13px)' }}
            >
              {user.statusMessage}
            </p>
          )}

          {!isMine && !!user.handle && (
            <div className='mt-4 ml-auto mr-[clamp(16px,6vw,45px)] flex items-center gap-3 w-full max-w-[420px]'>
              <FollowButton
                targetHandle={user.handle}
                size='lg'
                variant='pill'
                className='flex-1 h-[clamp(40px,5.5vw,44px)] text-[14px] md:text-[15px]'
              />
              <button
                type='button'
                aria-disabled='true'
                onClick={e => e.preventDefault()}
                className='flex-1 rounded-xl border border-white/20 bg-white/10 font-semibold h-[clamp(40px,5.5vw,44px)] text-[14px] md:text-[15px] cursor-default select-none opacity-80'
                style={{ paddingInline: 20 }}
              >
                메시지
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === 미디어 그리드 (최소 3, 최대 5 열) === */}
      <section className='pb-8 pt-6'>
        <div style={centeredWrapStyle}>
          <div
            className='mx-auto w-full'
            style={{
              maxWidth: '1320px',
              paddingLeft: 'clamp(10px, 2vw, 16px)',
              paddingRight: 'clamp(10px, 2vw, 16px)',
            }}
          >
            {items.length === 0 ? (
              <div className='h-[40vh] grid place-items-center text-white/70' />
            ) : (
              <ul className='grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[6px] md:gap-3'>
                {items.map(n => {
                  const v = (n as any).thumbnailVersion ?? 1;
                  const hasThumb = !!(n as any).thumbnailKey;
                  const src = hasThumb
                    ? joinMediaObject((n as any).thumbnailKey, v)
                    : PLACEHOLDER;
                  const srcSet = hasThumb
                    ? buildThumbSrcSet((n as any).thumbnailKey, v)
                    : undefined;

                  const by = user.handle ? `@${user.handle}` : '';
                  const href = `/?m=${encodeURIComponent(n.id)}${by ? `&by=${encodeURIComponent(by)}` : ''}#mid-${encodeURIComponent(n.id)}`;
                  const isOpen = openMenuFor === n.id;

                  return (
                    <li
                      key={n.id}
                      className='relative'
                      onClickCapture={e => {
                        if (isOpen) e.stopPropagation();
                      }}
                    >
                      <a
                        href={href}
                        onClick={e => goToMedia(n.id, e)}
                        className='block w-full rounded-md overflow-hidden bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] transition-colors'
                        title={(n as any).title}
                      >
                        <div className='aspect-[9/16] relative'>
                          <img
                            src={src}
                            srcSet={srcSet}
                            sizes='(min-width:1280px) 18vw, (min-width:1024px) 23vw, 30vw'
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

                        <div
                          className='px-3 flex items-center min-w-0'
                          style={{
                            height: 36,
                            fontSize: 'clamp(12px, 2.4vw, 14px)',
                          }}
                        >
                          <MarqueeTitle
                            text={(n as any).title}
                            className='w-full min-w-0'
                          />
                        </div>
                      </a>

                      {isMine && (
                        <div
                          className='absolute'
                          style={{ top: 6, right: 6, zIndex: 60 }}
                        >
                          <button
                            type='button'
                            aria-label='더보기'
                            onPointerDown={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenMenuFor(prev =>
                                prev === n.id ? null : n.id
                              );
                            }}
                            className='grid place-items-center rounded-full hover:bg-black/40 outline-none ring-0 focus:outline-none'
                            style={{
                              width: 'clamp(40px, 8vw, 44px)',
                              height: 'clamp(40px, 8vw, 44px)',
                            }}
                          >
                            <img
                              src='/images/see_more.png'
                              alt=''
                              width={24}
                              height={24}
                              style={{
                                width: 'clamp(20px, 4.6vw, 24px)',
                                height: 'clamp(20px, 4.6vw, 24px)',
                                pointerEvents: 'none',
                              }}
                            />
                          </button>

                          {isOpen && (
                            <div
                              className='absolute z-50'
                              style={{ top: 'calc(90% + 0px)', right: 0 }}
                              onClick={e => e.stopPropagation()}
                            >
                              <div
                                className='rounded-lg border border-white/10 bg-black/90 backdrop-blur-md text-white shadow-xl'
                                style={{
                                  width: 'max-content',
                                  maxWidth: 'calc(100vw - 24px)',
                                  fontSize: 'clamp(12px, 3vw, 14px)',
                                  paddingBlock: 'clamp(3px, 0.8vw, 5px)',
                                  pointerEvents: 'auto',
                                }}
                                ref={menuWrapRef}
                              >
                                <button
                                  type='button'
                                  onPointerDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenMenuFor(null);
                                    setConfirmFor({
                                      id: n.id,
                                      title: (n as any).title,
                                    });
                                  }}
                                  className='block w-full text-left hover:bg-white/10 text-red-300 transition-colors whitespace-nowrap'
                                  style={{
                                    paddingInline: 'clamp(10px, 2.6vw, 12px)',
                                    paddingBlock: 'clamp(8px, 2vw, 10px)',
                                  }}
                                >
                                  컨텐츠 삭제
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={bottomRef} className='h-2' />
          </div>
        </div>
      </section>

      {/* ===== 삭제 확인 모달 ===== */}
      <DeleteConfirmModal
        open={!!confirmFor}
        title='컨텐츠 삭제'
        detail={confirmFor?.title ?? ''}
        deleting={deleting}
        onConfirm={doDelete}
        onCancel={() => (!deleting ? setConfirmFor(null) : null)}
      />
    </main>
  );
}

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
