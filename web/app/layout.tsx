// web/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import dynamic from 'next/dynamic';
import TopLeftBrand from '@/components/TopLeftBrand';

// 우상단 액션바는 클라이언트 전용(SSR 불일치 방지)
const TopRightActions = dynamic(() => import('@/components/TopRightActions'), {
  ssr: false,
});

// 모달/컨텍스트
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { UploadModalProvider } from '@/contexts/UploadModalContext';
import AuthModal from '@/components/AuthModal';
import UploadModal from '@/components/UploadModal';
import { ShareModalProvider } from '@/contexts/ShareModalContext';
import ShareModal from '@/components/ShareModal';

export const metadata: Metadata = {
  title: 'Catarie',
  icons: {
    // ✅ 파비콘: public 경로 기준
    icon: '/images/favicon.png',
    shortcut: '/images/favicon.png',
    apple: '/images/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ko'>
      {/* 전체 페이지를 검정으로, 페이지 자체 스크롤은 숨김(피드가 스크롤 담당) */}
      <body className='min-h-[100svh] bg-black text-white overflow-hidden'>
        <Providers>
          <AuthModalProvider>
            <UploadModalProvider>
              <ShareModalProvider>
                {/* 좌측 상단 배너 아이콘 (크기/위치 숫자로 쉽게 조절) */}
                <TopLeftBrand
                  left={20} // px
                  top={-20} // px
                  size={160} // px (정사각)
                />
                {/* 우측 상단: 업로드/로그인/아바타 */}
                <TopRightActions />
                {/* 로그인/회원가입 모달 */}
                <AuthModal />
                {/* 업로드 모달 */}
                <UploadModal />
                {/* 공유 모달 */}
                <ShareModal />
                {/* 실제 페이지 */}
                {children}
              </ShareModalProvider>
            </UploadModalProvider>
          </AuthModalProvider>
        </Providers>
      </body>
    </html>
  );
}
