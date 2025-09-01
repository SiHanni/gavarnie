import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';

export const metadata: Metadata = { title: 'Catarie' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ko'>
      {/* ✅ 페이지 전체 검정 & 스크롤은 피드 컨테이너만 */}
      <body className='min-h-[100svh] bg-black text-white overflow-hidden'>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
