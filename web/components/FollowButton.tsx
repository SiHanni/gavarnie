'use client';

import React from 'react';
import clsx from 'clsx';
import { useFollow } from '@/hooks/useFollow';
import { getAccessToken } from '@/lib/http';
import { useAuthModal } from '@/contexts/AuthModalContext';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'brand' | 'pill'; // pill=둥근사각, 구독중=보라색

export default function FollowButton({
  targetUserId,
  size = 'md',
  variant = 'pill',
  className,
}: {
  targetUserId: string;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const { isFollowing, isLoading, toggle } = useFollow(targetUserId);
  const { open: openAuth } = useAuthModal();

  const onClick = () => {
    if (!getAccessToken()) {
      openAuth('login');
      return;
    }
    if (!isLoading) toggle();
  };

  // 크기 (둥근 사각형)
  const sizes: Record<Size, string> = {
    sm: 'h-8 px-3 text-[12px] rounded-xl',
    md: 'h-9 px-4 text-sm rounded-xl',
    lg: 'h-10 md:h-11 px-5 text-[15px] rounded-xl',
  };

  // 색상
  const BRAND = '#5a319f';
  const visual =
    variant === 'pill'
      ? // 구독중(보라) / 미구독(중립 그레이)
        isFollowing
        ? `bg-[${BRAND}] hover:brightness-110 text-white border border-transparent`
        : 'bg-white/10 hover:bg-white/16 text-white border border-white/20'
      : // 기본 보라 버튼
        'bg-[${BRAND}] hover:brightness-110 text-white border border-transparent';

  return (
    <button
      type='button'
      disabled={isLoading}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center font-semibold transition-colors select-none',
        sizes[size],
        visual,
        className
      )}
    >
      {isLoading ? '...' : isFollowing ? '구독중' : '구독'}
    </button>
  );
}
