export type UserProfile = {
  id?: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string | null;
};

const KEY = 'userProfile';

function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
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
    avatarUrl: p.avatarUrl ?? null, // 토큰에 있으면 사용
  };
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export function saveUserProfile(p: UserProfile) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(p));
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
