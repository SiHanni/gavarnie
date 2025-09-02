'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export type SharePayload = { url: string; title?: string };
type Ctx = {
  isOpen: boolean;
  payload: SharePayload | null;
  open: (p: SharePayload) => void;
  close: () => void;
};

const ShareCtx = createContext<Ctx | null>(null);

export function ShareModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [payload, setPayload] = useState<SharePayload | null>(null);

  const open = useCallback((p: SharePayload) => {
    setPayload(p);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setPayload(null);
  }, []);
  const value = useMemo(
    () => ({ isOpen, payload, open, close }),
    [isOpen, payload, open, close]
  );

  return <ShareCtx.Provider value={value}>{children}</ShareCtx.Provider>;
}

export function useShareModal() {
  const ctx = useContext(ShareCtx);
  if (!ctx)
    throw new Error('useShareModal must be used within ShareModalProvider');
  return ctx;
}
