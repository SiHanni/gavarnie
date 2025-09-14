'use client';

import { UploadModalProvider } from '@/contexts/UploadModalContext';
import UploadModal from '@/components/UploadModal';

export default function UploadHost() {
  return (
    <UploadModalProvider>
      <UploadModal />
    </UploadModalProvider>
  );
}
