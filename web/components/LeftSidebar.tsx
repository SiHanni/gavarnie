'use client';

import Link from 'next/link';
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
  width?: number;
  logoSrc?: string;
  logoWidth?: number;
  logoHeight?: number;
  paddingTop?: number;
  paddingLeft?: number;
};

const ICON_SIZE = 28;

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

  // ⬇️ 약관 페이지에서는 사이드바 숨김
  if (pathname?.startsWith('/terms')) return null;

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

  const goHome = () => {
    if (pathname === '/') {
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
      className='fixed left-0 top-0 h-[100svh] z-[80] bg-black/60 backdrop-blur-sm text-white'
      style={{ width }}
      aria-label='왼쪽 내비게이션'
    >
      <div
        className='flex flex-col h-full'
        style={{ paddingTop, paddingLeft, paddingRight: 12 }}
      >
        {/* 배너 */}
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
          <SideItem
            label='홈'
            iconSrc='/images/Home.png'
            onClick={goHome}
            active={pathname === '/'}
            iconSize={ICON_SIZE}
          />
          <SideItem
            label='업로드'
            iconSrc='/images/shinewaterdrop.png'
            onClick={doUpload}
            iconSize={ICON_SIZE}
          />
          <SideItem
            label='프로필'
            iconSrc='/images/profile.png'
            onClick={goProfile}
            iconSize={ICON_SIZE}
          />
          {!loggedIn ? (
            <SideItem
              label='로그인'
              iconSrc='/images/login.png'
              onClick={() => openAuth('login')}
              iconSize={ICON_SIZE}
            />
          ) : (
            <SideItem
              label='로그아웃'
              iconSrc='/images/logout.png'
              onClick={doLogout}
              iconSize={ICON_SIZE}
            />
          )}
        </nav>

        {/* ▼ 로그인 버튼 바로 아래: 약관/정책 링크(티톡 스타일 참고) */}
        <div className='mt-6 mx-3 border-t border-white/10' />
        <div className='px-3 pt-4 pb-2 text-[13px] text-white/60 space-y-2'>
          {/* 필요시 /about, /programs 페이지를 만들거나 #로 두세요 */}
          <div className='hover:text-white transition-colors'>
            <Link href='/about'>회사</Link>
          </div>
          <div className='hover:text-white transition-colors'>
            <Link href='/terms'>약관 및 정책</Link>
          </div>
        </div>
        <div className='px-3 pt-1 text-[12px] text-white/40 mt-auto mb-3'>
          © {new Date().getFullYear()} Catarie
        </div>

        {/* 하단 내 정보(로그인 시) */}
        {loggedIn && (
          <div className='mb-4 mr-3'>
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

function SideItem({
  label,
  iconSrc,
  onClick,
  active,
  iconSize = 28,
}: {
  label: string;
  iconSrc?: string;
  onClick: () => void;
  active?: boolean;
  iconSize?: number;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors
        ${active ? 'bg-white/15 border-white/15' : 'hover:bg-white/10 hover:border-white/10 border-transparent'}
      `}
    >
      <span className='inline-flex items-center gap-3'>
        {iconSrc && (
          <img
            src={iconSrc}
            alt=''
            width={iconSize}
            height={iconSize}
            style={{ width: iconSize, height: iconSize }}
            className='inline-block align-[-2px]'
            draggable={false}
            decoding='async'
            loading='lazy'
          />
        )}
        {label}
      </span>
    </button>
  );
}
