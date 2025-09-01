'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Mode = 'login' | 'signup';
type Ctx = {
  isOpen: boolean;
  mode: Mode;
  open: (m?: Mode) => void;
  close: () => void;
  setMode: (m: Mode) => void;
};

const Ctx = createContext<Ctx | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');

  const open = useCallback((m: Mode = 'login') => {
    setMode(m);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  // 401 시 자동 오픈
  useEffect(() => {
    const onNeed = () => open('login');
    window.addEventListener('auth:required', onNeed as EventListener);
    return () =>
      window.removeEventListener('auth:required', onNeed as EventListener);
  }, [open]);

  const value = useMemo(
    () => ({ isOpen, mode, open, close, setMode }),
    [isOpen, mode, open, close]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthModal() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuthModal must be used inside AuthModalProvider');
  return v;
}
