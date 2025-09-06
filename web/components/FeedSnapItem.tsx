'use client';

import Image from 'next/image';
import { useMemo, useRef, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
import FollowButton from './FollowButton';

function isAudio(node: RecentMediaNode) {
  return node.contentType?.startsWith('audio/');
}

export default function FeedSnapItem({
  node,
  overlayAvatarSize,
}: {
  node: RecentMediaNode;
  overlayAvatarSize?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const streamUrl = useMemo(() => joinHls(node.hlsKey), [node.hlsKey]);
  const audioKind = isAudio(node);
  const title =
    (node.title && node.title.trim()) ||
    filenameWithoutExt(node.originalFilename);

  const { open: openShare } = useShareModal();
  const { count, toggle } = useMediaLike(node.id);
  const { open: openComments } = useCommentsPanel();

  const { width, height } = useStageBox(80, 0.96, 9 / 16);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);

  // === 볼륨 패널 상태 (호버 유지 + 짧은 딜레이 닫힘) ===
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
  }, [muted]); // 음소거되면 패널 닫기

  // 진행바
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

  return (
    <section
      ref={rootRef}
      className='snap-start h-[100svh] bg-black text-white relative overflow-hidden'
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
            <div className='absolute inset-x-0 bottom-0 z-20'>
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
            <div className='absolute top-3 left-3 z-30 pointer-events-none'>
              <div className='flex items-center gap-2 pointer-events-auto'>
                {/* 재생/일시정지 */}
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

                {/* 스피커 + 볼륨 */}
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

                  {/* 브리지: 스피커→슬라이더 이동 중 hover 끊김 방지 */}
                  <div
                    className='absolute left-full top-0 w-3 h-full'
                    onMouseEnter={openVol}
                    onMouseLeave={closeVolDelayed}
                    aria-hidden
                  />

                  {/* 볼륨 pill — 스피커 오른쪽 */}
                  <div
                    className={`absolute left-full top-1/2 -translate-y-1/2 ml-2 ${volOpenNow ? 'flex' : 'hidden'}`}
                    style={{ zIndex: 40 }}
                    onMouseEnter={openVol}
                    onMouseLeave={closeVolDelayed}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className='flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10'>
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
                        className='w-[160px] accent-[#5a319f]'
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 프로필/제목 */}
            {/* z-10 → z-50 로 상단 레이어보다 위에 */}
            <div className='absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/40 to-transparent z-50 pointer-events-none'>
              {/* 공간이 좁을 때 줄바꿈 허용 */}
              <div
                className='flex items-center flex-wrap pointer-events-auto'
                style={{ gap: NAME_GAP }}
              >
                <button
                  type='button'
                  onClick={e => {
                    e.stopPropagation();
                    router.push(`/users/${node.author.id}`);
                  }}
                  aria-label={`${node.author.displayName}의 프로필로 이동`}
                  className='rounded-full focus:outline-none focus:ring-2 focus:ring-white/30'
                  title={`${node.author.displayName}의 프로필로 이동`}
                >
                  <Avatar
                    src={node.author.avatarUrl}
                    size={overlayAvatarSize ?? Math.round(height * 0.04)}
                  />
                </button>

                <div className='text-sm font-semibold flex items-center gap-2'>
                  {node.author.displayName}
                  {/* ✅ 구독/구독중 버튼: 축소 방지 + z-index 보강 */}
                  <FollowButton
                    targetUserId={node.author.id}
                    size='sm'
                    variant='ghost'
                    className='relative z-50 px-1.5 min-w-[45px] shrink-0 inline-flex'
                  />
                </div>
              </div>

              <p className='mt-2 text-[13px] text-white/90 line-clamp-2 pointer-events-auto'>
                {node.title}
              </p>
            </div>
          </div>

          {/* 우측 액션 레일 */}
          <div
            className='relative z-[100] pointer-events-auto'
            style={{ height }}
          >
            <RightActionBar
              avatarUrl={node.author.avatarUrl || undefined}
              likeCount={count}
              commentCount={node.commentCount}
              stageHeight={height}
              offsetY={160}
              avatarButtonSize={60}
              avatarIconSize={60}
              likeButtonSize={50}
              commentButtonSize={50}
              shareButtonSize={50}
              likeIconSize={33}
              commentIconSize={40}
              shareIconSize={40}
              buttonBgAlpha={0.18}
              onAvatarClick={() => router.push(`/users/${node.author.id}`)}
              onLike={toggle}
              onComment={() => openComments({ mediaId: node.id })}
              onShare={() => {
                const url =
                  typeof window !== 'undefined'
                    ? `${location.origin}/?m=${node.id}`
                    : streamUrl;
                openShare({ url, title });
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
