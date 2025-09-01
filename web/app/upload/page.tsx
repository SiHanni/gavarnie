'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getAccessToken,
  initAuthFromStorage,
  presignUpload,
  completeUpload,
  getMediaStatus,
} from '@/lib/http';
import { useAuthModal } from '@/contexts/AuthModalContext';

type Step =
  | 'select'
  | 'presign'
  | 'uploading'
  | 'completing'
  | 'done'
  | 'error';

export default function UploadPage() {
  const { open } = useAuthModal();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [msg, setMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    initAuthFromStorage();
  }, []);

  const start = async () => {
    try {
      if (!file) return;
      if (!getAccessToken()) {
        open('login');
        return;
      }

      setStep('presign');
      setMsg('사전 서명 요청…');
      const kind = file.type.startsWith('audio/') ? 'audio' : 'video';
      const p = await presignUpload(file.name, file.type || undefined, kind);

      const url = (p as any).url ?? (p as any).uploadUrl;
      const headers = (p as any).headers ?? {};
      const key: string = (p as any).key;
      const mediaId: string = (p as any).mediaId;

      setStep('uploading');
      setMsg('파일 업로드 중…');
      abortRef.current = new AbortController();

      // PUT 업로드
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: headers as Record<string, string>,
        body: file,
        signal: abortRef.current.signal,
      });
      if (!putRes.ok) throw new Error(`PUT 실패: ${putRes.status}`);

      setStep('completing');
      setMsg('서버에 업로드 완료 알림…');
      await completeUpload(mediaId, key, file.size);

      setStep('done');
      setMsg('업로드 완료! 인코딩 상태 확인 중…');

      // 상태 폴링(READY/FAILED/PROCESSING)
      let tries = 0;
      const poll = async () => {
        const s = await getMediaStatus(mediaId);
        if (s.status === 'READY') {
          setMsg('처리 완료! 피드에서 확인할 수 있어요.');
          return;
        }
        if (s.status === 'FAILED') {
          setMsg('처리 실패. 파일을 다시 시도해 주세요.');
          return;
        }
        if (++tries < 20) setTimeout(poll, 3000);
        else setMsg('처리가 오래 걸리고 있어요. 잠시 후 다시 확인해 주세요.');
      };
      poll();
    } catch (e: any) {
      setStep('error');
      setMsg(e?.message || '업로드 중 오류가 발생했습니다.');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setMsg('업로드가 취소되었습니다.');
    setStep('select');
  };

  return (
    <main className='min-h-[100svh] bg-black text-white p-6'>
      <h1 className='text-xl font-bold'>업로드</h1>

      <div className='mt-6 space-y-4 max-w-xl'>
        <input
          type='file'
          accept='video/*,audio/*'
          onChange={e => setFile(e.target.files?.[0] || null)}
          className='block'
        />
        {file && (
          <div className='text-sm text-white/80'>
            선택됨: {file.name} ({Math.round(file.size / 1024)} KB,{' '}
            {file.type || 'unknown'})
          </div>
        )}

        <div className='flex gap-2'>
          <button
            onClick={start}
            disabled={!file || step === 'uploading' || step === 'completing'}
            className='px-4 py-2 rounded bg-white text-black font-semibold disabled:opacity-50'
          >
            업로드 시작
          </button>
          {step === 'uploading' && (
            <button
              onClick={cancel}
              className='px-3 py-2 rounded bg-white/10 border border-white/20'
            >
              취소
            </button>
          )}
        </div>

        <p className='text-sm text-white/70'>{msg}</p>
      </div>
    </main>
  );
}
