// web/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import AuthHost from '@/components/AuthHost'; // ✅ 추가

export const metadata: Metadata = { title: 'Catarie' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ko'>
      {/* 전체 검정, 페이지 스크롤은 숨기고(피드 컨테이너가 자체 스크롤) */}
      <body className='min-h-[100svh] bg-black text-white overflow-hidden'>
        <Providers>
          {/* ✅ 우상단 +업로드/로그인 버튼 & 로그인/가입 모달 */}
          <AuthHost />
          {children}
        </Providers>
      </body>
    </html>
  );
}
