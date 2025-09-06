'use client';

import Image from 'next/image';
import clsx from 'clsx';
import React from 'react';

type Props = {
  avatarUrl?: string;
  likeCount?: number;
  commentCount?: number;
  stageHeight: number;
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

  // 콜백들
  onAvatarClick?: () => void; // ⬅️ 추가
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
};

export default function RightActionBar({
  avatarUrl,
  likeCount = 0,
  commentCount = 0,
  stageHeight,
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

  onAvatarClick,
  onLike,
  onComment,
  onShare,
}: Props) {
  const wrapCls = clsx('relative z-30 flex flex-col items-center gap-4');

  const circle = (size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: `rgba(255,255,255,${buttonBgAlpha})`,
  });

  return (
    <div
      className={wrapCls + ' absolute top-1/2 left-0'}
      style={{ transform: `translateY(calc(-50% + ${offsetY}px))` }}
    >
      {/* 작성자 아바타 */}
      <RailItem
        buttonSize={avatarButtonSize}
        iconSize={avatarIconSize}
        circle={circle}
        onClick={e => {
          e?.stopPropagation?.(); // ⬅️ 비디오 클릭으로 전파 방지
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
            <div className='grid place-items-center w-full h-full text-white/80 text-sm'>
              ?
            </div>
          )
        }
      />

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
