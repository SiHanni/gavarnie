import axios, { type AxiosRequestConfig } from 'axios';
import { ENV } from './env';

// Axios 인스턴스
export const http = axios.create({
  baseURL: ENV.API,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // 헤더 토큰 방식
});

// 토큰 보관/복구
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

const KEY = 'accessToken';
export function initAuthFromStorage() {
  if (typeof window === 'undefined') return;
  const t = localStorage.getItem(KEY);
  if (t) setAccessToken(t);
}
export function storeToken(t: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, t);
  setAccessToken(t);
}
export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  setAccessToken(null);
}

// 요청: 토큰 주입
http.interceptors.request.use(cfg => {
  if (accessToken) {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  return cfg;
});

// 응답: 401 → 로그인 모달 오픈 이벤트
http.interceptors.response.use(
  r => r,
  err => {
    const status = err?.response?.status;
    if (typeof window !== 'undefined' && status === 401) {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:required'));
    }
    return Promise.reject(err);
  }
);

// data 만 반환하는 헬퍼
export async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config);
  return res.data as T;
}

// ===== API 래핑 (로그인/회원가입/업로드) =====
export async function login(email: string, password: string) {
  return request<{ accessToken: string }>({
    url: '/auth/login',
    method: 'POST',
    data: { email, password },
  });
}
export async function signUp(
  email: string,
  password: string,
  displayName: string
) {
  return request<{ accessToken: string }>({
    url: '/auth/signUp',
    method: 'POST',
    data: { email, password, displayName },
  });
}

// presign 응답은 서버 구현에 따라 이름이 조금 다를 수 있어 유연 처리
export type Presign =
  | {
      url: string;
      headers?: Record<string, string>;
      key: string;
      mediaId: string;
    }
  | {
      uploadUrl: string;
      headers?: Record<string, string>;
      key: string;
      mediaId: string;
    };

export async function presignUpload(
  originalFilename: string,
  contentType?: string,
  kind?: 'video' | 'audio'
) {
  return request<Presign>({
    url: '/uploads/presign',
    method: 'POST',
    data: { originalFilename, contentType, kind },
  });
}

export async function completeUpload(
  mediaId: string,
  key: string,
  size?: number
) {
  return request<{ ok: true }>({
    url: '/uploads/complete',
    method: 'POST',
    data: { mediaId, key, size },
  });
}

export async function getMediaStatus(id: string) {
  return request<{
    status: 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  }>({
    url: `/uploads/media/${id}/status`,
    method: 'GET',
  });
}
