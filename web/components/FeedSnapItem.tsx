'use client';

import Image from 'next/image';
import { useMemo, useRef, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RecentMediaNode } from '@/lib/types';
import { joinHls } from '@/lib/url';
import { filenameWithoutExt } from '@/lib/strings';
import VideoPlayer from '@/components/VideoPlayer';
import AudioPlayer from '@/components/AudioPlayer';
import RightActionBar from '@/components/RightActionBar';
import { useStageBox } from '@/hooks/useStageBox';
import Avatar from '@/components/Avatar';
import { useMediaLike } from '@/hooks/useMediaLike';
import { useShareModal } from '@/contexts/ShareModalContext';
import ProgressBar from '@/components/ProgressBar';
import { useCommentsPanel } from '@/contexts/CommentsPanelContext';
import FollowButton from '@/components/FollowButton';

function isAudio(node: RecentMediaNode) {
  return node.contentType?.startsWith('audio/');
}
function useIsMobile(max = 560) {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width:${max}px)`);
    const sync = () => setM(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, [max]);
  return m;
}

export default function FeedSnapItem({
  node,
  overlayAvatarSize,
}: {
  node: RecentMediaNode;
  overlayAvatarSize?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const byParam = searchParams?.get('by') || null;

  const isMobile = useIsMobile();
  const BOTTOM_BAR_H = 68;

  const streamUrl = useMemo(() => joinHls(node.hlsKey), [node.hlsKey]);
  const audioKind = isAudio(node);
  const title =
    (node.title && node.title.trim()) ||
    filenameWithoutExt(node.originalFilename);

  const { open: openShare } = useShareModal();
  const { count, toggle } = useMediaLike(node.id);
  const { open: openComments } = useCommentsPanel();

  // 스테이지 박스(프레임) 크기
  const { width, height } = useStageBox(80, 0.96, 9 / 16);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);

  // 볼륨 패널
  const [volOpen, setVolOpen] = useState(false);
  const volTimerRef = useRef<number | null>(null);
  const volOpenNow = !muted && volOpen;
  const openVol = () => {
    if (volTimerRef.current) window.clearTimeout(volTimerRef.current);
    setVolOpen(true);
  };
  const closeVolDelayed = () => {
    if (volTimerRef.current) window.clearTimeout(volTimerRef.current);
    volTimerRef.current = window.setTimeout(() => setVolOpen(false), 160);
  };
  useEffect(() => {
    return () => {
      if (volTimerRef.current) window.clearTimeout(volTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (muted) setVolOpen(false);
  }, [muted]);

  // 진행값
  const [curr, setCurr] = useState(0);
  const [dur, setDur] = useState(0);
  const [buf, setBuf] = useState(0);

  // 가시성
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting && e.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 자동재생/음소거/볼륨
  useEffect(() => {
    const m = audioKind ? audioRef.current : videoRef.current;
    if (!m) return;
    const apply = () => {
      m.muted = muted;
      m.volume = volume;
      if (visible) {
        m.play()
          .then(() => setPlaying(true))
          .catch(() => {});
      } else {
        m.pause();
        setPlaying(false);
      }
    };
    apply();
    const onReady = () => {
      if (visible) m.play().catch(() => {});
    };
    m.addEventListener('loadedmetadata', onReady);
    m.addEventListener('canplay', onReady);
    return () => {
      m.removeEventListener('loadedmetadata', onReady);
      m.removeEventListener('canplay', onReady);
    };
  }, [visible, muted, volume, audioKind]);

  // 진행률/버퍼
  useEffect(() => {
    const m = audioKind ? audioRef.current : videoRef.current;
    if (!m) return;
    const sync = () => {
      setDur(Number.isFinite(m.duration) ? m.duration : 0);
      setCurr(m.currentTime || 0);
      try {
        const br = m.buffered;
        if (br && br.length > 0 && m.duration > 0) {
          const end = br.end(br.length - 1);
          setBuf(Math.max(0, Math.min(1, end / m.duration)));
        } else setBuf(0);
      } catch {
        setBuf(0);
      }
    };
    const evs: (keyof HTMLMediaElementEventMap)[] = [
      'timeupdate',
      'progress',
      'loadedmetadata',
      'durationchange',
      'seeking',
      'seeked',
      'canplay',
    ];
    evs.forEach(ev => m.addEventListener(ev, sync));
    sync();
    return () => {
      evs.forEach(ev => m.removeEventListener(ev, sync));
    };
  }, [audioKind]);

  const togglePlay = () => {
    const m = audioKind ? audioRef.current : videoRef.current;
    if (!m) return;
    if (m.paused)
      m.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    else {
      m.pause();
      setPlaying(false);
    }
  };
  const toggleMute = () => setMuted(v => !v);

  const onMediaToggle = () => {
    if (audioKind && muted) setMuted(false);
    togglePlay();
  };
  const onSeek = (ratio: number) => {
    const m = audioKind ? audioRef.current : videoRef.current;
    if (!m || !Number.isFinite(dur) || dur <= 0) return;
    m.currentTime = Math.min(dur, Math.max(0, ratio * dur));
    if (visible) m.play().catch(() => {});
  };

  const autoAvatar = Math.round(height * 0.04);
  const AVATAR_SIZE = overlayAvatarSize ?? autoAvatar;
  const NAME_GAP = Math.max(6, Math.round(AVATAR_SIZE * 0.35));

  // URL이 나(id)를 가리키면 스스로 스크롤
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const targetId = searchParams?.get('m') || null;
    const hashMatch =
      typeof window !== 'undefined' &&
      window.location.hash === `#mid-${node.id}`;
    if (targetId === node.id || hashMatch) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    }
  }, [searchParams, node.id]);

  // 작성자 handle (안전 가드)
  const authorHandle = (
    ((node.author as any)?.handle as string | undefined) || ''
  ).trim();

  const toProfile = () => {
    if (authorHandle) router.push(`/@${authorHandle}`);
  };

  const buildShareUrl = () => {
    if (typeof window === 'undefined') return joinHls(node.hlsKey);
    const base = location.origin;
    const by = byParam ? `&by=${encodeURIComponent(byParam)}` : '';
    return `${base}/?m=${encodeURIComponent(node.id)}${by}`;
  };

  // ===== 우측 액션바: 미니/마이크로 대응 =====
  // 구간 정의:  미니 < 720, 마이크로 ≤ 680  (670 근처 문제를 안정적으로 커버)
  const MINI_THRESHOLD = 720;
  const MICRO_THRESHOLD = 650;
  const isMini = height < MINI_THRESHOLD;
  const isMicro = height <= MICRO_THRESHOLD;

  // 기본 버튼 크기/간격(외부 레일)
  const BASE = {
    AVATAR_BTN: 60,
    LIKE_BTN: 50,
    COMMENT_BTN: 50,
    SHARE_BTN: 50,
    GAP_Y: 14,
  };

  // 축소 비율
  const MINI_SCALE = 0.86; // 미니
  const MICRO_SCALE = 0.78; // 마이크로(670 부근 대비 추가 축소)

  const scale = isMicro ? MICRO_SCALE : isMini ? MINI_SCALE : 1;

  const SZ = {
    AVATAR_BTN: Math.round(BASE.AVATAR_BTN * scale),
    LIKE_BTN: Math.round(BASE.LIKE_BTN * scale),
    COMMENT_BTN: Math.round(BASE.COMMENT_BTN * scale),
    SHARE_BTN: Math.round(BASE.SHARE_BTN * scale),
    GAP_Y: Math.max(10, Math.round(BASE.GAP_Y * scale)),
  };

  // 버튼 스택 총높이 + 안전여백(그림자/테두리/미세 오차 흡수)
  const SAFETY_PADDING = isMicro ? 18 : isMini ? 14 : 10;
  const BAR_STACK_H =
    SZ.AVATAR_BTN + SZ.LIKE_BTN + SZ.COMMENT_BTN + SZ.SHARE_BTN + SZ.GAP_Y * 3;

  const DEFAULT_OFFSET = 160;
  const centeredOffset = Math.max(
    0,
    Math.floor((height - (BAR_STACK_H + SAFETY_PADDING)) / 2)
  );
  let dynamicOffsetY = Math.min(DEFAULT_OFFSET, centeredOffset);
  // 프레임 하단을 절대 넘지 않도록 강제 클램프
  const MAX_OFFSET = Math.max(0, height - (BAR_STACK_H + SAFETY_PADDING));
  dynamicOffsetY = Math.max(0, Math.min(dynamicOffsetY, MAX_OFFSET));

  return (
    <section
      id={`mid-${node.id}`}
      ref={rootRef}
      className='snap-start h-[100svh] bg-black text-white relative overflow-hidden'
      style={
        isMobile
          ? {
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${BOTTOM_BAR_H}px)`,
            }
          : undefined
      }
    >
      <div className='h-full w-full grid place-items-center'>
        <div className='flex items-center gap-5'>
          {/* 프레임 */}
          <div
            role='region'
            aria-label='미디어 프레임'
            className='relative isolate rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl bg-transparent'
            style={{ width, height }}
          >
            {!audioKind ? (
              <VideoPlayer
                ref={videoRef}
                src={streamUrl}
                muted={muted}
                fit='contain'
                onToggle={onMediaToggle}
              />
            ) : (
              <div className='w-full h-full grid place-items-center'>
                <div
                  className='w-[min(88%,520px)] aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-700 to-neutral-900 border border-neutral-700'
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={e => {
                    e.stopPropagation();
                    onMediaToggle();
                  }}
                />
                <AudioPlayer ref={audioRef} src={streamUrl} />
              </div>
            )}

            {/* 진행바 */}
            <div className='absolute inset-x-0 bottom-0 z-40'>
              <ProgressBar
                className='px-3'
                barHeight={6}
                progress={dur > 0 ? curr / dur : 0}
                buffered={buf}
                duration={dur}
                onSeek={onSeek}
                color='#5a319f'
              />
            </div>

            {/* 좌상단 컨트롤 */}
            <div className='absolute top-3 left-3 z-50 pointer-events-none'>
              <div className='flex items-center gap-2 pointer-events-auto'>
                <button
                  onPointerUp={e => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className='grid place-items-center p-1'
                  aria-label={playing ? '일시정지' : '재생'}
                >
                  <Image
                    src={playing ? '/images/pause.png' : '/images/play.png'}
                    alt=''
                    width={28}
                    height={28}
                    className='w-7 h-7'
                    draggable={false}
                  />
                </button>

                {/* 볼륨 */}
                <div
                  className='relative group pointer-events-auto'
                  onMouseEnter={openVol}
                  onMouseLeave={closeVolDelayed}
                >
                  <button
                    onPointerUp={e => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className='grid place-items-center p-1'
                    aria-label={muted ? '음소거 해제' : '음소거'}
                  >
                    <Image
                      src={muted ? '/images/mute.png' : '/images/speaker.png'}
                      alt=''
                      width={28}
                      height={28}
                      className='w-8 h-9'
                      draggable={false}
                    />
                  </button>

                  <div
                    className='absolute left-full top-0 w-3 h-full'
                    aria-hidden
                  />
                  <div
                    className={`absolute left-full top-1/2 -translate-y-1/2 ml-0.5 ${volOpenNow ? 'flex' : 'hidden'}`}
                    style={{ zIndex: 70 }}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className='flex items-center gap-1 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10'>
                      <input
                        type='range'
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        aria-label='볼륨'
                        onChange={e =>
                          setVolume(parseFloat(e.currentTarget.value))
                        }
                        className='w-[150px] accent-[#5a319f]'
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 프로필/제목 */}
            <div className='absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/40 to-transparent z-50 pointer-events-none'>
              <div
                className='flex items-center flex-wrap pointer-events-auto'
                style={{ gap: NAME_GAP }}
              >
                <button
                  type='button'
                  onClick={e => {
                    e.stopPropagation();
                    toProfile();
                  }}
                  aria-label={`${node.author.displayName}의 프로필로 이동`}
                  className='rounded-full focus:outline-none focus:ring-2 focus:ring-white/30'
                  title={`${node.author.displayName}의 프로필로 이동`}
                  disabled={!authorHandle}
                >
                  <Avatar
                    src={node.author.avatarUrl}
                    size={overlayAvatarSize ?? Math.round(height * 0.04)}
                  />
                </button>

                <div className='text-sm font-semibold flex items-center gap-2'>
                  {node.author.displayName}
                  {!!authorHandle && (
                    <FollowButton
                      targetHandle={authorHandle}
                      size='sm'
                      variant='ghost'
                      className='relative z-50 px-1.5 min-w-[45px] shrink-0 inline-flex'
                    />
                  )}
                </div>
              </div>

              <p className='mt-2 text-[13px] text-white/90 line-clamp-2 pointer-events-auto'>
                {node.title}
              </p>
            </div>

            {/* 모바일: 프레임 내부 우측 레일 */}
            {isMobile && (
              <RightActionBar
                variant='inside'
                insideOffsetY={120}
                insideRight={10}
                avatarUrl={node.author.avatarUrl || undefined}
                likeCount={count}
                commentCount={node.commentCount}
                avatarButtonSize={48}
                likeButtonSize={42}
                commentButtonSize={42}
                shareButtonSize={42}
                avatarIconSize={44}
                likeIconSize={26}
                commentIconSize={26}
                shareIconSize={26}
                buttonBgAlpha={0.18}
                onAvatarClick={toProfile}
                onLike={toggle}
                onComment={() => openComments({ mediaId: node.id })}
                onShare={() => openShare({ url: buildShareUrl(), title })}
              />
            )}
          </div>

          {/* 데스크탑: 프레임 오른쪽 바깥 레일 (미니/마이크로 대응 + 안전 offset) */}
          {!isMobile && (
            <div
              className='relative z-[60] pointer-events-auto'
              style={{ height }}
            >
              <RightActionBar
                variant='outside'
                avatarUrl={node.author.avatarUrl || undefined}
                likeCount={count}
                commentCount={node.commentCount}
                offsetY={dynamicOffsetY}
                avatarButtonSize={SZ.AVATAR_BTN}
                avatarIconSize={SZ.AVATAR_BTN}
                likeButtonSize={SZ.LIKE_BTN}
                commentButtonSize={SZ.COMMENT_BTN}
                shareButtonSize={SZ.SHARE_BTN}
                likeIconSize={Math.round(33 * scale)}
                commentIconSize={Math.round(40 * scale)}
                shareIconSize={Math.round(40 * scale)}
                buttonBgAlpha={0.18}
                onAvatarClick={toProfile}
                onLike={toggle}
                onComment={() => openComments({ mediaId: node.id })}
                onShare={() => openShare({ url: buildShareUrl(), title })}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
