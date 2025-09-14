'use client';

import { useEffect } from 'react';
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import AuthModal from '@/components/AuthModal';
import TopRightActions from '@/components/TopRightActions';
import { initAuthFromStorage } from '@/lib/http';

export default function AuthHost() {
  useEffect(() => {
    initAuthFromStorage();
  }, []);
  return (
    <AuthModalProvider>
      <TopRightActions />
      <AuthModal />
    </AuthModalProvider>
  );
}
