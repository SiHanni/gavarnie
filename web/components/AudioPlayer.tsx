'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { attachHlsTo } from '@/lib/hls';

type Props = { src: string };

const AudioPlayer = forwardRef<HTMLAudioElement, Props>(function AudioPlayer(
  { src },
  refFromParent
) {
  const elRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!refFromParent) return;
    if (typeof refFromParent === 'function') refFromParent(elRef.current);
    else (refFromParent as any).current = elRef.current;
  }, [refFromParent]);

  useEffect(() => {
    const a = elRef.current;
    if (!a) return;
    attachHlsTo(a, src);
  }, [src]);

  return (
    <audio
      ref={elRef}
      className='hidden'
      crossOrigin='anonymous'
      controls={false}
      playsInline
      preload='auto'
    />
  );
});

export default AudioPlayer;
