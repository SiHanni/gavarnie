// HLS를 HTMLMediaElement(비디오/오디오 공용)에 붙여주는 헬퍼
export async function attachHlsTo(media: HTMLMediaElement, src: string) {
  // 사파리 등 네이티브 HLS 가능 브라우저
  if ((media as any).canPlayType?.('application/vnd.apple.mpegurl')) {
    media.src = src;
    return;
  }
  const Hls = (await import('hls.js')).default;
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(src);
    hls.attachMedia(media);
  } else {
    media.src = src; // 폴백 시도
  }
}
