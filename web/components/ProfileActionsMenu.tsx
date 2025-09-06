'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { clearToken } from '@/lib/http';
import { clearUserProfile } from '@/lib/user';

export default function ProfileActionsMenu({
  canEdit,
  onEdit,
  onAfterLogout,
}: {
  canEdit: boolean;
  onEdit: () => void;
  onAfterLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const doLogout = () => {
    clearToken();
    clearUserProfile();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    setOpen(false);
    // 모바일(≤540px)은 홈으로 이동 콜백
    if (typeof window !== 'undefined' && window.innerWidth <= 540) {
      onAfterLogout?.();
    }
  };

  return (
    <div className='relative' ref={ref}>
      {/* see_more 트리거 버튼 (컴팩트) */}
      <button
        type='button'
        aria-label='더보기'
        onClick={() => setOpen(v => !v)}
        className='grid place-items-center rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20'
        style={{
          width: 'clamp(28px, 6vw, 34px)',
          height: 'clamp(28px, 6vw, 34px)',
        }}
      >
        <Image
          src='/images/see_more.png'
          alt=''
          width={16}
          height={16}
          style={{
            width: 'clamp(12px, 3vw, 16px)',
            height: 'clamp(12px, 3vw, 16px)',
          }}
        />
      </button>

      {/* 메뉴 (폭을 내용 길이에 맞춰 컴팩트하게) */}
      {open && (
        <div
          className='absolute right-0 z-50 mt-1 inline-block rounded-lg border border-white/10 bg-black/90 backdrop-blur-md text-white shadow-xl'
          style={{
            width: 'max-content', // 글자만큼만
            maxWidth: 'calc(100vw - 24px)', // 화면 밖 방지
            fontSize: 'clamp(11px, 3vw, 13px)', // 모바일 축소
            paddingBlock: 'clamp(3px, 0.8vw, 5px)',
            transform: 'translateX(clamp(15px, 5vw, 13px))',
          }}
        >
          {canEdit && (
            <button
              type='button'
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className='block w-full text-left hover:bg-white/10 transition-colors whitespace-nowrap'
              style={{
                paddingInline: 'clamp(8px, 2.4vw, 10px)',
                paddingBlock: 'clamp(6px, 2vw, 8px)',
              }}
            >
              프로필 편집
            </button>
          )}

          <button
            type='button'
            onClick={doLogout}
            className='block w-full text-left hover:bg-white/10 text-red-300 transition-colors whitespace-nowrap'
            style={{
              paddingInline: 'clamp(8px, 2.4vw, 10px)',
              paddingBlock: 'clamp(6px, 2vw, 8px)',
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
