'use client';

import Image from 'next/image';
import clsx from 'clsx';

type Props = {
  avatarUrl?: string;
  likeCount?: number;
  commentCount?: number;
  stageHeight: number; // 세로 가운데 정렬용(부모 flex와 함께 사용)
  offsetY?: number; // 필요한 경우만 사용(기본 120)

  // 원형 버튼 지름
  avatarButtonSize?: number;
  likeButtonSize?: number;
  commentButtonSize?: number;
  shareButtonSize?: number;

  // 내부 아이콘 크기
  avatarIconSize?: number;
  likeIconSize?: number;
  commentIconSize?: number;
  shareIconSize?: number;

  // 원 배경 투명도(0~1)
  buttonBgAlpha?: number;

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

  onLike,
  onComment,
  onShare,
}: Props) {
  // ✅ 댓글 패널보다 항상 아래로만 깔리게 낮은 z-index 고정
  //    (패널은 z-[1000] 을 사용 중)
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
      {/* 작성자 */}
      <RailItem
        buttonSize={avatarButtonSize}
        iconSize={avatarIconSize}
        circle={circle}
        icon={
          avatarUrl ? (
            // 아바타는 어떤 도메인도 허용되도록 <img> 사용
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
        onClick={onLike}
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
        onClick={onComment}
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
        onClick={onShare}
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
  onClick?: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className='flex flex-col items-center'>
      {/* ✅ 아이콘은 원 안 '정중앙' */}
      <button
        type='button'
        onClick={onClick}
        className='grid place-items-center text-white'
        style={circle(buttonSize)}
      >
        {icon}
      </button>
      {/* ✅ 카운트는 원 '바깥 아래' — 위로 밀리는 현상 제거 */}
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
