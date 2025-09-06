'use client';

import { useEffect, useRef, useState } from 'react';

export default function ProfileActionsMenu({
  canEdit = false, // 부모에서 "내 프로필"일 때만 true
  onEdit,
}: {
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  // canEdit=false면 훅 호출 전에 바로 렌더 중단(로그인X/내 프로필 아님)
  if (!canEdit) return null;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        aria-label='더보기'
        aria-haspopup='menu'
        aria-expanded={open}
        className='w-9 h-9 grid place-items-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30'
        onClick={() => setOpen(v => !v)}
      >
        <span className='text-xl leading-none'>⋯</span>
      </button>

      {open && (
        <div
          role='menu'
          className='absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-neutral-950 shadow-2xl p-1 z-[100]'
        >
          <button
            role='menuitem'
            type='button'
            className='w-full text-left px-3 py-2 rounded-lg hover:bg-white/10'
            onClick={() => {
              setOpen(false);
              onEdit?.();
            }}
          >
            프로필 편집
          </button>
        </div>
      )}
    </div>
  );
}
