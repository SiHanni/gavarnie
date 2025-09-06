// lib/url.ts
import { ENV } from '@/lib/env';

/**
 * ENV.HLS(NEXT_PUBLIC_HLS_BASE_URL)를 결합합니다.
 * - base/key의 중복/결여 슬래시를 정리합니다.
 * - HLS 베이스가 비어있어도 동작하도록 안전 폴백 처리.
 */
export function joinHls(hlsKey: string) {
  const base = (ENV.HLS || '').replace(/\/+$/, '');
  const key = String(hlsKey ?? '').replace(/^\/+/, '');
  return base ? `${base}/${key}` : `/${key}`;
}

/**
 * - S3/MinIO 오브젝트 키(썸네일 등)를 절대 URL로 변환
 * - 우선순위: CDN(ENV.CDN) → HLS(ENV.HLS) → 루트(/)
 * - v가 주어지면 ?v=... 쿼리로 캐시 무효화 가능
 */
export function joinMediaObject(key?: string | null, v?: number) {
  if (!key) return '';
  const base = (ENV.CDN || ENV.HLS || '').replace(/\/+$/, '');
  const k = String(key).replace(/^\/+/, '');
  const url = base ? `${base}/${k}` : `/${k}`;
  return v ? `${url}?v=${encodeURIComponent(String(v))}` : url;
}

/**
 * - 썸네일 srcset 문자열 생성
 * - 규칙: poster_540.webp 기준으로 360/540/720 변형을 치환하여 구성
 * - 예) thumbs/{id}/poster_540.webp → 360/540/720
 */
export function buildThumbSrcSet(key?: string | null, v?: number) {
  if (!key) return undefined;
  const k360 = key.replace('_540.', '_360.');
  const k540 = key;
  const k720 = key.replace('_540.', '_720.');
  return [
    `${joinMediaObject(k360, v)} 360w`,
    `${joinMediaObject(k540, v)} 540w`,
    `${joinMediaObject(k720, v)} 720w`,
  ].join(', ');
}
