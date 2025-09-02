// web/components/TopLeftBrand.tsx
'use client';

import Link from 'next/link';
import { CSSProperties } from 'react';

type Props = {
  /** 왼쪽 여백(px) */
  left?: number;
  /** 위쪽 여백(px) */
  top?: number;
  /** 아이콘 한 변 길이(px) */
  size?: number;
};

const DEFAULTS = { left: 16, top: 12, size: 24 } as const;

/**
 * 좌측 상단 배너 아이콘.
 * - public/images/catarie_icon_black.png 사용
 * - 위치/크기 숫자만 바꾸면 즉시 반영
 */
export default function TopLeftBrand({
  left = DEFAULTS.left,
  top = DEFAULTS.top,
  size = DEFAULTS.size,
}: Props) {
  const style: CSSProperties = {
    position: 'fixed',
    left,
    top,
    zIndex: 50,
    width: size,
    height: size,
  };

  return (
    <div style={style}>
      <Link href='/' aria-label='홈으로 이동'>
        <img
          src='/images/catarie_icon_black.png'
          alt='Catarie'
          width={size}
          height={size}
          className='w-full h-full object-contain hover:opacity-90 transition-opacity'
          draggable={false}
        />
      </Link>
    </div>
  );
}
