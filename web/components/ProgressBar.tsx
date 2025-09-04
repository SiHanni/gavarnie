'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  progress: number; // 0~1
  buffered?: number; // 0~1
  onSeek: (ratio: number) => void;
  duration?: number; // 툴팁 시간 계산용
  color?: string; // 기본 #5a319f
  barHeight?: number; // 기본 8(px)
  className?: string; // 외부 여백/정렬
  showHandle?: boolean;
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
  barHeight = 6,
  className = '',
  showHandle = false,
}: Props) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const p = Math.min(1, Math.max(0, progress));
  const b = Math.min(1, Math.max(0, buffered));
  const pct = useMemo(() => `${p * 100}%`, [p]);
  const bufPct = useMemo(() => `${b * 100}%`, [b]);

  const getRatio = (clientX: number) => {
    const el = barRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const doSeek = (clientX: number) => {
    const r = getRatio(clientX);
    if (r == null) return;
    onSeek(r);
  };

  // === 요소 내부 포인터 처리 (+ 문서 전역 안전망) ===
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setDragging(true);
    doSeek(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setHoverX(e.clientX);
    if (dragging) doSeek(e.clientX);
  };

  const endDragLocal = (e?: React.PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  useEffect(() => {
    if (!dragging) return;

    const endDragGlobal = () => setDragging(false);

    document.addEventListener('pointerup', endDragGlobal, { capture: true });
    document.addEventListener('pointercancel', endDragGlobal, {
      capture: true,
    });
    window.addEventListener('blur', endDragGlobal);
    document.addEventListener('visibilitychange', endDragGlobal);
    window.addEventListener('scroll', endDragGlobal, { passive: true });
    window.addEventListener('wheel', endDragGlobal, { passive: true });

    return () => {
      document.removeEventListener('pointerup', endDragGlobal, {
        capture: true,
      } as any);
      document.removeEventListener('pointercancel', endDragGlobal, {
        capture: true,
      } as any);
      window.removeEventListener('blur', endDragGlobal);
      document.removeEventListener('visibilitychange', endDragGlobal);
      window.removeEventListener('scroll', endDragGlobal);
      window.removeEventListener('wheel', endDragGlobal);
    };
  }, [dragging]);

  const tooltipRatio = useMemo(() => {
    if (hoverX == null) return null;
    const r = getRatio(hoverX);
    return r == null ? null : r;
  }, [hoverX]);

  return (
    <div className={`w-full select-none ${className}`}>
      <div
        ref={barRef}
        className='relative rounded-full bg-white/25'
        style={{ height: barHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDragLocal}
        onPointerCancel={() => setDragging(false)}
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
        {showHandle && (
          <div
            className='absolute rounded-full'
            style={{
              left: pct,
              top: '50%',
              width: barHeight + 3,
              height: barHeight + 3,
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
            }}
          />
        )}

        {/* 툴팁 */}
        {tooltipRatio != null && (
          <div
            className='pointer-events-none absolute -top-7 translate-x-[-50%]'
            style={{ left: `${tooltipRatio * 100}%` }}
          >
            <div
              className='px-2 py-1 rounded-md text-xs font-semibold'
              style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}
            >
              {fmt(tooltipRatio * (duration || 0))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
