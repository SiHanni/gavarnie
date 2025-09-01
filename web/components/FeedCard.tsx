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
        {/* TODO: 여기 "작성자 아바타 PNG/SVG" 넣어주세요 (32x32) */}
        <div className='size-8 rounded-full bg-neutral-200' />
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-semibold truncate'>
            {node.author.displayName}
          </div>
          <div className='text-xs text-neutral-500 truncate'>
            {node.originalFilename}
          </div>
        </div>
        {/* TODO: 여기 "더보기(점3개) 아이콘" */}
      </header>

      {/* 본문: HLS 비디오 */}
      <div className='bg-black'>
        <VideoPlayer src={streamUrl} muted />
      </div>

      {/* 하단: 액션/카운트 (초기 뼈대: 클릭만) */}
      <footer className='p-4 flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          {/* TODO: 여기 "좋아요 아이콘" 넣어주세요 (40x40) */}
          <button
            className='text-sm'
            onClick={() => {
              /* TODO: /media/:id like */
            }}
          >
            좋아요 {node.likeCount}
          </button>

          {/* TODO: 여기 "댓글 아이콘" 넣어주세요 (40x40) */}
          <button
            className='text-sm'
            onClick={() => {
              /* TODO: 댓글 패널 오픈 */
            }}
          >
            댓글 {node.commentCount}
          </button>

          {/* TODO: 여기 "공유 아이콘" 넣어주세요 (40x40) */}
          <button
            className='text-sm'
            onClick={() => {
              /* TODO: 공유(프론트) */
            }}
          >
            공유
          </button>
        </div>
        <time className='text-xs text-neutral-500'>
          {new Date(node.createdAt).toLocaleString()}
        </time>
      </footer>
    </article>
  );
}
