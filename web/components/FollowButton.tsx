'use client';

import React from 'react';
import { useFollow } from '@/hooks/useFollow';
import { getAccessToken } from '@/lib/http';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { loadUserProfile } from '@/lib/user';

type Props = {
  targetUserId: string;
  size?: 'sm' | 'md';
};

export default function FollowButton({ targetUserId, size = 'sm' }: Props) {
  const { open: openAuth } = useAuthModal();
  const me = typeof window !== 'undefined' ? loadUserProfile() : null;
  const isMe = me?.id && me.id === targetUserId;

  // 내 버튼이면 숨김
  if (isMe) return null;

  const loggedIn = !!getAccessToken();
  // 로그인 상태에서만 서버로 상태 조회 (로그아웃이면 요청 안 함)
  const { isFollowing, isLoading, toggle } = useFollow(targetUserId, {
    enabled: loggedIn,
  });

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ★ 부모 클릭(프로필 이동) 막기
    if (!loggedIn) {
      openAuth('login'); // 로그인 모달만 열기
      return;
    }
    toggle();
  };

  const padCls =
    size === 'sm' ? 'px-2 py-[3px] text-[11px]' : 'px-3 py-[6px] text-[13px]';

  return (
    <button
      type='button'
      disabled={isLoading}
      onClick={onClick}
      className={`rounded-full font-semibold disabled:opacity-50 hover:bg-white/10 ${padCls}`}
      style={{
        border: '1px solid rgba(255,255,255,0.6)',
        background: 'transparent',
        color: '#fff', // ★ 구독/구독중 모두 하얀색
      }}
      aria-pressed={loggedIn && isFollowing ? true : false}
    >
      {loggedIn && isFollowing ? '구독중' : '구독'}
    </button>
  );
}
