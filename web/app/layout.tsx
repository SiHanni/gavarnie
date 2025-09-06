import './globals.css';
import type { Metadata } from 'next';
import Providers from '@/components/Providers';
import dynamic from 'next/dynamic';

const TopRightActions = dynamic(() => import('@/components/TopRightActions'), {
  ssr: false,
});
const LeftSidebar = dynamic(() => import('@/components/LeftSidebar'), {
  ssr: false,
});

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
      <body className='min-h-[100svh] bg-black text-white scroll-smooth'>
        <Providers>
          <AuthModalProvider>
            <UploadModalProvider>
              <ShareModalProvider>
                <CommentsPanelProvider>
                  <LeftSidebar width={220} logoWidth={160} logoHeight={70} />
                  <TopRightActions />
                  <AuthModal />
                  <UploadModal />
                  <ShareModal />
                  <CommentsPanel />
                  {children}
                </CommentsPanelProvider>
              </ShareModalProvider>
            </UploadModalProvider>
          </AuthModalProvider>
        </Providers>
      </body>
    </html>
  );
}
