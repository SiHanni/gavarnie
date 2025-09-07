'use client';

import { useState } from 'react';

export default function MediaMoreMenu({
  onDeleteClick,
}: {
  onDeleteClick: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className='absolute top-2 right-2 z-20'>
      {/* trigger */}
      <button
        type='button'
        aria-label='더보기'
        onClick={() => setOpen(true)}
        className='w-8 h-8 grid place-items-center rounded-full bg-black/50 hover:bg-black/70'
      >
        <span className='text-white text-xl leading-none'>⋮</span>
      </button>

      {/* bottom sheet */}
      {open && (
        <div
          className='fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end'
          onClick={() => setOpen(false)}
        >
          <div
            className='w-full bg-neutral-950 border-t border-white/10 rounded-t-2xl overflow-hidden'
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '50vh' }}
          >
            <button
              type='button'
              onClick={() => {
                setOpen(false);
                onDeleteClick();
              }}
              className='block w-full py-4 text-red-400 font-semibold text-center hover:bg-white/5'
            >
              컨텐츠 삭제
            </button>
            <button
              type='button'
              onClick={() => setOpen(false)}
              className='block w-full py-4 text-white/80 font-medium text-center hover:bg-white/5'
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
