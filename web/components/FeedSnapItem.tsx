'use client';

import Image from 'next/image';
import { useMemo, useRef, useEffect, useState } from 'react';
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
import { useRouter } from 'next/navigation';
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
  const streamUrl = useMemo(() => joinHls(node.hlsKey), [node.hlsKey]);
  const audioKind = isAudio(node);
  const title =
    (node.title && node.title.trim()) ||
    filenameWithoutExt(node.originalFilename);

  const { open: openShare } = useShareModal();
  const { liked, count, toggle } = useMediaLike(node.id);

  const { open: openComments } = useCommentsPanel();

  const { width, height } = useStageBox(80, 0.96, 9 / 16);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true); // 기본 음소거 자동재생
  const [volume, setVolume] = useState(0.7);

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

  // 진행률/버퍼 동기화
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

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const onSeek = (ratio: number) => {
    const m = audioKind ? audioRef.current : videoRef.current;
    if (!m || !Number.isFinite(dur) || dur <= 0) return;
    m.currentTime = Math.min(dur, Math.max(0, ratio * dur));
    if (visible) m.play().catch(() => {});
  };

  // 크기
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
          {/* ===== 프레임 ===== */}
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
                onToggle={onMediaToggle} // 비디오 자체에서 토글
              />
            ) : (
              <div className='w-full h-full grid place-items-center'>
                {/* 오디오: 커버 탭으로 토글 (pointer 안정화) */}
                <div
                  className='w-[min(88%,520px)] aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-700 to-neutral-900 border border-neutral-700'
                  style={{ touchAction: 'manipulation' }}
                  onPointerDown={() => {}}
                  onPointerUp={e => {
                    e.stopPropagation();
                    onMediaToggle();
                  }}
                />
                <AudioPlayer ref={audioRef} src={streamUrl} />
              </div>
            )}

            {/* ===== 항상 하단 고정 진행바 ===== */}
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

            {/* 좌상단 컨트롤 (컨테이너 none, 내부 auto) */}
            <div className='absolute top-3 left-3 flex items-center gap-2 z-30 pointer-events-none'>
              <button
                onPointerUp={e => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className='grid place-items-center p-1 pointer-events-auto'
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

              <div className='relative group pointer-events-none'>
                <button
                  onPointerUp={e => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className='grid place-items-center p-1 pointer-events-auto'
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
                  className='hidden group-hover:flex group-focus-within:flex items-center gap-2 absolute left-10 top-1/2 -translate-y-1/2
                             bg-black/40 backdrop-blur px-3 py-2 rounded-xl border border-white/10 pointer-events-auto'
                  onClick={stop}
                >
                  <input
                    type='range'
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={e => setVolume(parseFloat(e.target.value))}
                    className='w-44 accent-white'
                    aria-label='볼륨'
                  />
                </div>
              </div>
            </div>

            {/* 하단 프로필/제목 */}
            <div className='absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none'>
              <div
                className='flex items-center pointer-events-auto cursor-pointer'
                style={{ gap: NAME_GAP }}
                onClick={() => router.push(`/users/${node.author.id}`)}
                title={`${node.author.displayName}의 프로필로 이동`}
              >
                <Avatar src={node.author.avatarUrl} size={AVATAR_SIZE} />
                <div className='text-sm font-semibold flex items-center gap-2'>
                  {node.author.displayName}
                  {/* ⬇️ 작고 심플한 구독 버튼 */}
                  <FollowButton targetUserId={node.author.id} size='sm' />
                </div>
              </div>
              <p className='mt-2 text-[13px] text-white/90 line-clamp-2 pointer-events-auto'>
                {node.title}
              </p>
            </div>
          </div>

          {/* ===== 우측 액션 레일 (모달보다 아래, 콘텐츠보다 위) ===== */}
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
