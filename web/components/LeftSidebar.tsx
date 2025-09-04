// components/LeftSidebar.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUploadModal } from '@/contexts/UploadModalContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import {
  hasStoredToken,
  getAccessToken,
  clearToken,
  fetchProfile,
} from '@/lib/http';
import {
  loadUserProfile,
  saveUserProfile,
  clearUserProfile,
  type UserProfile,
} from '@/lib/user';

type Props = {
  /** 사이드바 폭(px) */
  width?: number;
  /** 배너 이미지 경로 (public/ 경로 권장) */
  logoSrc?: string;
  /** 배너 표시 너비/높이(px) */
  logoWidth?: number;
  logoHeight?: number;
  /** 배너 바깥 여백 */
  paddingTop?: number;
  paddingLeft?: number;
};

export default function LeftSidebar({
  width = 260,
  logoSrc = '/images/banner.png',
  logoWidth = 220,
  logoHeight = 80,
  paddingTop = 20,
  paddingLeft = 20,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const { open: openUpload } = useUploadModal();
  const { open: openAuth } = useAuthModal();

  const [mounted, setMounted] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(
    typeof window !== 'undefined' ? hasStoredToken() : false
  );
  const [me, setMe] = useState<UserProfile | null>(
    typeof window !== 'undefined' ? loadUserProfile() : null
  );

  useEffect(() => {
    setMounted(true);

    if (hasToken && !me) {
      fetchProfile()
        .then(p => {
          saveUserProfile(p);
          setMe(p);
        })
        .catch(() => {});
    }

    const onLogin = (e: Event) => {
      const p = (e as CustomEvent).detail as UserProfile | undefined;
      if (p) saveUserProfile(p);
      setMe(p || loadUserProfile());
      setHasToken(true);
    };
    const onLogout = () => {
      setMe(null);
      setHasToken(false);
    };
    window.addEventListener('auth:login', onLogin as EventListener);
    window.addEventListener('auth:logout', onLogout as EventListener);
    return () => {
      window.removeEventListener('auth:login', onLogin as EventListener);
      window.removeEventListener('auth:logout', onLogout as EventListener);
    };
  }, [hasToken, me]);

  const loggedIn = mounted && hasToken && !!getAccessToken() && !!me;

  // ✅ 홈 배너 클릭: 홈이면 새로고침, 아니면 홈으로 이동
  const goHome = () => {
    if (pathname === '/') {
      // 완전 새로고침이 의도라면 reload 사용
      //window.location.reload();
      window.dispatchEvent(new CustomEvent('feed:refresh'));
      return;
    }
    router.push('/');
  };

  const goProfile = () => {
    if (!loggedIn) return openAuth('login');
    router.push(`/users/${me!.id}`);
  };

  const doUpload = () => {
    if (!loggedIn) return openAuth('login');
    openUpload();
  };

  const doLogout = () => {
    clearToken();
    clearUserProfile();
    setMe(null);
    setHasToken(false);
    window.dispatchEvent(new CustomEvent('auth:logout'));
  };

  if (!mounted) return null;

  return (
    <aside
      className='fixed left-0 top-0 h-[100svh] z-[80] bg-black/60 backdrop-blur-sm'
      style={{ width }}
      aria-label='왼쪽 내비게이션'
    >
      <div
        className='flex flex-col h-full'
        style={{ paddingTop, paddingLeft, paddingRight: 12 }}
      >
        {/* === 배너: 배경/테두리 없음, 클릭 영역 = 이미지 크기 === */}
        <button
          type='button'
          onClick={goHome}
          aria-label='홈으로 이동'
          className='block cursor-pointer select-none outline-none'
          style={{ width: logoWidth, height: logoHeight }}
        >
          <img
            src={logoSrc}
            alt='Catarie'
            className='block max-w-none'
            width={logoWidth}
            height={logoHeight}
            draggable={false}
            style={{
              display: 'block',
              width: logoWidth,
              height: logoHeight,
              objectFit: 'contain',
              background: 'transparent',
            }}
          />
        </button>

        {/* 메뉴 */}
        <nav className='mt-6 flex flex-col gap-2 text-[15px]'>
          <SideItem label='업로드' onClick={doUpload} />
          <SideItem label='프로필' onClick={goProfile} />
          {!loggedIn ? (
            <SideItem label='로그인' onClick={() => openAuth('login')} />
          ) : (
            <SideItem label='로그아웃' onClick={doLogout} />
          )}
        </nav>

        {/* 하단 내 정보(로그인 시) */}
        {loggedIn && (
          <div className='mt-auto mb-4 mr-3'>
            <div className='flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2'>
              <div className='w-9 h-9 overflow-hidden rounded-full border border-white/20'>
                {me!.avatarUrl ? (
                  <img
                    src={me!.avatarUrl}
                    alt='me'
                    className='w-full h-full object-cover'
                    referrerPolicy='no-referrer'
                  />
                ) : (
                  <div className='w-full h-full grid place-items-center bg-white/10 text-sm'>
                    {(me!.displayName || me!.email || 'U').slice(0, 1)}
                  </div>
                )}
              </div>
              <div className='truncate'>
                <div className='text-white/90 text-sm truncate'>
                  {me!.displayName || me!.email}
                </div>
                <button
                  type='button'
                  onClick={goProfile}
                  className='text-xs text-white/60 hover:text-white'
                >
                  내 프로필 보기 →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function SideItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 focus:bg-white/10 border border-transparent hover:border-white/10'
    >
      {label}
    </button>
  );
}
