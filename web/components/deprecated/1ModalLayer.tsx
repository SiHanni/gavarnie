'use client';

import { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

type Props = PropsWithChildren<{
  onClose?: () => void;
  className?: string; // 모달 내용(카드) 클래스 확장
}>;

/**
 * 전역 최상단 모달 레이어:
 * - 백드롭: z-[9998], 클릭 시 닫기
 * - 내용:   z-[9999], pointer-events:auto
 */
export default function ModalLayer({
  children,
  onClose,
  className = '',
}: Props) {
  if (typeof document === 'undefined') return null;
  const root = document.body;

  return createPortal(
    <>
      <div className='fixed inset-0 z-[9998] bg-black/60' onClick={onClose} />
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto ${className}`}
        aria-modal='true'
        role='dialog'
      >
        {children}
      </div>
    </>,
    root
  );
}
