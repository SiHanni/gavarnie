import { ENV } from '@/lib/env';

// 서버가 주는 hlsKey (hls/media_uuid/index.m3u8)와 HLS Base URL 을 결합
export function joinHls(hlsKey: string) {
  const base = ENV.HLS.replace(/\/+$/, '');
  const key = hlsKey.replace(/^\/+/, '');
  return `${base}/${key}`;
}
