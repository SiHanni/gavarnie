'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type GlobalAudioState = {
  muted: boolean;
  setMuted: (v: boolean) => void;
  toggleMuted: () => void;
  volume: number;
  setVolume: (v: number) => void;
};

const Ctx = createContext<GlobalAudioState | null>(null);

const LS_KEY = 'catarie:audio:muted';
const LS_VOL = 'catarie:audio:volume';
const BC_CH = 'catarie:audio:bc';

export function GlobalAudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [muted, _setMuted] = useState<boolean>(true); // 초진입: 음소거 ON
  const [volume, _setVolume] = useState<number>(0.7);

  const bcRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ms = window.localStorage.getItem(LS_KEY);
    if (ms === 'true' || ms === 'false') _setMuted(ms === 'true');

    const vs = window.localStorage.getItem(LS_VOL);
    if (vs && !Number.isNaN(parseFloat(vs))) _setVolume(parseFloat(vs));

    try {
      bcRef.current = new BroadcastChannel(BC_CH);
      bcRef.current.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data || {};
        if (type === 'muted') _setMuted(!!payload);
        if (type === 'volume') {
          const nv = Math.max(0, Math.min(1, Number(payload) || 0));
          _setVolume(nv);
        }
      };
    } catch {
      /* Safari 등 일부 환경은 미지원 → 무시 */
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LS_KEY && ev.newValue != null)
        _setMuted(ev.newValue === 'true');
      if (ev.key === LS_VOL && ev.newValue != null) {
        const nv = Math.max(0, Math.min(1, Number(ev.newValue)));
        _setVolume(nv);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      bcRef.current?.close();
    };
  }, []);

  const setMuted = (v: boolean) => {
    _setMuted(v);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY, String(v));
      bcRef.current?.postMessage({ type: 'muted', payload: v });
    }
  };

  const toggleMuted = () => setMuted(!muted);

  const setVolume = (v: number) => {
    const nv = Math.max(0, Math.min(1, v));
    _setVolume(nv);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_VOL, String(nv));
      bcRef.current?.postMessage({ type: 'volume', payload: nv });
    }
  };

  const value = useMemo<GlobalAudioState>(
    () => ({
      muted,
      setMuted,
      toggleMuted,
      volume,
      setVolume,
    }),
    [muted, volume]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGlobalAudio() {
  const v = useContext(Ctx);
  if (!v)
    throw new Error('useGlobalAudio must be used within GlobalAudioProvider');
  return v;
}
