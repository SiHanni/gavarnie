'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  /** 0~1 진행률 */
  progress: number;
  /** 0~1 버퍼 진행 */
  buffered?: number;
  /** 드래그/클릭 시 시크(0~1) */
  onSeek: (ratio: number) => void;
  /** 툴팁 계산용 전체 길이(초) */
  duration?: number;
  /** 색상 */
  color?: string; // 기본 #5a319f
  /** 막대 두께(px) */
  barHeight?: number; // 기본 8
  /** 외부 컨테이너 클래스 (여백/정렬 조절용) */
  className?: string;
};

function fmt(sec = 0) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${m}:${String(ss).padStart(2, '0')}`;
}

export default function ProgressBar({
  progress,
  buffered = 0,
  onSeek,
  duration = 0,
  color = '#5a319f',
  barHeight = 8,
  className = '',
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const p = Math.min(1, Math.max(0, progress));
  const b = Math.min(1, Math.max(0, buffered));
  const pct = useMemo(() => `${p * 100}%`, [p]);
  const bufPct = useMemo(() => `${b * 100}%`, [b]);

  const rectAndRatio = (clientX: number) => {
    const el = barRef.current;
    if (!el) return { ratio: null, rect: null as DOMRect | null };
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return { ratio, rect };
  };

  const doSeek = (clientX: number) => {
    const { ratio } = rectAndRatio(clientX);
    if (ratio == null) return;
    onSeek(ratio);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => doSeek(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging]);

  // 툴팁 계산
  const tooltip = (() => {
    if (hoverX == null || !barRef.current) return null;
    const { ratio, rect } = rectAndRatio(hoverX);
    if (ratio == null || !rect) return null;
    const time = ratio * (duration || 0);
    return {
      leftPx: rect.left + rect.width * ratio,
      label: fmt(time),
      ratio,
    };
  })();

  return (
    <div
      className={`w-full select-none ${className}`}
      onClick={e => e.stopPropagation()} // 프레임 onClick으로 전파 방지
    >
      <div
        ref={barRef}
        className='relative rounded-full cursor-pointer bg-white/25'
        style={{ height: barHeight }}
        onPointerDown={e => {
          setDragging(true);
          doSeek(e.clientX);
        }}
        onPointerMove={e => setHoverX(e.clientX)}
        onPointerLeave={() => setHoverX(null)}
        role='slider'
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
        aria-label='재생 위치'
      >
        {/* buffered */}
        <div
          className='absolute left-0 top-0 rounded-full'
          style={{
            width: bufPct,
            height: '100%',
            backgroundColor: '#ffffff55',
          }}
        />
        {/* progress */}
        <div
          className='absolute left-0 top-0 rounded-full'
          style={{ width: pct, height: '100%', backgroundColor: color }}
        />
        {/* handle */}
        <div
          className='absolute rounded-full shadow'
          style={{
            left: pct,
            top: '50%',
            width: barHeight + 6,
            height: barHeight + 6,
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        />
      </div>

      {/* 툴팁: hover/드래그 중에만 */}
      {tooltip && (
        <div
          className='pointer-events-none fixed z-[9999] translate-x-[-50%]'
          style={{ left: tooltip.leftPx, bottom: 36 }} // 화면 하단과 겹치지 않게 약간 띄움
        >
          <div
            className='px-2 py-1 rounded-md text-xs font-semibold'
            style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}
          >
            {tooltip.label}
          </div>
        </div>
      )}
    </div>
  );
}
