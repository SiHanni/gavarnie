'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type OpenArgs = { mediaId: string };
type CommentsCtx = {
  isOpen: boolean;
  mediaId: string | null;
  open: (args: OpenArgs) => void;
  close: () => void;
};

const Ctx = createContext<CommentsCtx | null>(null);

export function CommentsPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setOpen] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);

  const open = useCallback((args: OpenArgs) => {
    setMediaId(args.mediaId);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setMediaId(null);
  }, []);

  const value = useMemo(
    () => ({ isOpen, mediaId, open, close }),
    [isOpen, mediaId, open, close]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommentsPanel() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      'useCommentsPanel must be used within CommentsPanelProvider'
    );
  return ctx;
}
