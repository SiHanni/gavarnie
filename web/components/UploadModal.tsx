// web/src/components/UploadModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUploadModal } from '@/contexts/UploadModalContext';
import { useAuthModal } from '@/contexts/AuthModalContext';
import {
  getAccessToken,
  presignUpload,
  completeUpload,
  getMediaStatus,
} from '@/lib/http';
import { filenameWithoutExt } from '@/lib/strings';

// ===== 상태 타입 =====
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

// ===== 환경 변수 (없으면 기본값) =====
const WARMUP_MS =
  Number(process.env.NEXT_PUBLIC_UPLOAD_STATUS_WARMUP_MS) || 5000;
const INTERVAL_MS =
  Number(process.env.NEXT_PUBLIC_UPLOAD_STATUS_INTERVAL_MS) || 3000;
const TIMEOUT_MS =
  Number(process.env.NEXT_PUBLIC_UPLOAD_STATUS_TIMEOUT_MS) || 120000;

const ACCENT = '#5a319f';
const TITLE_MAX = 200;

export default function UploadModal() {
  const { isOpen, close } = useUploadModal();
  const { open: openLogin } = useAuthModal();

  // ===== 훅은 항상 컴포넌트 최상단에서만 호출 (조건부 금지) =====
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [step, setStep] = useState<Step>('idle');
  const [msg, setMsg] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 파일명에서 기본 제목 추출 (확장자 제거, 최대 200자)
  const defaultTitle = useMemo(() => {
    if (!file) return '';
    return filenameWithoutExt(file.name).slice(0, TITLE_MAX);
  }, [file]);

  // 모달 열릴 때마다 상태 초기화
  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setTitle('');
    setStep('idle');
    setMsg('');
    setProgress(0);
    return () => {
      xhrRef.current?.abort();
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
  }, [isOpen]);

  // 파일이 바뀌면 기본 제목 자동 세팅(사용자가 이미 수정했다면 덮어쓰지 않음)
  useEffect(() => {
    if (!file) return;
    setTitle(prev => (prev.trim().length ? prev : defaultTitle));
  }, [file, defaultTitle]);

  // 모달 비표시(닫힘) 시에는 렌더하지 않음 (위의 훅들은 항상 호출됨 → 안전)
  if (!isOpen) return null;

  // ===== 이벤트 핸들러 =====
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
        openLogin('login'); // 로그인 요구
        return;
      }

      // 1) presign
      setStep('presign');
      setMsg('업로드 준비 중…');

      // ⚠️ 백엔드 DTO: { originalFilename, title?, contentType? }
      const trimmedTitle = title.trim();
      const p = await presignUpload(
        file.name,
        file.type || undefined,
        trimmedTitle || undefined
      );

      const url = (p as any).url ?? (p as any).uploadUrl;
      const headers: Record<string, string> = (p as any).headers ?? {};
      const key: string = (p as any).key;
      const mediaId: string = (p as any).mediaId;

      // 2) PUT 업로드 (XHR 진행률)
      setStep('uploading');
      setMsg('파일 업로드 중…');
      await putWithProgress(url, headers, file, pct => setProgress(pct));

      // 3) 완료 통지
      setStep('completing');
      setMsg('서버에 업로드 완료 알림…');
      await completeUpload(mediaId, key, file.size);

      // 4) 초기 대기 (워커가 잡 집어갈 시간)
      setStep('waiting');
      setMsg('처리 대기 중… (곧 시작됩니다)');
      await delay(WARMUP_MS);

      // 5) 상태 폴링 (일시 오류 내성 + 백오프)
      setStep('polling');
      setMsg('미디어 처리 중… 서버와 동기화되고 있어요.');
      await pollStatus(mediaId, INTERVAL_MS, TIMEOUT_MS);

      setStep('done');
      setMsg('완료! 피드에서 확인할 수 있어요.');
      close();
    } catch (e: any) {
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

  // ===== 뷰 =====
  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-[9999] grid place-items-center'
    >
      {/* 백드롭 */}
      <div className='fixed inset-0 z-[9998] bg-black/70' onClick={cancelAll} />

      {/* 모달 */}
      <div
        className='relative z-[9999] w-[min(720px,92vw)] max-h-[92vh] overflow-y-auto
                   rounded-2xl border border-white/10 bg-neutral-950 text-white p-6 shadow-2xl'
        onClick={e => e.stopPropagation()}
      >
        <button
          type='button'
          onClick={cancelAll}
          aria-label='닫기'
          className='absolute right-3 top-3 text-2xl text-white/70 hover:text-white'
        >
          ×
        </button>

        <h2 className='text-2xl font-bold'>
          <span style={{ color: ACCENT }}>Catarie</span> 업로드
        </h2>

        {/* 제목 입력 (옵션) */}
        <div className='mt-4'>
          <label className='block text-sm text-white/70 mb-1'>
            제목 (선택)
          </label>
          <div
            className='flex items-center gap-2 rounded-xl border bg-white/5 px-3 py-2'
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            <input
              type='text'
              value={title}
              placeholder={
                defaultTitle || '제목을 입력하세요 (미입력 시 파일명 사용)'
              }
              maxLength={TITLE_MAX}
              onChange={e => setTitle(e.target.value)}
              className='flex-1 bg-transparent outline-none'
            />
            <span className='text-xs text-white/50'>
              {title.length}/{TITLE_MAX}
            </span>
          </div>
        </div>

        {/* 드롭존 / 파일 선택 */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className='mt-4 rounded-xl border border-dashed p-6 text-center'
          style={{
            borderColor: 'rgba(255,255,255,0.25)',
            background:
              'linear-gradient(135deg, rgba(90,49,159,0.10), rgba(255,255,255,0.04))',
          }}
        >
          {!file ? (
            <>
              <p className='text-white/85'>
                여기에 드래그 앤 드롭하거나, 아래 버튼으로 파일을 선택하세요.
              </p>
              <p className='text-xs text-white/55 mt-1'>
                동영상 / 오디오 파일을 지원합니다.
              </p>
              <label
                className='inline-block mt-4 px-4 py-2 rounded font-semibold cursor-pointer'
                style={{ backgroundColor: ACCENT }}
              >
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

              {/* 진행률 */}
              {step === 'uploading' && (
                <div className='mt-3'>
                  <div className='h-2 w-full rounded bg-white/10 overflow-hidden'>
                    <div
                      className='h-2 rounded'
                      style={{
                        width: `${Math.round(progress)}%`,
                        backgroundColor: ACCENT,
                      }}
                    />
                  </div>
                  <div className='text-xs text-white/65 mt-1'>
                    {Math.round(progress)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션/상태 */}
        <div className='mt-5 flex items-center gap-2'>
          <button
            onClick={startUpload}
            disabled={
              !file ||
              step === 'uploading' ||
              step === 'completing' ||
              step === 'waiting' ||
              step === 'polling'
            }
            className='px-4 py-2 rounded font-semibold disabled:opacity-50'
            style={{ backgroundColor: ACCENT }}
          >
            업로드 시작
          </button>
          <button
            onClick={cancelAll}
            className='px-3 py-2 rounded border'
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            닫기
          </button>
          <div className='text-sm text-white/75 ml-auto'>{msg}</div>
        </div>

        {(step === 'waiting' || step === 'polling') && (
          <p className='mt-3 text-xs text-white/55'>
            업로드 직후에는 작업 큐로 전달/준비되는 동안 잠시 대기할 수 있어요.
          </p>
        )}

        {(step === 'done' || step === 'failed' || step === 'error') && (
          <div className='mt-4'>
            <button
              onClick={cancelAll}
              className='px-4 py-2 rounded font-semibold'
              style={{ backgroundColor: ACCENT }}
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

// XHR PUT 진행률 트래킹
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

// 상태 폴링: 일시 오류 내성 + 지수 백오프
async function pollStatus(
  mediaId: string,
  intervalMs: number,
  timeoutMs: number
) {
  const start = Date.now();
  let wait = intervalMs;
  const MAX_WAIT = 10_000;

  while (true) {
    try {
      const s = await getMediaStatus(mediaId);
      if (s.status === 'READY') return;
      if (s.status === 'FAILED') {
        const err: any = new Error('FAILED');
        err.__status = 'FAILED';
        throw err;
      }
      // UPLOADING/QUEUED/PROCESSING → 계속 대기
    } catch (e: any) {
      const status: number | undefined =
        e?.response?.status ?? e?.status ?? e?.code;

      // 400/404/409/5xx 는 전파 지연/일시 오류로 보고 재시도
      if (
        status === 400 ||
        status === 404 ||
        status === 409 ||
        (typeof status === 'number' && status >= 500)
      ) {
        // 그냥 아래 대기 후 다시 시도
      } else if (e?.__status === 'FAILED') {
        throw e; // 명시적 실패는 중단
      } else {
        // 알 수 없는 오류도 한 번 더 재시도
      }
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(
        '처리가 오래 걸리고 있어요. 잠시 후 피드에서 확인해 주세요.'
      );
    }

    await delay(wait);
    wait = Math.min(Math.round(wait * 1.5), MAX_WAIT);
  }
}
