'use client';

import { forwardRef, useEffect, useRef } from 'react';
import Hls from 'hls.js';

type Props = React.AudioHTMLAttributes<HTMLAudioElement> & {
  src: string;
};

const AudioPlayer = forwardRef<HTMLAudioElement, Props>(function AudioPlayer(
  { src, ...rest },
  ref
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 외부 ref 연결
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === 'function') ref(audioRef.current);
    else
      (ref as React.MutableRefObject<HTMLAudioElement | null>).current =
        audioRef.current;
  }, [ref]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    let hls: Hls | null = null;

    // Safari(네이티브 HLS)면 그냥 src 설정
    const canNativeHls = el.canPlayType('application/vnd.apple.mpegURL') !== '';
    if (canNativeHls) {
      el.src = src;
      el.load();
      return () => {
        el.removeAttribute('src');
        el.load();
      };
    }

    // Chrome/Edge 등 → hls.js
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(el);
    } else {
      // 아주 구형 브라우저 대응 불가
      el.src = src; // 시도만
      el.load();
    }

    return () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      el.removeAttribute('src');
      el.load();
    };
  }, [src]);

  //return <audio ref={audioRef} {...rest} playsInline />;      // 음원 재생 끝나고 반복재생 x
  return <audio ref={audioRef} {...rest} playsInline loop />; // 반복 재생 o
});

export default AudioPlayer;
