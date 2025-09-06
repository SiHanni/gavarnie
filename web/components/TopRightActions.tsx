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
import { usePathname } from 'next/navigation';

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
  const pathname = usePathname();
  if (pathname?.startsWith('/terms')) return null;
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
    </div>
  );
}
