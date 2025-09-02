'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type Ctx = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const UploadModalCtx = createContext<Ctx | null>(null);

export function UploadModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return (
    <UploadModalCtx.Provider value={value}>{children}</UploadModalCtx.Provider>
  );
}

export function useUploadModal() {
  const ctx = useContext(UploadModalCtx);
  if (!ctx)
    throw new Error('useUploadModal must be used inside <UploadModalProvider>');
  return ctx;
}
