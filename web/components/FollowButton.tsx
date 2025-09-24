'use client';

import React from 'react';
import { useFollow } from '@/hooks/useFollow';
import { loadUserProfile } from '@/lib/user';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { getAccessToken } from '@/lib/http';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'ghost' | 'pill';

const stripAt = (s: string) => (s?.startsWith('@') ? s.slice(1) : s);

export default function FollowButton({
  targetHandle,
  size = 'sm',
  variant = 'ghost',
  className,
}: {
  targetHandle: string;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const authed = typeof window !== 'undefined' ? !!getAccessToken() : false;

  const me = authed && typeof window !== 'undefined' ? loadUserProfile() : null;

  const { open: openAuth } = useAuthModal();

  const normTarget = stripAt(targetHandle || '');
  const myHandle = stripAt(((me as any)?.handle as string | undefined) || '');

  // 타겟 핸들이 없으면 숨김
  if (!normTarget) return null;

  // 로그인 상태일 때만 "자기 자신이면 숨김"
  if (authed && myHandle && myHandle === normTarget) return null;

  const sizeCls: Record<Size, string> = {
    sm: 'h-7 px-3 text-[11px]',
    md: 'h-9 px-3.5 text-[13px]',
    lg: 'h-11 px-4 text-[14px]',
  };

  const ghostBase =
    'rounded-full border bg-transparent text-white border-white/80 hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-white/30';
  const ghostFollowing =
    'rounded-full border bg-transparent border-[#5a319f] text-[#5a319f] hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-[#5a319f]/40';

  const pillBase =
    'rounded-xl border border-white/20 bg-white/10 hover:bg-white/16 text-white focus:outline-none focus:ring-2 focus:ring-white/20';
  const pillFollowing =
    'rounded-xl border-transparent bg-[#5a319f] hover:bg-[#5a319f]/90 text-white focus:outline-none focus:ring-2 focus:ring-[#5a319f]/40';

  // 비로그인: 훅 미장착 + 항상 '팔로우'로 고정, 모달만 오픈
  if (!authed) {
    const variantCls = variant === 'ghost' ? ghostBase : pillBase;
    return (
      <button
        type='button'
        onClick={() => openAuth('login')}
        className={[
          'inline-flex items-center justify-center select-none font-semibold transition-colors',
          sizeCls[size],
          variantCls,
          className || '',
        ].join(' ')}
        aria-pressed={false}
      >
        팔로우
      </button>
    );
  }

  // 로그인 상태: 실제 팔로우 훅 장착
  const { isFollowing, isLoading, toggle } = useFollow(normTarget);
  const label = isFollowing ? '팔로잉' : '팔로우';

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
      disabled={isLoading || !normTarget}
      aria-disabled={isLoading || !normTarget}
      onClick={toggle}
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
