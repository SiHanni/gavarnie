import { setAccessToken } from './api';

const KEY = 'accessToken';

export function getStoredToken(): string | null {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, token);
  setAccessToken(token);
}

export function clearStoredToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  setAccessToken(null);
}

// 앱 시작 시 로컬 토큰을 axios에 주입
export function initAuthFromStorage() {
  const t = getStoredToken();
  if (t) setAccessToken(t);
}
