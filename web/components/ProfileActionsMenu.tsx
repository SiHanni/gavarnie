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

  // 외부 클릭으로 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const doLogout = () => {
    clearToken();
    clearUserProfile();
    window.dispatchEvent(new CustomEvent('auth:logout'));
    setOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth <= 540) {
      onAfterLogout?.();
    }
  };

  return (
    <div className='relative' ref={ref}>
      {/* 트리거 버튼 (살짝 더 작게) */}
      <button
        type='button'
        aria-label='더보기'
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className='grid place-items-center rounded-full hover:bg-white/10 focus:outline-none focus:ring-white/20'
        style={{
          width: 'clamp(24px, 5vw, 30px)',
          height: 'clamp(24px, 5vw, 30px)',
        }}
      >
        <Image
          src='/images/lying_down_see_more.png'
          alt=''
          width={22}
          height={22}
          style={{
            width: 'clamp(20px, 2.6vw, 45px)',
            height: 'clamp(20px, 2.6vw, 45px)',
          }}
          draggable={false}
        />
      </button>

      {/* 메뉴 — 매우 컴팩트 */}
      {open && (
        <div
          role='menu'
          className='absolute right-0 top-full z-50 mt-1 inline-block rounded-md border border-white/10 bg-black/90 backdrop-blur-md text-white shadow-md'
          style={{
            width: 'max-content',
            maxWidth: 'calc(100vw - 10px)',
            fontSize: 'clamp(7px, 2vw, 10px)', // 글자 더 작게
            paddingBlock: 'clamp(1px, 0.6vw, 3px)', // 상하 패딩 얇게
            transform: 'translateX(2px)', // 위치 미세 보정
          }}
        >
          <div className='py-0.5'>
            {canEdit && (
              <button
                type='button'
                role='menuitem'
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className='flex items-center w-full text-left hover:bg-white/10 transition-colors whitespace-nowrap rounded'
                style={{
                  paddingInline: '6px', // 좌우 패딩 축소
                  paddingBlock: '4px', // 위아래 패딩 축소
                  columnGap: '6px', // 아이콘-텍스트 간격 축소
                  minHeight: '28px', // 터치 최소치
                }}
              >
                <Image
                  src='/images/profile.png'
                  alt=''
                  width={14}
                  height={14}
                  className='shrink-0'
                  draggable={false}
                  style={{
                    width: 'clamp(12px, 2.8vw, 14px)',
                    height: 'clamp(12px, 2.8vw, 14px)',
                  }}
                />
                <span>프로필 편집</span>
              </button>
            )}

            <button
              type='button'
              role='menuitem'
              onClick={doLogout}
              className='flex items-center w-full text-left hover:bg-white/10 transition-colors whitespace-nowrap rounded'
              style={{
                paddingInline: '6px',
                paddingBlock: '4px',
                columnGap: '6px',
                minHeight: '28px',
              }}
            >
              <Image
                src='/images/logout.png'
                alt=''
                width={14}
                height={14}
                className='shrink-0'
                draggable={false}
                style={{
                  width: 'clamp(12px, 2.8vw, 14px)',
                  height: 'clamp(12px, 2.8vw, 14px)',
                }}
              />
              <span className='text-red-300'>로그아웃</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
