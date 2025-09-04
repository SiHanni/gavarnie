'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useUploadModal } from '@/contexts/UploadModalContext';

const DEFAULTS = {
  top: 20,
  right: 25,
  gap: 40,
  avatarSize: 45,
  loginBtnPaddingX: 16,
  loginBtnHeight: 36,
  uploadColor: '#59319f',
  loginColor: '#59319f',
};

export default function TopRightActions(props: Partial<typeof DEFAULTS>) {
  const {
    top = DEFAULTS.top,
    right = DEFAULTS.right,
    gap = DEFAULTS.gap,
    avatarSize = DEFAULTS.avatarSize,
    loginBtnHeight = DEFAULTS.loginBtnHeight,
    loginBtnPaddingX = DEFAULTS.loginBtnPaddingX,
    uploadColor = DEFAULTS.uploadColor,
    loginColor = DEFAULTS.loginColor,
  } = props;

  // 이름만 명확히: 로그인 모달 오픈
  const { open: openLogin } = useAuthModal();
  // 업로드 모달 오픈
  const { open: openUpload } = useUploadModal();

  // ✅ Hydration/깜빡임 방지: 마운트 전엔 렌더 X
  const [mounted, setMounted] = useState(false);

  const [hasToken, setHasToken] = useState<boolean>(
    typeof window !== 'undefined' ? hasStoredToken() : false
  );
  const [user, setUser] = useState<UserProfile | null>(
    typeof window !== 'undefined' ? loadUserProfile() : null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);

    // 토큰 있고 프로필(또는 avatarUrl) 없으면 1회 최신화
    if (hasToken && (!user || !user.avatarUrl)) {
      fetchProfile()
        .then(p => {
          saveUserProfile(p);
          setUser(p);
        })
        .catch(() => {
          /* 실패시 캐시 유지 */
        });
    }

    // 로그인/로그아웃 이벤트로 즉시 반영
    const onLogin = (e: Event) => {
      const p = (e as CustomEvent).detail as UserProfile | undefined;
      if (p) saveUserProfile(p);
      setUser(p || loadUserProfile());
      setHasToken(true);
    };
    const onLogout = () => {
      setUser(null);
      setHasToken(false);
    };

    window.addEventListener('auth:login', onLogin as EventListener);
    window.addEventListener('auth:logout', onLogout as EventListener);
    return () => {
      window.removeEventListener('auth:login', onLogin as EventListener);
      window.removeEventListener('auth:logout', onLogout as EventListener);
    };
  }, []);

  const doLogout = () => {
    clearToken();
    clearUserProfile();
    setUser(null);
    setHasToken(false);
    window.dispatchEvent(new CustomEvent('auth:logout'));
  };

  const loggedIn = hasToken && !!getAccessToken() && !!user;

  // 업로드 버튼 클릭: 토큰 없으면 로그인 모달, 있으면 업로드 모달
  const handleUploadClick = () => {
    if (!getAccessToken()) {
      openLogin('login');
      return;
    }
    openUpload();
  };

  // 마운트 전엔 렌더 안 함 → 서버/클라이언트 UI 불일치 방지
  if (!mounted) return null;

  return (
    <div className='fixed z-40 flex items-center' style={{ top, right, gap }}>
      {/* + 업로드 */}
      <button
        type='button'
        className='rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20'
        style={{ backgroundColor: uploadColor, height: 36, paddingInline: 12 }}
        onClick={handleUploadClick}
      >
        + 업로드
      </button>

      {!loggedIn ? (
        hasToken ? (
          <div
            className='rounded-full bg-white/10 border border-white/20 animate-pulse'
            style={{ width: avatarSize, height: avatarSize }}
            aria-label='프로필 로딩 중'
          />
        ) : (
          <button
            type='button'
            onClick={() => openLogin('login')}
            className='rounded-full font-semibold text-white hover:opacity-90'
            style={{
              backgroundColor: loginColor,
              height: loginBtnHeight,
              paddingInline: loginBtnPaddingX,
            }}
          >
            로그인
          </button>
        )
      ) : (
        <div
          className='relative'
          onMouseEnter={() => {
            // hover 시작 → 즉시 열기
            setMenuOpen(true);
            if (closeTimer.current) {
              clearTimeout(closeTimer.current);
              closeTimer.current = null;
            }
          }}
          onMouseLeave={() => {
            // hover 종료 → 약간의 딜레이 후 닫기(갭에서 꺼지는 현상 방지)
            if (closeTimer.current) clearTimeout(closeTimer.current);
            closeTimer.current = window.setTimeout(
              () => setMenuOpen(false),
              120
            );
          }}
        >
          <button
            type='button'
            className='rounded-full overflow-hidden border border-white/20 shadow-sm'
            style={{ width: avatarSize, height: avatarSize }}
            title={user!.displayName}
            onClick={() => setMenuOpen(v => !v)} // 모바일/클릭 토글
          >
            {user!.avatarUrl ? (
              <img
                src={user!.avatarUrl}
                alt='avatar'
                width={avatarSize}
                height={avatarSize}
                className='w-full h-full object-cover'
                referrerPolicy='no-referrer'
              />
            ) : (
              <div className='w-full h-full grid place-items-center bg-white/10'>
                <span className='text-sm'>
                  {(user!.displayName || user!.email || 'U').slice(0, 1)}
                </span>
              </div>
            )}
          </button>

          {/* 드롭다운 */}
          <div
            className={`absolute right-0 top-full mt-2 ${menuOpen ? 'block' : 'hidden'} z-50`}
            onMouseEnter={() => {
              setMenuOpen(true);
              if (closeTimer.current) {
                clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
            }}
            onMouseLeave={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
              closeTimer.current = window.setTimeout(
                () => setMenuOpen(false),
                120
              );
            }}
          ></div>
        </div>
      )}
    </div>
  );
}
