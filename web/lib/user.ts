export type UserGrade = 'basic' | 'plus' | 'premium';

export type UserProfile = {
  id?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string | null;
  userGrade?: UserGrade | null;
  handle?: string;
};

const KEY = 'userProfile';

/** 등급을 문자열 enum으로 안전 변환 */
export function coerceUserGrade(g: unknown): UserGrade {
  if (g === 'basic' || g === 'plus' || g === 'premium') return g;
  if (typeof g === 'string') {
    const s = g.trim().toLowerCase();
    if (s === 'basic') return 'basic';
    if (s === 'plus') return 'plus';
    if (s === 'premium') return 'premium';
  }
  return 'basic';
}

/** base64url 패딩 보정 포함 */
function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const base = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base.length % 4 ? '='.repeat(4 - (base.length % 4)) : '';
    const json = atob(base + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function setUserFromToken(token: string): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const p = decodeJwtPayload(token) || {};
  const profile: UserProfile = {
    id: p.userId || p.sub,
    email: p.email,
    displayName: p.displayName || p.name || 'User',
    avatarUrl: p.avatarUrl ?? null,
    userGrade: coerceUserGrade(p.userGrade),
    handle: p.handle ?? undefined, // ← 토큰에 있으면 저장
  };
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

/** 병합 저장: 서버 응답에 userGrade/handle이 빠져도 기존 값을 보존 */
export function saveUserProfile(p: UserProfile) {
  if (typeof window === 'undefined') return;
  const prev = loadUserProfile();
  const merged: UserProfile = {
    ...prev,
    ...p,
    userGrade: coerceUserGrade(p.userGrade ?? prev?.userGrade ?? 'basic'),
    handle: p.handle ?? prev?.handle ?? undefined,
  };
  localStorage.setItem(KEY, JSON.stringify(merged));
}

export function loadUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function clearUserProfile() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}
