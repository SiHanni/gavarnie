// .env.local 의 NEXT_PUBLIC_API_BASE_URL 사용
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
).replace(/\/+$/, '');
