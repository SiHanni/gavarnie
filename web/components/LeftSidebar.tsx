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

const BRAND = '#5a319f';
const GRADE_LABEL: Record<'basic' | 'plus' | 'premium', string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
};

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

  // 약관 페이지에선 사이드바 숨김
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

        {/* 약관/정책 링크 */}
        <div className='mt-6 mx-3 border-t border-white/10' />
        <div className='px-3 pt-4 pb-2 text-[13px] text-white/60 space-y-2'>
          <div className='hover:text-white transition-colors'>
            <Link href='/about'>회사</Link>
          </div>
          <div className='hover:text-white transition-colors'>
            <Link href='/terms'>약관 및 정책</Link>
          </div>
        </div>

        {/* 하단 프로필 카드 (전체가 버튼) */}
        {loggedIn && (
          // ▼ 카드 위치를 아래로: mt-auto 추가 + 여백 살짝 키움
          <div className='mt-auto mb-40 mr-3'>
            <button
              type='button'
              onClick={goProfile}
              aria-label='내 프로필로 이동'
              // ▼ 이름을 오른쪽으로: gap-4로 간격 확대
              className='w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2
                         hover:bg-white/10 hover:border-white/20 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-[#5a319f]/60'
            >
              {/* 아바타 */}
              <div className='w-11 h-11 overflow-hidden rounded-full border border-white/20'>
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

              {/* 텍스트: 뱃지 ↑, 이름 ↓ */}
              <div className='min-w-0 text-left'>
                {!!me?.userGrade && (
                  // ▼ 뱃지 더 크게: 패딩/폰트 업
                  <span
                    className='inline-block px-3 py-1 rounded-full text-[12px] md:text-[13px] font-semibold border'
                    style={{
                      color: BRAND,
                      backgroundColor: 'rgba(90,49,159,0.15)',
                      borderColor: 'rgba(90,49,159,0.35)',
                    }}
                    title={`회원 등급: ${
                      GRADE_LABEL[
                        (me!.userGrade as 'basic' | 'plus' | 'premium') ||
                          'basic'
                      ]
                    }`}
                  >
                    {
                      GRADE_LABEL[
                        (me!.userGrade as 'basic' | 'plus' | 'premium') ||
                          'basic'
                      ]
                    }
                  </span>
                )}
                {/* ▼ 이름을 한 칸 더 밀기: ml-2 + 글자 조금 키움 */}
                <div
                  className='mt-1 ml-2 text-white/90 text-[15px] leading-tight break-words line-clamp-2'
                  title={me!.displayName || me!.email}
                >
                  {me!.displayName || me!.email}
                </div>
              </div>
            </button>

            <div className='px-3 pt-1 text-[12px] text-white/40 mt-auto mb-3'>
              © {new Date().getFullYear()} Catarie
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
        ${
          active
            ? 'bg-white/15 border-white/15'
            : 'hover:bg-white/10 hover:border-white/10 border-transparent'
        }
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
