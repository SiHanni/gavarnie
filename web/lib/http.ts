import axios, { type AxiosRequestConfig } from 'axios';
import { ENV } from './env';
import { UserGrade } from './user';

/** 공개 프로필 */
export type PublicUser = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  userGrade?: UserGrade | null;
  statusMessage?: string | null;
  handle?: string | null;
};

/** presign (서버마다 키 다를 수 있음) */
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

/** 내 프로필 */
export type ProfileResponse = {
  id: string;
  email: string;
  displayName: string;
  statusMessage: string | null;
  avatarUrl: string | null;
  handle?: string | null;
};

/** 유저 미디어 */
export type UserMediaNode = {
  id: string; // media UUID
  hlsKey: string;
  originalFilename: string;
  title: string;
  contentType: string;
  size: number | null;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    handle: string; // 서버가 내려줘야 함
  };
  likeCount: number;
  commentCount: number;
};
export type UserMediaResponse = {
  nodes: UserMediaNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export type FollowCounts = {
  followerCount: number;
  followingCount: number;
};

// ===== Axios =====
export const http = axios.create({
  baseURL: ENV.API, // 예: 'http://localhost:3000'
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ===== 토큰 =====
const KEY = 'accessToken';
let accessToken: string | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

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
if (typeof window !== 'undefined') {
  const t = localStorage.getItem(KEY);
  if (t) setAccessToken(t);
}

http.interceptors.request.use(cfg => {
  if (accessToken) {
    cfg.headers = cfg.headers ?? {};
    (cfg.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  return cfg;
});
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

// data 헬퍼
export async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config);
  return res.data as T;
}

// ===== Auth =====
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

/** presign */
export async function presignUpload(
  originalFilename: string,
  contentType?: string,
  title?: string,
  fileSize?: number
) {
  return request<Presign>({
    url: '/uploads/presign',
    method: 'POST',
    data: { originalFilename, contentType, title },
    headers: fileSize != null ? { 'x-file-size': String(fileSize) } : undefined,
  });
}

/** 업로드 완료 */
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

// 토큰 존재 확인
export function hasStoredToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(KEY);
}

/** 내 프로필 */
export async function fetchProfile(): Promise<ProfileResponse> {
  try {
    return await request<ProfileResponse>({
      url: '/users/profile',
      method: 'GET',
    });
  } catch {
    return request<ProfileResponse>({ url: '/auth/profile', method: 'GET' });
  }
}

/* ===== handle 유틸 (@ 제거) ===== */
const stripAt = (v: string) => (v.startsWith('@') ? v.slice(1) : v);

/** 공개 프로필 (by handle) */
export async function fetchPublicUser(handle: string) {
  const h = encodeURIComponent(stripAt(handle));
  return request<PublicUser>({ url: `/users/handle/${h}`, method: 'GET' });
}

/** 유저 공개 미디어 (by handle) */
export async function fetchUserMedia(
  handle: string,
  limit = 20,
  cursor?: string
) {
  const h = encodeURIComponent(stripAt(handle));
  return request<UserMediaResponse>({
    url: `/users/handle/${h}/media`,
    method: 'GET',
    params: { limit, cursor },
  });
}

/** 내 프로필 수정 */
export async function updateMyProfile(dto: {
  displayName?: string;
  avatarUrl?: string | null;
  statusMessage?: string | null;
}) {
  return request<ProfileResponse>({
    url: '/users/me',
    method: 'PATCH',
    data: dto,
  });
}

// ========= Media Reactions =========
export async function mediaLike(mediaUuid: string) {
  return request<{ liked: boolean; alreadyExisted?: boolean }>({
    url: `/media/${mediaUuid}/like`,
    method: 'POST',
  });
}
export async function mediaUnlike(mediaUuid: string) {
  return request<{ liked: boolean; alreadyExisted?: boolean }>({
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

// ========= Follow (모두 handle 기준) =========
export async function followUser(targetHandle: string) {
  const h = encodeURIComponent(stripAt(targetHandle));
  return request<{ following: boolean }>({
    url: `/users/handle/${h}/follow`,
    method: 'POST',
  });
}
export async function unfollowUser(targetHandle: string) {
  const h = encodeURIComponent(stripAt(targetHandle));
  return request<{ following: boolean }>({
    url: `/users/handle/${h}/follow`,
    method: 'DELETE',
  });
}
export async function getFollowCounts(handle: string) {
  const h = encodeURIComponent(stripAt(handle));
  return request<FollowCounts>({
    url: `/users/handle/${h}/follow/counts`,
    method: 'GET',
  });
}
export async function getFollowStatus(handle: string) {
  const h = encodeURIComponent(stripAt(handle));
  return request<{ following: boolean }>({
    url: `/users/handle/${h}/follow/status`,
    method: 'GET',
  });
}

// ========= My Media (soft delete) =========
export async function deleteMyMedia(mediaUuid: string) {
  return request<{ ok: true; deleted: boolean; id: string }>({
    url: `/media/private/${mediaUuid}`,
    method: 'DELETE',
  });
}

// --- 아바타 업로드 Presign ---
export async function avatarsPresign(input: {
  contentType?: string;
  fileSize?: number;
  originalFilename?: string;
}) {
  return request<{
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
    key: string;
    expiresIn: number;
    publicUrl: string | null;
  }>({
    url: '/avatars/presign',
    method: 'POST',
    data: input,
  });
}

// --- 아바타 업로드 완료 ---
export async function avatarsComplete(key: string) {
  return request<{ ok: true; avatarUrl: string; variants?: string[] }>({
    url: '/avatars/complete',
    method: 'POST',
    data: { key },
  });
}
