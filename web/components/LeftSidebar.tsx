'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  compactAt?: number;
  mobileAt?: number;
};

const ICON_SIZE = 28;
const COMPACT_WIDTH = 72;
const COMPACT_ICON = 28;

const COMPANY_INFO_TEXT = 'Catarie(SH)';

export default function LeftSidebar({
  width = 260,
  logoSrc = '/images/banner.png',
  logoWidth = 220,
  logoHeight = 80,
  paddingTop = 20,
  paddingLeft = 20,
  compactAt = 1080,
  mobileAt = 560,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

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

  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [companyOpen, setCompanyOpen] = useState(false);
  const companyPanelRef = useRef<HTMLDivElement | null>(null);
  const [companyPanelH, setCompanyPanelH] = useState(0);

  useEffect(() => {
    const measure = () => {
      setCompanyPanelH(companyPanelRef.current?.scrollHeight ?? 0);
    };
    measure();
    window.addEventListener('resize', measure);
    if (companyOpen) setTimeout(measure, 0);
    return () => window.removeEventListener('resize', measure);
  }, [companyOpen]);

  useEffect(() => {
    const apply = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      setIsMobile(w <= mobileAt);
      setIsCompact(w > mobileAt && w <= compactAt);
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [compactAt, mobileAt]);

  useEffect(() => {
    setMounted(true);

    if (hasToken && !me) {
      fetchProfile()
        .then(p => {
          const normalized: UserProfile = {
            ...p,
            handle: p.handle ?? undefined,
          };
          saveUserProfile(normalized);
          setMe(normalized);
        })
        .catch(() => {});
    }

    const onLogin = (e: Event) => {
      const p = (e as CustomEvent).detail as UserProfile | undefined;
      if (p) {
        const normalized: UserProfile = { ...p, handle: p.handle ?? undefined };
        saveUserProfile(normalized);
        setMe(normalized);
      } else {
        setMe(loadUserProfile());
      }
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

  useEffect(() => {
    if (!mounted) return;
    window.dispatchEvent(new CustomEvent('sidebar:changed'));
  }, [mounted, isCompact]);

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
    const h = me?.handle;
    if (h && h.trim()) router.push(`/@${h}`);
    else router.push('/settings/profile');
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

  if (isMobile) {
    return (
      <BottomTabBar
        activePathname={pathname}
        onHome={goHome}
        onUpload={doUpload}
        onProfile={goProfile}
      />
    );
  }

  if (isCompact) {
    return (
      <CompactRail
        loggedIn={loggedIn}
        onHome={goHome}
        onUpload={doUpload}
        onProfile={goProfile}
        onLogin={() => openAuth('login')}
        onLogout={doLogout}
        activePathname={pathname}
      />
    );
  }

  return (
    <aside
      id='left-sidebar'
      className='fixed left-0 top-0 h-[100svh] z-[80] bg-black/60 backdrop-blur-sm text-white'
      style={{ width }}
      aria-label='왼쪽 내비게이션'
    >
      <div
        className='flex flex-col h-full'
        style={{ paddingTop, paddingLeft, paddingRight: 12 }}
      >
        {/* 로고 */}
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

        {/* 메뉴 구분선 이후에 고정: 회사/약관/뱃지 */}
        <div className='mt-6 mx-3 border-t border-white/10' />

        <div className='px-3 pt-4 pb-4 flex flex-col gap-4'>
          {/* 회사/약관 */}
          <div className='text-[13px] text-white/60 space-y-2'>
            <button
              type='button'
              aria-expanded={companyOpen}
              onClick={() => setCompanyOpen(o => !o)}
              className='w-full text-left hover:text-white transition-colors inline-flex items-center'
            >
              회사
            </button>

            <div
              className='overflow-hidden transition-[max-height,opacity] duration-300'
              style={{
                maxHeight: companyOpen ? companyPanelH : 0,
                opacity: companyOpen ? 1 : 0,
              }}
            >
              <div ref={companyPanelRef} className='pl-1 pr-2 py-2'>
                <p className='text-white/60 leading-relaxed'>
                  {COMPANY_INFO_TEXT}
                </p>
              </div>
            </div>

            <div className='hover:text-white transition-colors'>
              <Link href='/terms'>약관 및 정책</Link>
            </div>
          </div>

          {/* 프로필 뱃지 */}
          {loggedIn && (
            <button
              type='button'
              onClick={goProfile}
              aria-label='내 프로필로 이동'
              className='w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2
                         hover:bg-white/10 hover:border-white/20 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-[#5a319f]/60'
            >
              <div className='w-11 h-11 shrink-0 flex-none aspect-square overflow-hidden rounded-full border border-white/20'>
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
              <div className='min-w-0 text-left'>
                {!!me?.userGrade && (
                  <span
                    className='inline-block px-3 py-1 rounded-full text-[12px] md:text-[13px] font-semibold border'
                    style={{
                      color: BRAND,
                      backgroundColor: 'rgba(90,49,159,0.15)',
                      borderColor: 'rgba(90,49,159,0.35)',
                    }}
                  >
                    {
                      GRADE_LABEL[
                        (me!.userGrade as 'basic' | 'plus' | 'premium') ||
                          'basic'
                      ]
                    }
                  </span>
                )}
                <div className='mt-1 ml-2 text-white/90 text-[15px] leading-tight break-words line-clamp-2'>
                  {me!.displayName || me!.email}
                </div>
              </div>
            </button>
          )}

          {/* 카피라이트 */}
          <div className='text-[12px] text-white/40'>
            © {new Date().getFullYear()} Catarie
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Compact rail ─── */
function CompactRail({
  loggedIn,
  onHome,
  onUpload,
  onProfile,
  onLogin,
  onLogout,
  activePathname,
}: {
  loggedIn: boolean;
  onHome: () => void;
  onUpload: () => void;
  onProfile: () => void;
  onLogin: () => void;
  onLogout: () => void;
  activePathname: string | null;
}) {
  return (
    <aside
      id='left-sidebar'
      className='fixed left-0 top-0 h-[100svh] z-[80] bg-black/60 backdrop-blur-sm text-white'
      style={{ width: COMPACT_WIDTH }}
      aria-label='왼쪽 내비게이션(축소)'
    >
      <div className='h-full flex flex-col items-center py-4'>
        <button
          type='button'
          onClick={onHome}
          aria-label='홈으로 이동'
          title='홈'
          className='grid place-items-center w-12 h-12 rounded-xl hover:bg-white/10 transition-colors'
        >
          <img src='/images/favicon.png' alt='Catarie' className='w-9 h-9' />
        </button>

        <nav className='mt-2 flex flex-col items-center gap-2'>
          <IconOnly
            label='홈'
            src='/images/Home.png'
            active={activePathname === '/'}
            onClick={onHome}
          />
          <IconOnly
            label='업로드'
            src='/images/shinewaterdrop.png'
            onClick={onUpload}
          />
          <IconOnly
            label='프로필'
            src='/images/profile.png'
            onClick={onProfile}
          />
          {!loggedIn ? (
            <IconOnly
              label='로그인'
              src='/images/login.png'
              onClick={onLogin}
            />
          ) : (
            <IconOnly
              label='로그아웃'
              src='/images/logout.png'
              onClick={onLogout}
            />
          )}
        </nav>

        <div className='mt-auto pb-3 text-[10px] text-white/45 select-none'>
          © Catarie
        </div>
      </div>
    </aside>
  );
}

/* ─── Mobile bottom tabbar ─── */
function BottomTabBar({
  activePathname,
  onHome,
  onUpload,
  onProfile,
}: {
  activePathname: string | null;
  onHome: () => void;
  onUpload: () => void;
  onProfile: () => void;
}) {
  return (
    <nav
      id='bottom-tabbar'
      className='fixed bottom-0 inset-x-0 z-[90] bg-black/70 backdrop-blur-md border-t border-white/10'
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className='mx-auto max-w-[680px] h-14 px-10 flex items-center justify-between'>
        <Tab
          icon='/images/mobile_home.png'
          active={activePathname === '/'}
          onClick={onHome}
        />
        <Tab icon='/images/mobile_upload.png' onClick={onUpload} />
        <Tab icon='/images/mobile_profile.png' onClick={onProfile} />
      </ul>
    </nav>
  );
}

function Tab({
  icon,
  onClick,
  active,
}: {
  icon: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-1 rounded-md ${active ? 'text-white' : 'text-white/80'}`}
    >
      <img src={icon} alt='' className='w-6 h-6' />
    </button>
  );
}

/* ─── Shared items ─── */
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
        ${active ? 'bg-white/15 border-white/15' : 'hover:bg-white/10 hover:border-white/10 border-transparent'}`}
    >
      <span className='inline-flex items-center gap-3'>
        {iconSrc && (
          <img src={iconSrc} alt='' width={iconSize} height={iconSize} />
        )}
        {label}
      </span>
    </button>
  );
}

function IconOnly({
  label,
  src,
  onClick,
  active = false,
  size = COMPACT_ICON,
}: {
  label: string;
  src: string;
  onClick: () => void;
  active?: boolean;
  size?: number;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      title={label}
      className={`group relative grid place-items-center w-12 h-12 rounded-xl transition-colors
        ${active ? 'bg-white/15' : 'hover:bg-white/10'}`}
    >
      <img src={src} alt='' width={size} height={size} className='w-7 h-7' />
      <span
        className='pointer-events-none absolute left-[110%] top-1/2 -translate-y-1/2
                   opacity-0 group-hover:opacity-100 transition-opacity text-[11px]
                   px-2 py-1 rounded-md bg-white/10 border border-white/10 whitespace-nowrap'
      >
        {label}
      </span>
    </button>
  );
}
