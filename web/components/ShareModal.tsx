'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useShareModal } from '@/contexts/ShareModalContext';

const ACCENT = '#5a319f';

export default function ShareModal() {
  const { isOpen, payload, close } = useShareModal();
  const [copied, setCopied] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false); // ≤360px
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 아주 좁은 화면 감지 (270~320폭 대응)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 360px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      const t = setTimeout(() => inputRef.current?.select(), 0);
      return () => clearTimeout(t);
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
      try {
        inputRef.current?.select();
        // @ts-ignore
        const ok = document.execCommand?.('copy');
        setCopied(!!ok);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopied(false);
      }
    }
  };

  const onOverlayClick = () => close();
  const onCardClick: React.MouseEventHandler<HTMLDivElement> = e =>
    e.stopPropagation();

  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='share-modal-title'
      className='fixed inset-0 z-[9999] grid place-items-center'
    >
      {/* 오버레이 */}
      <div
        className='fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm'
        onClick={onOverlayClick}
        aria-hidden
      />

      {/* 카드 */}
      <div
        className='relative z-[9999] overflow-hidden border border-white/10 bg-neutral-950 text-white shadow-2xl'
        onClick={onCardClick}
        style={{
          width: 'clamp(220px, 88vw, 560px)', // 더 작게
          maxHeight: '92vh',
          borderRadius: 'clamp(12px, 3.5vw, 18px)',
        }}
      >
        {/* 헤더: 구분선 제거 */}
        <div
          className='relative'
          style={{
            paddingInline: 'clamp(12px, 4.5vw, 24px)',
            paddingBlock: 'clamp(8px, 3.2vw, 18px)',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
            background:
              'linear-gradient(180deg, rgba(90,49,159,0.28) 0%, rgba(90,49,159,0.06) 100%)',
          }}
        >
          <h2
            id='share-modal-title'
            className='text-center font-extrabold'
            style={{ fontSize: 'clamp(16px, 5vw, 22px)' }}
          >
            공유하기
          </h2>

          <button
            type='button'
            onClick={close}
            className='absolute text-white/75 hover:text-white transition-colors'
            aria-label='닫기'
            style={{
              right: 'clamp(6px, 2.6vw, 12px)',
              top: 'clamp(4px, 2.2vw, 10px)',
              fontSize: 'clamp(16px, 6vw, 22px)',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div
          style={{
            paddingInline: 'clamp(12px, 4.5vw, 24px)',
            paddingBlock: 'clamp(10px, 4.2vw, 22px)',
          }}
        >
          <p
            className='text-white/60'
            style={{ fontSize: 'clamp(11px, 3.4vw, 14px)' }}
          >
            {payload.title || '링크'}
          </p>

          <div
            className='mt-3 flex items-center gap-2'
            style={{
              marginTop: 'clamp(8px, 3.4vw, 14px)',
              flexWrap: 'wrap', // 좁을 때 줄바꿈 허용
            }}
          >
            <input
              ref={inputRef}
              readOnly
              value={url}
              className='rounded-xl bg-white/5 border border-white/15 focus:outline-none'
              style={{
                flex: isNarrow ? '1 0 100%' : '1 1 auto',
                minWidth: 0, // 넘침 방지
                paddingInline: 'clamp(8px, 3.6vw, 12px)',
                paddingBlock: 'clamp(6px, 2.6vw, 10px)',
                fontSize: 'clamp(12px, 3.6vw, 15px)',
              }}
            />
            <button
              onClick={doCopy}
              className='font-semibold'
              style={{
                flex: isNarrow ? '1 0 100%' : '0 0 auto',
                marginTop: isNarrow ? '6px' : 0,
                paddingInline: 'clamp(10px, 4vw, 16px)',
                paddingBlock: 'clamp(8px, 2.6vw, 10px)',
                borderRadius: '12px',
                backgroundColor: ACCENT,
                fontSize: 'clamp(12px, 3.6vw, 15px)',
                minWidth: isNarrow ? 'auto' : 'clamp(60px, 18vw, 96px)', // 더 작은 최소폭
                textAlign: 'center',
              }}
            >
              {copied ? '복사됨' : '복사'}
            </button>
          </div>

          <div
            className='text-white/55'
            style={{
              fontSize: 'clamp(10px, 3.2vw, 12px)',
              marginTop: 'clamp(8px, 3.2vw, 12px)',
            }}
          >
            URL을 복사해 친구에게 공유하세요!
          </div>
        </div>
      </div>
    </div>
  );
}
