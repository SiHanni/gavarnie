'use client';

import Image from 'next/image';
import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

function useIsMobile(max = 560) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${max}px)`);
    const sync = () => setM(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, [max]);
  return m;
}

type Props = {
  avatarUrl?: string;
  likeCount?: number;
  commentCount?: number;

  /** outside 모드에서 세로 오프셋(px) */
  offsetY?: number;

  // 버튼 지름
  avatarButtonSize?: number;
  likeButtonSize?: number;
  commentButtonSize?: number;
  shareButtonSize?: number;

  // 아이콘 크기
  avatarIconSize?: number;
  likeIconSize?: number;
  commentIconSize?: number;
  shareIconSize?: number;

  buttonBgAlpha?: number;

  /** outside: 프레임 바깥 오른쪽 / inside: 프레임 안쪽 우측(모바일) */
  variant?: 'outside' | 'inside';

  /** inside 모드에서 세로 오프셋(+면 아래) */
  insideOffsetY?: number;
  /** inside 모드에서 우측 여백(px) */
  insideRight?: number;

  /** 이 픽셀 이하를 모바일로 간주(기본 560) */
  mobileBreakpoint?: number;

  onAvatarClick?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
};

export default function RightActionBar({
  avatarUrl,
  likeCount = 0,
  commentCount = 0,

  offsetY = 120,

  avatarButtonSize = 56,
  likeButtonSize = 48,
  commentButtonSize = 48,
  shareButtonSize = 48,

  avatarIconSize = 52,
  likeIconSize = 30,
  commentIconSize = 30,
  shareIconSize = 30,

  buttonBgAlpha = 0.18,
  variant = 'outside',

  insideOffsetY = 20,
  insideRight = 10,

  mobileBreakpoint = 560,

  onAvatarClick,
  onLike,
  onComment,
  onShare,
}: Props) {
  const isMobile = useIsMobile(mobileBreakpoint);

  // z 값은 tailwind 기본(50)보다 높은 임의값 사용
  const wrapBase =
    'pointer-events-auto flex flex-col items-center gap-4 z-[70]';

  const wrapPos =
    variant === 'inside'
      ? 'absolute right-2 top-1/2' // 프레임 내부
      : 'absolute top-1/2 left-0'; // 프레임 외부 래퍼 안에서

  const wrapCls = clsx(wrapBase, wrapPos);

  const style: React.CSSProperties =
    variant === 'inside'
      ? {
          right: insideRight,
          transform: `translateY(calc(-50% + ${insideOffsetY}px))`,
        }
      : { transform: `translateY(calc(-50% + ${offsetY}px))` };

  const circle = (size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: `rgba(255,255,255,${buttonBgAlpha})`,
  });

  return (
    <div className={wrapCls} style={style} aria-label='오른쪽 액션바'>
      {/* 작성자 — 모바일에서는 숨김 */}
      {!isMobile && (
        <RailItem
          buttonSize={avatarButtonSize}
          iconSize={avatarIconSize}
          circle={circle}
          onClick={e => {
            e?.stopPropagation?.();
            onAvatarClick?.();
          }}
          icon={
            avatarUrl ? (
              <img
                src={avatarUrl}
                alt='author'
                width={avatarButtonSize}
                height={avatarButtonSize}
                className='w-full h-full object-cover rounded-full'
                referrerPolicy='no-referrer'
              />
            ) : (
              <div className='grid place-items-center w-full h-full text-white/80 text-sm' />
            )
          }
        />
      )}

      {/* 좋아요 */}
      <RailItem
        buttonSize={likeButtonSize}
        iconSize={likeIconSize}
        circle={circle}
        count={likeCount}
        onClick={e => {
          e?.stopPropagation?.();
          onLike?.();
        }}
        icon={
          <Image
            src='/images/like.png'
            alt='like'
            width={likeIconSize}
            height={likeIconSize}
            className='pointer-events-none'
          />
        }
      />

      {/* 댓글 */}
      <RailItem
        buttonSize={commentButtonSize}
        iconSize={commentIconSize}
        circle={circle}
        count={commentCount}
        onClick={e => {
          e?.stopPropagation?.();
          onComment?.();
        }}
        icon={
          <Image
            src='/images/comment_list.png'
            alt='comments'
            width={commentIconSize}
            height={commentIconSize}
            className='pointer-events-none'
          />
        }
      />

      {/* 공유 */}
      <RailItem
        buttonSize={shareButtonSize}
        iconSize={shareIconSize}
        circle={circle}
        onClick={e => {
          e?.stopPropagation?.();
          onShare?.();
        }}
        icon={
          <Image
            src='/images/shareV1.png'
            alt='share'
            width={shareIconSize}
            height={shareIconSize}
            className='pointer-events-none'
          />
        }
      />
    </div>
  );
}

function RailItem({
  buttonSize,
  iconSize,
  circle,
  count,
  onClick,
  icon,
}: {
  buttonSize: number;
  iconSize: number;
  circle: (n: number) => React.CSSProperties;
  count?: number;
  onClick?: (e: React.MouseEvent) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className='flex flex-col items-center'>
      <button
        type='button'
        onClick={onClick}
        className='grid place-items-center text-white'
        style={circle(buttonSize)}
        aria-label='action'
      >
        {icon}
      </button>
      {typeof count === 'number' && (
        <span className='mt-1 text-xs text-white/80'>{formatCount(count)}</span>
      )}
    </div>
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${Math.floor(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.floor(n / 1_000) / 10}만`;
  if (n >= 1_000) return `${Math.floor(n / 100) / 10}천`;
  return String(n);
}
