'use client';

import { useAuthModal } from '@/contexts/AuthModalContext';
import { getAccessToken } from '@/lib/http';
import { loadUserProfile } from '@/lib/user';
import { useFollow } from '@/hooks/useFollow';

export default function FollowButton({
  targetUserId,
  size = 'sm',
  className = '',
  hideIfSelf = true,
}: {
  targetUserId: string;
  size?: 'sm' | 'md';
  className?: string;
  /** 본인 대상이면 버튼 숨김 (기본 true) */
  hideIfSelf?: boolean;
}) {
  const me = typeof window !== 'undefined' ? loadUserProfile() : null;

  // 내 영상/내 프로필이면 렌더 안 함
  if (
    hideIfSelf &&
    targetUserId &&
    me?.id &&
    String(me.id) === String(targetUserId)
  ) {
    return null;
  }

  const { isFollowing, isLoading, toggle } = useFollow(targetUserId);
  const { open: openLogin } = useAuthModal();

  const pad =
    size === 'sm' ? 'px-2 py-[2px] text-[11px]' : 'px-3 py-1 text-[13px]';

  return (
    <button
      type='button'
      onClick={e => {
        e.stopPropagation(); // 부모 클릭(프로필 이동 등) 방지
        if (!getAccessToken()) {
          openLogin('login');
          return;
        }
        toggle();
      }}
      disabled={isLoading}
      className={`rounded-full border ${pad} transition-colors ${className}
        ${
          isFollowing
            ? 'border-white/30 text-white/90' // 구독중: 색 채우지 않음
            : 'border-white/30 text-white/90 hover:border-white/60' // 구독: 같은 톤 유지
        }
      `}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? '구독 취소' : '구독'}
      title={isFollowing ? '구독 취소' : '구독'}
    >
      {isFollowing ? '구독중' : '구독'}
    </button>
  );
}
