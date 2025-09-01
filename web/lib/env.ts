// .env.local 값 로딩
export const ENV = {
  API: process.env.NEXT_PUBLIC_API_BASE_URL!,
  HLS: process.env.NEXT_PUBLIC_HLS_BASE_URL!,
  CDN: process.env.NEXT_PUBLIC_CDN_BASE_URL!,
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'App',
};
