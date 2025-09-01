'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { attachHlsTo } from '@/lib/hls';

type Props = {
  src: string;
  muted?: boolean;
  fit?: 'contain' | 'cover';
};

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(function VideoPlayer(
  { src, muted = true, fit = 'contain' },
  refFromParent
) {
  const elRef = useRef<HTMLVideoElement>(null);

  // 부모 ref 연결
  useEffect(() => {
    if (!refFromParent) return;
    if (typeof refFromParent === 'function') refFromParent(elRef.current);
    else (refFromParent as any).current = elRef.current;
  }, [refFromParent]);

  // HLS 붙이기
  useEffect(() => {
    const v = elRef.current;
    if (!v) return;
    attachHlsTo(v, src);
  }, [src]);

  // ✅ 동적 클래스 대신 고정 클래스 사용
  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <video
      ref={elRef}
      className={`w-full h-full max-h-full ${fitClass} bg-transparent`} // ← 투명
      crossOrigin='anonymous'
      muted={muted}
      loop
      playsInline
      controls={false}
      preload='metadata'
    />
  );
});

export default VideoPlayer;
