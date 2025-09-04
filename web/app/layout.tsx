import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import dynamic from 'next/dynamic';

// 우상단 액션바는 클라이언트 전용(SSR 불일치 방지)
const TopRightActions = dynamic(() => import('@/components/TopRightActions'), {
  ssr: false,
});
const LeftSidebar = dynamic(() => import('@/components/LeftSidebar'), {
  ssr: false,
});
// 모달/컨텍스트
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { UploadModalProvider } from '@/contexts/UploadModalContext';
import AuthModal from '@/components/AuthModal';
import UploadModal from '@/components/UploadModal';
import { ShareModalProvider } from '@/contexts/ShareModalContext';
import ShareModal from '@/components/ShareModal';
import { CommentsPanelProvider } from '@/contexts/CommentsPanelContext';
import CommentsPanel from '@/components/CommentsPanel';

export const metadata: Metadata = {
  title: 'Catarie',
  icons: {
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
      <body className='scroll-smooth'>
        {/* 전체 페이지를 검정으로, 페이지 자체 스크롤은 숨김(피드가 스크롤 담당) */}
        <body className='min-h-[100svh] bg-black text-white overflow-hidden'>
          <Providers>
            <AuthModalProvider>
              <UploadModalProvider>
                <ShareModalProvider>
                  <CommentsPanelProvider>
                    {/* 좌측 네비게이션 */}
                    <LeftSidebar width={220} logoWidth={160} logoHeight={70} />
                    {/* 우측 상단: 업로드/로그인/아바타 */}
                    <TopRightActions />
                    {/* 로그인/회원가입 모달 */}
                    <AuthModal />
                    {/* 업로드 모달 */}
                    <UploadModal />
                    {/* 공유 모달 */}
                    <ShareModal />
                    {/* 실제 페이지 */}
                    <CommentsPanel />
                    {children}
                  </CommentsPanelProvider>
                </ShareModalProvider>
              </UploadModalProvider>
            </AuthModalProvider>
          </Providers>
        </body>
      </body>
    </html>
  );
}
