'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { getAccessToken } from '@/lib/http';
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

type ExtraProps = {
  /** 이 픽셀보다 작아지면 컴포넌트를 숨김 (기본 1024) */
  hideBelowPx?: number;
  /** 필요 시 외부에서 클래스 추가 */
  className?: string;
};

export default function TopRightActions(
  props: Partial<typeof DEFAULTS> & ExtraProps
) {
  const pathname = usePathname();
  if (pathname?.startsWith('/terms')) return null;

  const {
    top = DEFAULTS.top,
    right = DEFAULTS.right,
    gap = DEFAULTS.gap,
    uploadColor = DEFAULTS.uploadColor,
    hideBelowPx = 1024, //  화면 폭 임계치
    className = '',
  } = props;

  const { open: openLogin } = useAuthModal();
  const { open: openUpload } = useUploadModal();

  const [mounted, setMounted] = useState(false);

  // 화면 폭에 따른 표시/숨김 제어
  const [wideEnough, setWideEnough] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia(`(min-width: ${hideBelowPx}px)`);
    // 초기 값 반영
    setWideEnough(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setWideEnough(e.matches);

    // 표준: 현대 브라우저
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    // 폴백: 구형 사파리 등
    mq.onchange = onChange;
    return () => {
      mq.onchange = null;
    };
  }, [hideBelowPx]);

  const handleUploadClick = () => {
    if (!getAccessToken()) {
      openLogin('login');
      return;
    }
    openUpload();
  };

  // 마운트 전이거나 폭이 좁으면 렌더 X (SSR 깜빡임 방지)
  if (!mounted || !wideEnough) return null;

  return (
    <div
      className={`fixed z-40 flex items-center ${className}`}
      style={{ top, right, gap }}
    >
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
