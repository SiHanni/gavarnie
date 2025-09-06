// TODO: 미니 UI 도입
'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { attachHlsTo } from '@/lib/hls';

type SessionKind = 'video' | 'audio';

export type PlayerSession = {
  mediaId: string;
  src: string;
  kind: SessionKind;
  title?: string | null;
  poster?: string | null;
  authorName?: string | null;
  startTime?: number;
  muted?: boolean;
  volume?: number;
  playing?: boolean;
};

type PlayerContextType = {
  session: PlayerSession | null;
  minimized: boolean;
  takeoverFrom: (
    el: HTMLMediaElement,
    meta: Omit<PlayerSession, 'startTime' | 'muted' | 'volume' | 'playing'>
  ) => void;
  releaseTo: (target: HTMLMediaElement, mediaId: string) => void;
  close: () => void;
};

const PlayerCtx = createContext<PlayerContextType | null>(null);

export function useGlobalPlayer() {
  const ctx = useContext(PlayerCtx);
  if (!ctx)
    throw new Error('useGlobalPlayer must be used inside <PlayerProvider>');
  return ctx;
}

export default function PlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [minimized, setMinimized] = useState(false);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // 클라이언트 마운트 체크 (포털 SSR 금지)
  useEffect(() => setMounted(true), []);

  // HLS 바인딩/해제
  useEffect(() => {
    if (!mounted) return;
    const el = mediaRef.current;
    if (!el || !session) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try {
        (el as any).removeAttribute?.('src');
        el.load?.();
      } catch {}
    };

    if (session.kind === 'video') {
      attachHlsTo(el as HTMLVideoElement, session.src);
    } else {
      const a = el as HTMLAudioElement;
      const canNative = a.canPlayType('application/vnd.apple.mpegURL') !== '';
      if (canNative) {
        a.src = session.src;
        a.load();
      } else if (Hls.isSupported()) {
        const h = new Hls({ lowLatencyMode: true });
        hlsRef.current = h;
        h.loadSource(session.src);
        h.attachMedia(a);
      } else {
        a.src = session.src;
        a.load();
      }
    }

    return cleanup;
  }, [mounted, session?.src, session?.kind]);

  // 세션 상태 적용 + 자동재생
  useEffect(() => {
    if (!mounted) return;
    const el = mediaRef.current;
    if (!minimized || !session || !el) return;

    const onLoaded = () => {
      try {
        const t = Number.isFinite(session.startTime ?? 0)
          ? (session.startTime as number)
          : 0;
        if (t > 0) el.currentTime = t;
      } catch {}
      if (session.playing) el.play().catch(() => {});
    };

    try {
      const t = Number.isFinite(session.startTime ?? 0)
        ? (session.startTime as number)
        : 0;
      if (t > 0) el.currentTime = t;
    } catch {}
    el.muted = !!session.muted;
    el.volume = Number.isFinite(session.volume ?? 0)
      ? (session.volume as number)
      : 0.7;

    el.addEventListener('loadedmetadata', onLoaded);
    if ((el as any).readyState >= 1) onLoaded();

    return () => {
      el.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [mounted, minimized, session]);

  const takeoverFrom: PlayerContextType['takeoverFrom'] = useCallback(
    (el, meta) => {
      const snap: PlayerSession = {
        mediaId: meta.mediaId,
        src: meta.src,
        kind: meta.kind,
        title: meta.title ?? null,
        poster: meta.poster ?? null,
        authorName: meta.authorName ?? null,
        startTime: el.currentTime || 0,
        muted: el.muted,
        volume: el.volume,
        playing: !el.paused,
      };
      setSession(snap);
      setMinimized(true);
    },
    []
  );

  const releaseTo: PlayerContextType['releaseTo'] = useCallback(
    (target, mediaId) => {
      if (!session || session.mediaId !== mediaId) return;

      const applyBack = () => {
        try {
          const t = Number.isFinite(session.startTime ?? 0)
            ? (session.startTime as number)
            : 0;
          if (t > 0) target.currentTime = t;
        } catch {}
        target.muted = !!session.muted;
        target.volume = Number.isFinite(session.volume ?? 0)
          ? (session.volume as number)
          : 0.7;
        if (session.playing) target.play().catch(() => {});
      };

      target.addEventListener('loadedmetadata', applyBack);
      try {
        if ((target as any).readyState >= 1) applyBack();
      } catch {}

      setMinimized(false);
    },
    [session]
  );

  const close = useCallback(() => {
    setMinimized(false);
    setSession(null);
    const el = mediaRef.current;
    if (el) {
      try {
        el.pause?.();
        (el as any).removeAttribute?.('src');
        el.load?.();
      } catch {}
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({ session, minimized, takeoverFrom, releaseTo, close }),
    [session, minimized, takeoverFrom, releaseTo, close]
  );

  return (
    <PlayerCtx.Provider value={value}>
      {children}
      {/* ✅ 클라이언트 마운트 이후에만 포털 생성 */}
      {mounted && minimized && session
        ? createPortal(
            <MiniHUD
              session={session}
              mediaRef={mediaRef}
              onClose={close}
              onToggle={() => {
                const el = mediaRef.current;
                if (!el) return;
                if (el.paused) el.play().catch(() => {});
                else el.pause();
              }}
            />,
            document.body
          )
        : null}
    </PlayerCtx.Provider>
  );
}

/* ---------- Mini HUD ---------- */

function MiniHUD({
  session,
  mediaRef,
  onClose,
  onToggle,
}: {
  session: PlayerSession;
  mediaRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  onClose: () => void;
  onToggle: () => void;
}) {
  const box =
    'fixed z-[10000] right-4 bottom-4 w-[320px] max-w-[90vw] rounded-xl border border-white/15 bg-neutral-900/90 backdrop-blur shadow-2xl overflow-hidden';

  return (
    <div className={box}>
      <div className='flex items-center gap-2 px-3 py-2 border-b border-white/10'>
        <div className='text-xs text-white/85 truncate'>
          <strong className='font-semibold'>
            {session.authorName || 'Creator'}
          </strong>{' '}
          <span className='text-white/60'>— {session.title || ''}</span>
        </div>
        <button
          className='ml-auto text-white/70 hover:text-white text-sm px-2 py-1'
          onClick={onToggle}
        >
          ▶/⏸
        </button>
        <button
          className='text-white/70 hover:text-white text-sm px-2 py-1'
          onClick={onClose}
          aria-label='닫기'
        >
          ✕
        </button>
      </div>

      <div className='bg-black grid place-items-center'>
        {session.kind === 'video' ? (
          <video
            ref={mediaRef as React.MutableRefObject<HTMLVideoElement>}
            className='w-full h-[180px] object-contain bg-black'
            muted
            playsInline
            loop
            controls
          />
        ) : (
          <audio
            ref={mediaRef as React.MutableRefObject<HTMLAudioElement>}
            className='w-full'
            controls
            playsInline
          />
        )}
      </div>
    </div>
  );
}
