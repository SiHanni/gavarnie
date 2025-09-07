/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      // 브라우저 URL: /@handle  →  파일 라우트: /u/handle
      { source: '/@:handle', destination: '/u/:handle' },
    ];
  },
};

export default nextConfig;
