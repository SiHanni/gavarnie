import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Catarie Web',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='ko'>
      <body className='min-h-screen bg-white text-neutral-900'>
        {/* TODO: TopNav / LeftSidebar는 다음 단계에서 추가 */}
        <main className='max-w-[720px] mx-auto p-6'>{children}</main>
      </body>
    </html>
  );
}
