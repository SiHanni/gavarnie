'use client';

import { useState } from 'react';

export default function Avatar({
  src,
  size = 32,
  alt = 'avatar',
}: {
  src?: string | null;
  size?: number;
  alt?: string;
}) {
  const [err, setErr] = useState(false);

  // URL이 없거나, 로드 에러면 회색 원으로 폴백
  if (!src || err) {
    return (
      <div
        aria-label='avatar-fallback'
        className='rounded-full bg-neutral-400'
        style={{ width: size, height: size }}
      />
    );
  }

  // 최단 경로: <img>를 사용하면 next.config.js 설정 없이 외부 URL 바로 표시 가능
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setErr(true)}
      className='rounded-full object-cover'
      style={{ width: size, height: size }}
      loading='lazy'
      referrerPolicy='no-referrer'
    />
  );
}
