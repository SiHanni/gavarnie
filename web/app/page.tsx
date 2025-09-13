import { Suspense } from 'react';
import FullPageFeed from '@/components/FullpageFeed';

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className='h-[100svh] grid place-items-center'>
          피드를 불러오는 중…
        </div>
      }
    >
      <FullPageFeed />
    </Suspense>
  );
}
