'use client';

import { useEffect, useRef, useState } from 'react';
import { useUploadModal } from '@/contexts/UploadModalContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import {
  getAccessToken,
  presignUpload,
  completeUpload,
  getMediaStatus,
} from '@/lib/http';

// 상태 타입
type Step =
  | 'idle'
  | 'presign'
  | 'uploading'
  | 'completing'
  | 'waiting'
  | 'polling'
  | 'done'
  | 'failed'
  | 'error';

export default function UploadModal() {
  const { isOpen, close } = useUploadModal();
  const { open: openLogin } = useAuthModal();

  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [msg, setMsg] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setStep('idle');
    setMsg('');
    setProgress(0);
    return () => {
      // 닫힐 때 정리
      xhrRef.current?.abort();
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const onPick: React.ChangeEventHandler<HTMLInputElement> = e => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const startUpload = async () => {
    try {
      if (!file) return;
      if (!getAccessToken()) {
        // 로그인 필요
        openLogin('login');
        return;
      }

      // 1) presign
      setStep('presign');
      setMsg('업로드 준비 중…');
      const kind: 'video' | 'audio' = file.type.startsWith('audio/')
        ? 'audio'
        : 'video';
      const p = await presignUpload(file.name, file.type || undefined, kind);
      const url = (p as any).url ?? (p as any).uploadUrl;
      const headers: Record<string, string> = (p as any).headers ?? {};
      const key: string = (p as any).key;
      const mediaId: string = (p as any).mediaId;

      // 2) PUT 업로드 (XHR로 진행률)
      setStep('uploading');
      setMsg('파일 업로드 중…');
      await putWithProgress(url, headers, file, pct => setProgress(pct));

      // 3) 완료 통지
      setStep('completing');
      setMsg('서버에 업로드 완료 알림…');
      await completeUpload(mediaId, key, file.size);

      // 4) 초기 대기(큐 픽업 여유) → 5초 후 폴링 시작
      setStep('waiting');
      setMsg('처리 대기 중… (곧 시작됩니다)');
      await delay(5000);

      // 5) 상태 폴링 (3초 간격, 최대 2분)
      setStep('polling');
      setMsg('미디어 처리 중…');
      await pollStatus(mediaId, 3_000, 120_000);
      setStep('done');
      setMsg('처리 완료! 피드에서 확인할 수 있어요.');
    } catch (e: any) {
      // READY/FAILED 외의 에러 처리
      if (e?.__status === 'FAILED') {
        setStep('failed');
        setMsg('처리 실패. 파일을 다시 시도해 주세요.');
      } else {
        setStep('error');
        setMsg(e?.message || '업로드 중 오류가 발생했습니다.');
      }
    }
  };

  const cancelAll = () => {
    xhrRef.current?.abort();
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
    close();
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-[60] grid place-items-center'
    >
      <div className='absolute inset-0 bg-black/70' onClick={cancelAll} />

      <div className='relative w-[min(640px,92vw)] max-h-[92vh] overflow-y-auto rounded-2xl bg-neutral-950 text-white border border-white/10 p-6'>
        <button
          type='button'
          onClick={cancelAll}
          aria-label='닫기'
          className='absolute right-3 top-3 text-2xl text-white/70 hover:text-white'
        >
          ×
        </button>
        <h2 className='text-xl font-bold'>업로드</h2>

        {/* 드롭존 / 파일선택 */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className='mt-4 rounded-xl border border-dashed border-white/20 bg-white/5 p-6 text-center'
        >
          {!file ? (
            <>
              <p className='text-white/80'>
                여기로 드래그 앤 드롭하거나, 파일을 선택하세요.
              </p>
              <p className='text-xs text-white/50 mt-1'>동영상/오디오 지원</p>
              <label className='inline-block mt-4 px-3 py-2 rounded bg-white text-black cursor-pointer'>
                파일 선택
                <input
                  type='file'
                  accept='video/*,audio/*'
                  className='hidden'
                  onChange={onPick}
                />
              </label>
            </>
          ) : (
            <div className='text-left'>
              <div className='text-sm text-white/90 break-all'>
                선택됨: {file.name}{' '}
                <span className='text-white/50'>
                  ({Math.round(file.size / 1024)} KB, {file.type || 'unknown'})
                </span>
              </div>
              {/* 진행률 바 */}
              {step === 'uploading' && (
                <div className='mt-3'>
                  <div className='h-2 w-full bg-white/10 rounded'>
                    <div
                      className='h-2 bg-white rounded'
                      style={{ width: `${Math.round(progress)}%` }}
                    />
                  </div>
                  <div className='text-xs text-white/60 mt-1'>
                    {Math.round(progress)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션/상태 */}
        <div className='mt-4 flex items-center gap-2'>
          <button
            onClick={startUpload}
            disabled={
              !file ||
              step === 'uploading' ||
              step === 'completing' ||
              step === 'waiting' ||
              step === 'polling'
            }
            className='px-4 py-2 rounded bg-white text-black font-semibold disabled:opacity-50'
          >
            업로드 시작
          </button>
          <button
            onClick={cancelAll}
            className='px-3 py-2 rounded bg-white/10 border border-white/20'
          >
            닫기
          </button>
          <div className='text-sm text-white/70 ml-auto'>{msg}</div>
        </div>

        {/* 안내 */}
        {(step === 'waiting' || step === 'polling') && (
          <p className='mt-3 text-xs text-white/50'>
            업로드 완료 후 작업 큐에서 트랜스코딩을 시작하기까지 시간이 조금
            필요할 수 있어요.
          </p>
        )}

        {(step === 'done' || step === 'failed' || step === 'error') && (
          <div className='mt-4'>
            <button
              onClick={cancelAll}
              className='px-4 py-2 rounded bg-white text-black font-semibold'
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ helpers ============ */

function delay(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

// XHR로 PUT 진행률 트래킹
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    for (const [k, v] of Object.entries(headers))
      xhr.setRequestHeader(k, v as string);
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`PUT 실패: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('네트워크 오류'));
    xhr.onabort = () => reject(new Error('업로드 취소됨'));
    xhr.send(file);
  });
}

// 상태 폴링 (초기 지연은 바깥에서 처리)
async function pollStatus(
  mediaId: string,
  intervalMs: number,
  timeoutMs: number
) {
  const start = Date.now();
  while (true) {
    const s = await getMediaStatus(mediaId); // UPLOADING|QUEUED|PROCESSING|READY|FAILED
    if (s.status === 'READY') return;
    if (s.status === 'FAILED') {
      const err: any = new Error('FAILED');
      err.__status = 'FAILED';
      throw err;
    }
    if (Date.now() - start > timeoutMs)
      throw new Error(
        '처리가 오래 걸리고 있어요. 잠시 후 피드에서 확인해 주세요.'
      );
    await delay(intervalMs);
  }
}
