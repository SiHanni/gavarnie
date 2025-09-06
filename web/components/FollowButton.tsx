'use client';

import React from 'react';
import { useFollow } from '@/hooks/useFollow';
import { loadUserProfile } from '@/lib/user';
import { useAuthModal } from '@/contexts/AuthModalContext';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'ghost' | 'pill'; // 피드: ghost / 프로필: pill

export default function FollowButton({
  targetUserId,
  size = 'sm',
  variant = 'ghost',
  className,
}: {
  targetUserId: string;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const me = typeof window !== 'undefined' ? loadUserProfile() : null;
  const isMine = !!me && String(me.id) === String(targetUserId);
  const { open: openAuth } = useAuthModal();

  if (isMine) return null;

  const { isFollowing, isLoading, toggle } = useFollow(targetUserId);
  const label = isFollowing ? '팔로잉' : '팔로우';

  const sizeCls: Record<Size, string> = {
    sm: 'h-7 px-3 text-[11px]',
    md: 'h-9 px-3.5 text-[13px]',
    lg: 'h-11 px-4 text-[14px]',
  };

  // ===== 피드용(ghost): 완전 투명, 테두리+글자만 보임 =====
  // - 기본: 흰색 테두리/글자
  // - 구독 중: 보라색 테두리/글자
  const ghostBase =
    'rounded-full border bg-transparent text-white ' +
    'border-white/80 hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-white/30';
  const ghostFollowing =
    'rounded-full border bg-transparent ' +
    'border-[#5a319f] text-[#5a319f] hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-[#5a319f]/40';

  // ===== 프로필용(pill): 기존 유지(연한 배경, 구독 중 보라색 배경) =====
  const pillBase =
    'rounded-xl border border-white/20 bg-white/10 hover:bg-white/16 text-white focus:outline-none focus:ring-2 focus:ring-white/20';
  const pillFollowing =
    'rounded-xl border-transparent bg-[#5a319f] hover:bg-[#5a319f]/90 text-white focus:outline-none focus:ring-2 focus:ring-[#5a319f]/40';

  const variantCls =
    variant === 'ghost'
      ? isFollowing
        ? ghostFollowing
        : ghostBase
      : isFollowing
        ? pillFollowing
        : pillBase;

  return (
    <button
      type='button'
      disabled={isLoading}
      onClick={() => {
        if (!me) {
          openAuth('login'); // 미로그인 → 로그인 모달
          return;
        }
        toggle();
      }}
      className={[
        'inline-flex items-center justify-center select-none font-semibold transition-colors',
        sizeCls[size],
        variantCls,
        className || '',
      ].join(' ')}
      aria-pressed={isFollowing}
    >
      {label}
    </button>
  );
}
