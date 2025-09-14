'use client';

import { useMemo } from 'react';
import type { RecentMediaNode } from '@/lib/types';
import { joinHls } from '@/lib/url';
import VideoPlayer from '@/components/VideoPlayer';

export default function FeedCard({ node }: { node: RecentMediaNode }) {
  const streamUrl = useMemo(() => joinHls(node.hlsKey), [node.hlsKey]);

  return (
    <article className='mb-8 rounded-2xl overflow-hidden border border-neutral-200 bg-white'>
      {/* 상단: 작성자/파일명 */}
      <header className='p-4 flex items-center gap-3'>
        <div className='size-8 rounded-full bg-neutral-200' />
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-semibold truncate'>
            {node.author.displayName}
          </div>
          <div className='text-xs text-neutral-500 truncate'>
            {node.originalFilename}
          </div>
        </div>
      </header>

      {/* 본문: HLS 비디오 */}
      <div className='bg-black'>
        <VideoPlayer src={streamUrl} muted />
      </div>
    </article>
  );
}
