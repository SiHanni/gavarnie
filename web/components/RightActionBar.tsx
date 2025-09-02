'use client';

import Image from 'next/image';
import Avatar from '@/components/Avatar';

type Props = {
  likeCount: number;
  commentCount: number;
  stageHeight: number;

  // 레일 전체를 아래로 내리고 싶을 때(+px)
  offsetY?: number;

  // 공통 기본 버튼 지름(px) – 개별 값 없을 때만 사용
  buttonSize?: number;

  // 개별 버튼 지름(px)
  likeButtonSize?: number;
  commentButtonSize?: number;
  shareButtonSize?: number;

  // 개별 아이콘 크기(px) — 버튼 지름과 독립
  likeIconSize?: number;
  commentIconSize?: number;
  shareIconSize?: number;

  // 아바타(맨 위) 설정
  avatarUrl?: string;
  avatarButtonSize?: number; // 원형 배경 지름
  avatarIconSize?: number; // 내부 이미지 한 변

  // ✅ 아바타만 위/아래로 미세 이동(px) — 음수면 위로
  avatarOffsetY?: number;

  // 회색 원형 배경 투명도(0~1). 0.15 ~ 0.22 권장
  buttonBgAlpha?: number;

  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
};

export default function RightActionBar({
  likeCount,
  commentCount,
  stageHeight,
  offsetY = 40,
  buttonSize = 56,
  likeButtonSize,
  commentButtonSize,
  shareButtonSize,
  likeIconSize = 28,
  commentIconSize = 28,
  shareIconSize = 28,
  avatarUrl,
  avatarButtonSize = 56,
  avatarIconSize = 32,
  avatarOffsetY = -20, // ← 기본 0, 음수면 위로 살짝 올림
  buttonBgAlpha = 0.15,
  onLike,
  onComment,
  onShare,
}: Props) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // 버튼 지름(아이콘과 독립)
  const likeBtn = likeButtonSize ?? buttonSize ?? 56;
  const cmtBtn = commentButtonSize ?? buttonSize ?? 56;
  const shareBtn = shareButtonSize ?? buttonSize ?? 56;

  // 레일 너비는 가장 큰 버튼 기준
  const railWidth = Math.max(avatarButtonSize, likeBtn, cmtBtn, shareBtn) + 8;

  const bg = `rgba(255,255,255,${buttonBgAlpha})`;

  const Circle = ({
    size,
    children,
    label,
    onClick,
    background = bg,
    style,
  }: {
    size: number;
    label?: string;
    onClick?: () => void;
    background?: string;
    style?: React.CSSProperties;
    children: React.ReactNode;
  }) => (
    <button
      aria-label={label}
      onClick={e => {
        if (onClick) {
          stop(e);
          onClick();
        }
      }}
      className='rounded-full grid place-items-center'
      style={{
        width: size,
        height: size,
        backgroundColor: background,
        ...style,
      }}
    >
      {children}
    </button>
  );

  return (
    <aside
      onClick={stop}
      className='select-none flex flex-col items-center justify-center gap-3'
      style={{
        height: stageHeight,
        width: railWidth,
        transform: `translateY(${offsetY}px)`,
      }}
      aria-label='동작 메뉴'
    >
      {/* ── 아바타 (위로 살짝 올리고 싶으면 avatarOffsetY에 음수 값) ── */}
      <Circle
        size={avatarButtonSize}
        label='작성자 프로필'
        style={{ transform: `translateY(${avatarOffsetY}px)` }} // ← 여기서만 따로 이동
      >
        <Avatar src={avatarUrl ?? undefined} size={avatarIconSize} />
      </Circle>

      {/* 좋아요 */}
      <div className='flex flex-col items-center gap-1'>
        <Circle size={likeBtn} label='좋아요' onClick={onLike}>
          <Image
            src='/images/like.png'
            alt=''
            width={likeIconSize}
            height={likeIconSize}
            style={{ width: likeIconSize, height: likeIconSize }}
          />
        </Circle>
        <span className='text-xs text-white/80'>{likeCount}</span>
      </div>

      {/* 댓글 */}
      <div className='flex flex-col items-center gap-1'>
        <Circle size={cmtBtn} label='댓글' onClick={onComment}>
          <Image
            src='/images/comment_list.png'
            alt=''
            width={commentIconSize}
            height={commentIconSize}
            style={{ width: commentIconSize, height: commentIconSize }}
          />
        </Circle>
        <span className='text-xs text-white/80'>{commentCount}</span>
      </div>

      {/* 공유 */}
      <Circle size={shareBtn} label='공유' onClick={onShare}>
        <Image
          src='/images/shareV1.png'
          alt=''
          width={shareIconSize}
          height={shareIconSize}
          style={{ width: shareIconSize, height: shareIconSize }}
        />
      </Circle>
    </aside>
  );
}
