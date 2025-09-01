'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { getStoredUser, type UserProfile } from '@/lib/user';
import { getAccessToken, clearToken } from '@/lib/http';

// 🔧 쉽게 튜닝할 수 있는 기본값들
const DEFAULTS = {
  top: 20, // px: 상단 여백
  right: 50, // px: 우측 여백
  gap: 45, // px: 버튼 간격
  avatarSize: 50, // px: 아바타 직경
  loginBtnPaddingX: 20,
  loginBtnHeight: 36, // px
  loginColor: '#59319f',
};

export default function TopRightActions({
  top = DEFAULTS.top,
  right = DEFAULTS.right,
  gap = DEFAULTS.gap,
  avatarSize = DEFAULTS.avatarSize,
  loginBtnHeight = DEFAULTS.loginBtnHeight,
  loginBtnPaddingX = DEFAULTS.loginBtnPaddingX,
  loginColor = DEFAULTS.loginColor,
}: Partial<typeof DEFAULTS>) {
  const router = useRouter();
  const { open } = useAuthModal();

  const [user, setUser] = useState<UserProfile | null>(null);

  // 초기 로드 + 로그인/로그아웃 이벤트 반영
  useEffect(() => {
    setUser(getStoredUser() || null);

    const onLogin = (e: Event) => {
      const detail = (e as CustomEvent).detail as UserProfile | undefined;
      setUser(detail ?? getStoredUser());
    };
    const onLogout = () => setUser(null);

    window.addEventListener('auth:login', onLogin as EventListener);
    window.addEventListener('auth:logout', onLogout as EventListener);

    return () => {
      window.removeEventListener('auth:login', onLogin as EventListener);
      window.removeEventListener('auth:logout', onLogout as EventListener);
    };
  }, []);

  const doLogout = () => {
    clearToken();
    // userProfile도 비우고 알림
    try {
      localStorage.removeItem('userProfile');
    } catch {}
    setUser(null);
    window.dispatchEvent(new CustomEvent('auth:logout'));
  };

  return (
    <div className='fixed z-40 flex items-center' style={{ top, right, gap }}>
      {/* + 업로드 */}
      <button
        type='button'
        className='rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20'
        style={{ height: 36, paddingInline: 12 }}
        onClick={() => router.push('/upload')}
      >
        + 업로드
      </button>

      {/* 로그인 or 아바타 */}
      {!user || !getAccessToken() ? (
        <button
          type='button'
          onClick={() => open('login')}
          className='rounded-full font-semibold text-white hover:opacity-90'
          style={{
            backgroundColor: loginColor,
            height: loginBtnHeight,
            paddingInline: loginBtnPaddingX,
          }}
        >
          로그인
        </button>
      ) : (
        <div className='relative group'>
          {/* 아바타 버튼 */}
          <button
            type='button'
            className='rounded-full overflow-hidden border border-white/20 shadow-sm'
            style={{ width: avatarSize, height: avatarSize }}
            title={user.displayName || user.email || '프로필'}
            // 추후: 클릭 시 메뉴(프로필/로그아웃) 열도록 확장 가능
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt='avatar'
                width={avatarSize}
                height={avatarSize}
                className='w-full h-full object-cover'
                referrerPolicy='no-referrer'
              />
            ) : (
              <div className='w-full h-full grid place-items-center bg-white/10'>
                <span className='text-sm'>
                  {(user.displayName || user.email || 'U').slice(0, 1)}
                </span>
              </div>
            )}
          </button>

          {/* 간단한 호버 메뉴: 로그아웃 (원하면 제거 가능) */}
          <div className='absolute right-0 mt-2 hidden group-hover:block'>
            <button
              onClick={doLogout}
              className='px-3 py-1 rounded bg-white/10 border border-white/20 text-sm hover:bg-white/20'
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
