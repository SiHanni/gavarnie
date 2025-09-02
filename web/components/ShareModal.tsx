'use client';

import { useEffect, useRef, useState } from 'react';
import { useShareModal } from '@/contexts/ShareModalContext';

export default function ShareModal() {
  const { isOpen, payload, close } = useShareModal();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isOpen]);

  if (!isOpen || !payload) return null;

  const url = payload.url;

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-[70] grid place-items-center'
    >
      <div className='absolute inset-0 bg-black/70' onClick={close} />
      <div className='relative w-[min(560px,92vw)] rounded-2xl bg-neutral-950 text-white border border-white/10 p-6'>
        <button
          onClick={close}
          className='absolute right-3 top-2 text-2xl text-white/70 hover:text-white'
          aria-label='닫기'
        >
          ×
        </button>
        <h2 className='text-xl font-bold'>공유하기</h2>
        <p className='text-sm text-white/60 mt-1'>{payload.title || '링크'}</p>

        <div className='mt-4 flex items-center gap-2'>
          <input
            ref={inputRef}
            readOnly
            value={url}
            className='flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/15 focus:outline-none'
          />
          <button
            onClick={doCopy}
            className='px-3 py-2 rounded-lg bg-white text-black font-semibold hover:opacity-90'
          >
            {copied ? '복사됨' : '복사'}
          </button>
        </div>

        {/* 나중에 SNS 버튼들(카톡/트위터 등) 섹션 확장 가능 */}
        <div className='mt-4 text-xs text-white/50'>
          URL 복사 후 원하는 곳에 붙여넣기 하세요.
        </div>
      </div>
    </div>
  );
}
