// .env.local 값 로딩

export const ENV = {
  API: (
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'
  ).replace(/\/+$/, ''),
  HLS: process.env.NEXT_PUBLIC_CDN_BASE_URL || '',
  CDN: process.env.NEXT_PUBLIC_CDN_BASE_URL || '',
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Catarie',
  AUTH_DISCLAIMER: process.env.NEXT_PUBLIC_AUTH_DISCLAIMER_KR || '',
  OTP_FUNCTION_URL: (process.env.NEXT_PUBLIC_OTP_FUNCTION_URL || '').replace(
    /\/+$/,
    ''
  ),
};
