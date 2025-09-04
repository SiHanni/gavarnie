import axios, { type AxiosRequestConfig } from 'axios';
import { ENV } from './env';

// Axios 인스턴스
export const http = axios.create({
  baseURL: ENV.API,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false, // 헤더 토큰 방식
});

// 토큰 보관/복구
const KEY = 'accessToken';
let accessToken: string | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

/** 새로 고침을 했을 때 localStorage에서 토큰을 가져오는 함수 */
export function initAuthFromStorage() {
  if (typeof window === 'undefined') return;
  const t = localStorage.getItem(KEY);
  if (t) setAccessToken(t);
}

export function storeToken(t: string) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, t);
  setAccessToken(t);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  setAccessToken(null);
}

// 모듈이 로드되는 순간에 동기 복구 (가장 중요)
if (typeof window !== 'undefined') {
  const t = localStorage.getItem(KEY);
  if (t) setAccessToken(t);
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
      // 토큰이 진짜 만료/무효일 때만 로그아웃 처리
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

/** 영상 원본 업로드를 위한 presing URL 발급 요청 API */
export async function presignUpload(
  originalFilename: string,
  contentType?: string,
  title?: string
) {
  return request<Presign>({
    url: '/uploads/presign',
    method: 'POST',
    data: { originalFilename, contentType, title },
  });
}

/**
 * 영상 원본 업로드 후 호출
 * - size는 보내지 않아도 서버에서 처리하긴함
 * */
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

// 1) 토큰 존재 여부(초기 렌더에서 깜빡임 방지용)
export function hasStoredToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(KEY);
}

// 2) 프로필 조회 API (/auth/profile)
export type ProfileResponse = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function fetchProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>({ url: '/auth/profile', method: 'GET' });
}

// ========= Media Reactions =========
export async function mediaLike(mediaUuid: string) {
  return request<{ liked: boolean; alreadyExisted: boolean }>({
    url: `/media/${mediaUuid}/like`,
    method: 'POST',
  });
}

export async function mediaUnlike(mediaUuid: string) {
  return request<{ liked: boolean; alreadyExisted: boolean }>({
    url: `/media/${mediaUuid}/like`,
    method: 'DELETE',
  });
}

export async function mediaLikeCount(mediaUuid: string) {
  return request<{ count: number }>({
    url: `/media/${mediaUuid}/likes/count`,
    method: 'GET',
  });
}
