'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { attachHlsTo } from '@/lib/hls';

type Props = {
  src: string;
  muted?: boolean;
  fit?: 'contain' | 'cover';
  onToggle?: () => void; // 비디오 탭/클릭 시 실행
};

const VideoPlayer = forwardRef<HTMLVideoElement, Props>(function VideoPlayer(
  { src, muted = true, fit = 'contain', onToggle },
  refFromParent
) {
  const elRef = useRef<HTMLVideoElement>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);

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

  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <video
      ref={elRef}
      className={`w-full h-full max-h-full ${fitClass} bg-transparent`}
      crossOrigin='anonymous'
      muted={muted}
      loop
      playsInline
      controls={false}
      preload='metadata'
      style={{ touchAction: 'manipulation' }}
      draggable={false}
      tabIndex={-1}
      onPointerDown={e => {
        down.current = { x: e.clientX, y: e.clientY, t: Date.now() };
      }}
      onPointerUp={e => {
        e.stopPropagation();
        const d = down.current;
        down.current = null;
        if (!d) {
          onToggle?.();
          return;
        }
        const dt = Date.now() - d.t;
        const dx = Math.abs(e.clientX - d.x);
        const dy = Math.abs(e.clientY - d.y);
        // 작은 탭만 토글 (스크롤/드래그 오탭 방지)
        if (dt < 300 && dx < 8 && dy < 8) onToggle?.();
      }}
      onPointerCancel={() => {
        down.current = null;
      }}
    />
  );
});

export default VideoPlayer;
