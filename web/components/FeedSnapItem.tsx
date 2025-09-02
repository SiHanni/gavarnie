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
// import { ENV } from '@/lib/env'; // (미사용이라 주석 처리)
import { useMediaLike } from '@/hooks/useMediaLike';
import { shareLink } from '@/lib/share';

function isAudio(node: RecentMediaNode) {
  return node.contentType?.startsWith('audio/');
}

export default function FeedSnapItem({
  node,
  overlayAvatarSize,
}: {
  node: RecentMediaNode;
  overlayAvatarSize?: number; // px 단위, 안 넘기면 자동 계산
}) {
  const streamUrl = useMemo(() => joinHls(node.hlsKey), [node.hlsKey]);
  const audioKind = isAudio(node);
  const title = filenameWithoutExt(node.originalFilename);

  // 👍 좋아요 연동 (낙관적 업데이트 + 서버 카운트)
  const { liked, count, toggle } = useMediaLike(node.id);

  // 프레임 크기 계산
  const { width, height } = useStageBox(80, 0.96, 9 / 16);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting && e.intersectionRatio >= 0.6);
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const m = audioKind ? audioRef.current : videoRef.current;
    if (!m) return;
    const apply = () => {
      m.muted = muted;
      m.volume = volume;
      if (visible)
        m.play()
          .then(() => setPlaying(true))
          .catch(() => {});
      else {
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
  const onFrameClick = () => {
    if (audioKind && muted) setMuted(false);
    togglePlay();
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ====== 🔧 크기 노브 (여기 숫자만 바꾸면 전체 조정됩니다) ======
  const RAIL_BTN = Math.min(76, Math.max(56, Math.round(height * 0.085))); // 세로레일 버튼 지름
  const RAIL_ICON = Math.round(RAIL_BTN * 0.52); // 아이콘 크기
  const OVERLAY_BTN = Math.round(RAIL_BTN * 0.86); // 좌상단 버튼 지름
  const OVERLAY_ICON = Math.round(OVERLAY_BTN * 0.56); // 좌상단 아이콘 크기
  const VOLUME_POP_LEFT = OVERLAY_BTN + 8; // 볼륨 팝업 좌측 오프셋

  // 프레임 크기 계산 이후에 아바타 크기 결정 (넘겨주지 않으면 화면 비례)
  const autoAvatar = Math.round(height * 0.04); // 화면 비례 기본값(원하면 0.035~0.05로 조절)
  const AVATAR_SIZE = overlayAvatarSize ?? autoAvatar;
  const NAME_GAP = Math.max(6, Math.round(AVATAR_SIZE * 0.35)); // 이름과의 간격 살짝 비례
  // ===============================================================

  return (
    <section
      ref={rootRef}
      className='snap-start h-[100svh] bg-black text-white relative overflow-hidden'
    >
      <div className='h-full w-full grid place-items-center'>
        <div className='flex items-center gap-5'>
          {/* ======== 프레임 (클릭 → 재생/일시정지) ======== */}
          <div
            role='button'
            aria-label='재생/일시정지'
            onClick={onFrameClick}
            className='relative rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl bg-transparent cursor-pointer'
            style={{ width, height }}
          >
            {!audioKind ? (
              <VideoPlayer
                ref={videoRef}
                src={streamUrl}
                muted={muted}
                fit='contain'
              />
            ) : (
              <div className='w-full h-full grid place-items-center'>
                {/* TODO: 오디오 커버 이미지 */}
                <div className='w-[min(88%,520px)] aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-700 to-neutral-900 border border-neutral-700' />
                <AudioPlayer ref={audioRef} src={streamUrl} />
              </div>
            )}

            {/* 좌상단: 재생/정지 + 스피커 + (hover)볼륨바 */}
            <div
              className='absolute top-3 left-3 flex items-center gap-2'
              onClick={stop}
            >
              {/* 재생/일시정지 — 배경 제거 */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  togglePlay();
                }}
                aria-label={playing ? '일시정지' : '재생'}
                className='grid place-items-center p-1' // ✅ bg 제거 (투명)
              >
                <Image
                  src={playing ? '/images/pause.png' : '/images/play.png'}
                  alt=''
                  width={28}
                  height={28} // 필요시 숫자만 바꾸면 됨
                  className='w-7 h-7'
                />
              </button>

              {/* 스피커 — 배경 제거 */}
              <div className='relative group'>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  aria-label={muted ? '음소거 해제' : '음소거'}
                  className='grid place-items-center p-1' // ✅ bg 제거 (투명)
                >
                  <Image
                    src={muted ? '/images/mute.png' : '/images/speaker.png'}
                    alt=''
                    width={28}
                    height={28}
                    className='w-8 h-9'
                  />
                </button>

                {/* (선택) 볼륨 슬라이더 — 기존 그대로 유지 */}
                <div
                  className='hidden group-hover:flex group-focus-within:flex
                 items-center gap-2 absolute left-10 top-1/2 -translate-y-1/2
                 bg-black/40 backdrop-blur px-3 py-2 rounded-xl border border-white/10'
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

            {/* 하단: 작성자/제목(확장자 제거) */}
            <div
              className='absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/40 to-transparent'
              onClick={stop}
            >
              <div className='flex items-center' style={{ gap: NAME_GAP }}>
                <Avatar src={node.author.avatarUrl} size={AVATAR_SIZE} />
                <div className='text-sm font-semibold'>
                  {node.author.displayName}
                </div>
              </div>
              <p className='mt-2 text-[13px] text-white/90 line-clamp-2'>
                {title}
              </p>
            </div>
          </div>

          {/* ======== 오른쪽 세로 레일 (좋아요/댓글/공유 연결) ======== */}
          <RightActionBar
            avatarUrl={node.author.avatarUrl || undefined}
            likeCount={count} // ✅ 서버 카운트 + 낙관적 반영
            commentCount={node.commentCount}
            stageHeight={height}
            offsetY={160} // 레일을 더 아래로
            // 프로필 크게
            avatarButtonSize={65}
            avatarIconSize={60}
            // ✅ 개별 버튼 지름
            likeButtonSize={50}
            commentButtonSize={50}
            shareButtonSize={50}
            // ✅ 개별 아이콘 크기 (원과 독립)
            likeIconSize={33}
            commentIconSize={40}
            shareIconSize={40}
            buttonBgAlpha={0.18}
            onLike={toggle} // ✅ 좋아요 토글
            onComment={() => {
              // TODO: 댓글 패널 열기 (다음 단계에서 연결)
              // 예: window.dispatchEvent(new CustomEvent('comments:open', { detail: { mediaId: node.id } }));
            }}
            onShare={() => {
              const url =
                typeof window !== 'undefined'
                  ? `${location.origin}/?m=${node.id}`
                  : streamUrl;
              shareLink(url, title);
            }}
          />
        </div>
      </div>
    </section>
  );
}
