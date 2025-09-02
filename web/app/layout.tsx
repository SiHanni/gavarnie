// web/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import dynamic from 'next/dynamic';

// 우상단 액션바는 클라이언트에서만 렌더 → 수화 불일치 방지
const TopRightActions = dynamic(() => import('@/components/TopRightActions'), {
  ssr: false,
});

// 모달/컨텍스트
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { UploadModalProvider } from '@/contexts/UploadModalContext';
import AuthModal from '@/components/AuthModal';
import UploadModal from '@/components/UploadModal';

export const metadata: Metadata = { title: 'Catarie' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ko'>
      {/* 전체 페이지 검정, 페이지 자체 스크롤 숨김(피드/모달이 자체 스크롤) */}
      <body className='min-h-[100svh] bg-black text-white overflow-hidden'>
        {/* 프로젝트 공통 Provider (React Query 등) */}
        <Providers>
          {/* 로그인/업로드 모달이 전역에서 동작하도록 Provider로 감싸기 */}
          <AuthModalProvider>
            <UploadModalProvider>
              {/* 우상단 +업로드/로그인/아바타 */}
              <TopRightActions />
              {/* 로그인/회원가입 모달 */}
              <AuthModal />
              {/* 업로드 모달 */}
              <UploadModal />
              {/* 실제 페이지 */}
              {children}
            </UploadModalProvider>
          </AuthModalProvider>
        </Providers>
      </body>
    </html>
  );
}
