'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  title?: string; // 기본: '컨텐츠 삭제'
  message?: string; // 기본: '정말로 이 컨텐츠를 삭제하시겠어요?'
  detail?: string; // 선택: 콘텐츠 제목 등
  confirmText?: string; // 기본: '삭제'
  cancelText?: string; // 기본: '취소'
  deleting?: boolean; // 삭제 중 로딩 상태
  onConfirm: () => void;
  onClose: () => void; // 바깥 클릭/ESC/취소
};

const BRAND = '#5a319f';

export default function DeleteConfirmModal({
  open,
  title = '컨텐츠 삭제',
  message = '정말로 이 컨텐츠를 삭제하시겠어요?',
  detail,
  confirmText = '삭제',
  cancelText = '취소',
  deleting = false,
  onConfirm,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [interactReady, setInteractReady] = useState(false); // 모바일 즉시 닫힘 방지
  const overlayDownOnSelf = useRef(false);
  const prevOverflow = useRef<string>('');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastBtnRef = useRef<HTMLButtonElement | null>(null);

  // 포털 마운트
  useEffect(() => setMounted(true), []);

  // 열릴 때 스크롤 락 + 인터랙션 지연 + 포커스
  useEffect(() => {
    if (!open) return;
    setInteractReady(false);
    overlayDownOnSelf.current = false;

    const t = window.setTimeout(() => setInteractReady(true), 320);

    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const f = window.setTimeout(() => firstBtnRef.current?.focus(), 0);

    return () => {
      clearTimeout(t);
      clearTimeout(f);
      document.body.style.overflow = prevOverflow.current || '';
    };
  }, [open]);

  // ESC 닫기 + 탭 포커스 트랩
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && interactReady && !deleting) onClose();

      if (e.key === 'Tab' && cardRef.current) {
        const focusables = cardRef.current.querySelectorAll<
          HTMLButtonElement | HTMLAnchorElement
        >('button, [href], [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;

        const first = focusables[0] as HTMLElement;
        const last = focusables[focusables.length - 1] as HTMLElement;

        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement).focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, interactReady, deleting, onClose]);

  if (!open || !mounted) return null;

  // 오버레이 클릭 닫기(다운·업이 모두 오버레이에서 일어났을 때만)
  const onOverlayPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget) overlayDownOnSelf.current = true;
  };
  const onOverlayPointerUp = (e: React.PointerEvent) => {
    if (!interactReady || deleting) return;
    if (e.target !== e.currentTarget) return;
    if (!overlayDownOnSelf.current) return;
    onClose();
  };

  const node = (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='dc-title'
      className='fixed inset-0 z-[9999]'
      style={{ overscrollBehaviorY: 'contain' }}
    >
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/70 backdrop-blur-[2px] select-none touch-none'
        onPointerDown={onOverlayPointerDown}
        onPointerUp={onOverlayPointerUp}
      />

      {/* Card (항상 화면 정중앙) */}
      <div
        ref={cardRef}
        className='absolute shadow-2xl border border-white/10 bg-neutral-950 text-white dc-pop'
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 24px))',
          maxHeight: 'min(78vh, 560px)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        onPointerDown={e => e.stopPropagation()}
        onPointerUp={e => e.stopPropagation()}
      >
        {/* 헤더 (보라 그라데이션) */}
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(90,49,159,0.32) 0%, rgba(90,49,159,0.06) 100%)',
          }}
          className='px-4 sm:px-5 py-3'
        >
          <h2
            id='dc-title'
            className='text-center font-extrabold'
            style={{ fontSize: 'clamp(17px,2.4vw,20px)' }}
          >
            {title}
          </h2>
        </div>

        {/* 본문 */}
        <div className='px-4 sm:px-5 py-4'>
          <p
            className='text-white/85'
            style={{ fontSize: 'clamp(12px,2.6vw,14px)' }}
          >
            {message}
          </p>
          {!!detail && (
            <p
              className='text-white/55 mt-1 break-words'
              style={{ fontSize: 'clamp(11px,2.4vw,12px)' }}
            >
              {detail}
            </p>
          )}

          {/* 액션 */}
          <div className='mt-4 flex items-center gap-2'>
            <button
              ref={firstBtnRef}
              type='button'
              disabled={deleting}
              onClick={() => (!deleting ? onConfirm() : null)}
              className='flex-1 font-semibold rounded-lg disabled:opacity-60'
              style={{
                padding: '10px 12px',
                backgroundColor: '#b91c1c', // danger
                fontSize: 'clamp(13px,2.6vw,15px)',
              }}
            >
              {deleting ? '삭제 중…' : confirmText}
            </button>
            <button
              ref={lastBtnRef}
              type='button'
              disabled={deleting}
              onClick={() => (interactReady ? onClose() : null)}
              className='flex-1 rounded-lg border'
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.2)',
                fontSize: 'clamp(13px,2.6vw,15px)',
              }}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>

      {/* 애니메이션 & 접근성 보조 스타일 */}
      <style jsx global>{`
        .dc-pop {
          animation: dc-pop-kf 140ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @keyframes dc-pop-kf {
          from {
            transform: translate(-50%, -50%) scale(0.97);
            opacity: 0.98;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
        @media (max-width: 360px) {
          .dc-pop {
            width: calc(100vw - 16px);
          }
        }
      `}</style>
    </div>
  );

  return createPortal(node, document.body);
}
