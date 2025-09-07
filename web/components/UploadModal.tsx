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
import { loadUserProfile, UserGrade, coerceUserGrade } from '@/lib/user';

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

const ACCENT = '#5a319f';

const GRADE_LABEL: Record<UserGrade, string> = {
  basic: 'Basic',
  plus: 'Plus',
  premium: 'Premium',
};
const GRADE_MAX_MB: Record<UserGrade, number> = {
  basic: 10,
  plus: 30,
  premium: 100,
};
const GRADE_MAX_PER_DAY: Record<UserGrade, number> = {
  basic: 10,
  plus: 30,
  premium: 100,
};

const WARMUP_MS =
  Number(process.env.NEXT_PUBLIC_UPLOAD_STATUS_WARMUP_MS) || 5000;
const INTERVAL_MS =
  Number(process.env.NEXT_PUBLIC_UPLOAD_STATUS_INTERVAL_MS) || 3000;
const TIMEOUT_MS =
  Number(process.env.NEXT_PUBLIC_UPLOAD_STATUS_TIMEOUT_MS) || 120000;

const TITLE_MAX = 200;

export default function UploadModal() {
  const { isOpen, close } = useUploadModal();
  const { open: openLogin } = useAuthModal();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [step, setStep] = useState<Step>('idle');
  const [msg, setMsg] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [richError, setRichError] = useState<React.ReactNode | null>(null);
  const [myGrade, setMyGrade] = useState<UserGrade>('basic');
  const [isNarrow, setIsNarrow] = useState(false); // ≤360px 화면 대응

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultTitle = useMemo(() => {
    if (!file) return '';
    return filenameWithoutExt(file.name).slice(0, TITLE_MAX);
  }, [file]);

  // 매우 좁은 화면 감지
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 360px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setTitle('');
    setStep('idle');
    setMsg('');
    setProgress(0);
    setRichError(null);

    const me = typeof window !== 'undefined' ? loadUserProfile() : null;
    setMyGrade(coerceUserGrade(me?.userGrade));

    return () => {
      xhrRef.current?.abort();
      xhrRef.current = null;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollTimer.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!file) return;
    setTitle(prev => (prev.trim().length ? prev : defaultTitle));
  }, [file, defaultTitle]);

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
        openLogin('login');
        return;
      }

      setStep('presign');
      setMsg('업로드 준비 중…');
      setRichError(null);

      const trimmedTitle = title.trim();
      const p = await presignUpload(
        file.name,
        file.type || undefined,
        trimmedTitle || undefined,
        file.size
      );

      const url = (p as any).url ?? (p as any).uploadUrl;
      const headers: Record<string, string> = (p as any).headers ?? {};
      const key: string = (p as any).key;
      const mediaId: string = (p as any).mediaId;
      if (!url || !key || !mediaId)
        throw new Error('Presign 응답이 올바르지 않습니다.');

      setStep('uploading');
      setMsg('파일 업로드 중…');
      await putWithProgress(
        url,
        headers,
        file,
        pct => setProgress(pct),
        xhrRef
      );

      setStep('completing');
      setMsg('서버에 업로드 완료 알림…');
      await completeUpload(mediaId, key, file.size);

      setStep('waiting');
      setMsg('처리 대기 중…');
      await delay(WARMUP_MS);

      setStep('polling');
      setMsg('미디어 처리 중… 서버와 동기화되고 있어요.');
      await pollStatus(mediaId, INTERVAL_MS, TIMEOUT_MS, pollTimer);

      setStep('done');
      setMsg('완료! 피드에서 확인할 수 있어요.');

      // NEW: 업로드 성공 알림 이벤트 발행 (mediaId 포함)
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(
            new CustomEvent('media:uploaded', { detail: { mediaId } })
          );
        } catch {
          // 일부 브라우저 호환
          window.dispatchEvent(new Event('media:uploaded'));
        }
      }

      close();
    } catch (e: any) {
      const status: number | undefined =
        e?.response?.status ?? e?.status ?? e?.code;
      const serverMsg: string =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        '업로드 중 오류가 발생했습니다.';

      const isFileTooLarge =
        status === 413 || /too\s*large|FILE_TOO_LARGE/i.test(serverMsg);
      const isDailyExceeded =
        status === 403 ||
        /일일\s*업로드\s*한도|max\s*per\s*day|한도를\s*초과/i.test(serverMsg);

      if (isFileTooLarge) {
        const label = GRADE_LABEL[myGrade];
        const maxMB = GRADE_MAX_MB[myGrade];
        setStep('error');
        setMsg('');
        setRichError(
          <span>
            파일 크기가 <b style={{ color: ACCENT }}>{label}</b> 등급 한도{' '}
            <b style={{ color: ACCENT }}>{maxMB}MB</b> 를 초과했습니다.
          </span>
        );
      } else if (isDailyExceeded) {
        const label = GRADE_LABEL[myGrade];
        const maxCnt = GRADE_MAX_PER_DAY[myGrade];
        setStep('error');
        setMsg('');
        setRichError(
          <span>
            오늘은 <b style={{ color: ACCENT }}>{label}</b> 등급 일일 업로드 수{' '}
            <b style={{ color: ACCENT }}>{maxCnt}개</b>를 초과했습니다.
          </span>
        );
      } else if (e?.__status === 'FAILED') {
        setStep('failed');
        setMsg('처리 실패. 파일을 다시 시도해 주세요.');
        setRichError(null);
      } else {
        setStep('error');
        setMsg(serverMsg);
        setRichError(null);
      }
    } finally {
      xhrRef.current = null;
    }
  };

  const cancelAll = () => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
    setRichError(null);
    close();
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-[9999] grid place-items-center'
    >
      {/* 오버레이 */}
      <div
        className='fixed inset-0 z-[9998] bg-black/70'
        onClick={cancelAll}
        aria-hidden
      />

      {/* 카드 */}
      <div
        className='relative z-[9999] overflow-y-auto border border-white/10 bg-neutral-950 text-white shadow-2xl'
        onClick={e => e.stopPropagation()}
        style={{
          width: 'clamp(220px, 88vw, 560px)',
          maxHeight: '92vh',
          borderRadius: 'clamp(12px, 3.5vw, 18px)',
        }}
      >
        {/* 헤더 */}
        <div
          className='relative'
          style={{
            paddingInline: 'clamp(12px, 4.5vw, 24px)',
            paddingBlock: 'clamp(8px, 3.2vw, 18px)',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
            background:
              'linear-gradient(180deg, rgba(90,49,159,0.28) 0%, rgba(90,49,159,0.06) 100%)',
          }}
        >
          <h2
            className='text-center font-bold'
            style={{ fontSize: 'clamp(16px, 5vw, 22px)' }}
          >
            <span style={{ color: ACCENT }}>Catarie</span> 업로드
          </h2>
          <button
            type='button'
            onClick={cancelAll}
            aria-label='닫기'
            className='absolute text-white/75 hover:text-white transition-colors'
            style={{
              right: 'clamp(6px, 2.6vw, 12px)',
              top: 'clamp(4px, 2.2vw, 10px)',
              fontSize: 'clamp(16px, 6vw, 22px)',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div
          style={{
            paddingInline: 'clamp(12px, 4.5vw, 24px)',
            paddingBlock: 'clamp(10px, 4.2vw, 22px)',
          }}
        >
          <p
            className='text-white/60'
            style={{ fontSize: 'clamp(10px, 3.2vw, 12px)' }}
          >
            현재 등급: <b style={{ color: ACCENT }}>{GRADE_LABEL[myGrade]}</b>
            <br />
            일일 한도:{' '}
            <b style={{ color: ACCENT }}>{GRADE_MAX_PER_DAY[myGrade]}개</b> ·
            일일 용량 제한:{' '}
            <b style={{ color: ACCENT }}>{GRADE_MAX_MB[myGrade]}MB</b>
          </p>

          {/* 제목 */}
          <div style={{ marginTop: 'clamp(8px, 3.4vw, 14px)' }}>
            <label
              className='block text-white/70'
              style={{
                fontSize: 'clamp(11px, 3.4vw, 14px)',
                marginBottom: '6px',
              }}
            >
              제목 (기본: 파일이름)
            </label>
            <div
              className='flex items-center gap-2 rounded-xl border bg-white/5'
              style={{
                borderColor: 'rgba(255,255,255,0.15)',
                paddingInline: 'clamp(8px, 3.6vw, 12px)',
                paddingBlock: 'clamp(6px, 2.6vw, 10px)',
                minWidth: 0,
              }}
            >
              <input
                type='text'
                className='flex-1 bg-transparent outline-none'
                style={{ fontSize: 'clamp(12px, 3.6vw, 15px)', minWidth: 0 }}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder={defaultTitle || '제목을 입력하세요'}
              />
              <span
                className='text-white/50'
                style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}
              >
                {title.length}/{TITLE_MAX}
              </span>
            </div>
          </div>

          {/* 드롭존 */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
            className='rounded-xl border border-dashed text-center'
            style={{
              marginTop: 'clamp(10px, 3.8vw, 16px)',
              padding: 'clamp(12px, 4.4vw, 22px)',
              borderColor: 'rgba(255,255,255,0.25)',
              background:
                'linear-gradient(135deg, rgba(90,49,159,0.10), rgba(255,255,255,0.04))',
            }}
          >
            {!file ? (
              <>
                <p
                  className='text-white/85'
                  style={{ fontSize: 'clamp(12px, 3.6vw, 15px)' }}
                >
                  여기에 드래그 앤 드롭하거나, 아래 버튼으로 파일을 선택하세요.
                </p>
                <p
                  className='text-white/55'
                  style={{
                    fontSize: 'clamp(10px, 3.2vw, 12px)',
                    marginTop: '4px',
                  }}
                >
                  동영상 / 오디오 파일을 지원합니다.
                </p>
                <label
                  className='inline-block font-semibold cursor-pointer'
                  style={{
                    display: 'inline-block',
                    marginTop: 'clamp(8px, 3.6vw, 14px)',
                    paddingInline: 'clamp(10px, 4vw, 16px)',
                    paddingBlock: 'clamp(8px, 2.6vw, 10px)',
                    borderRadius: '12px',
                    backgroundColor: ACCENT,
                    fontSize: 'clamp(12px, 3.6vw, 15px)',
                  }}
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
                <div
                  className='text-white/90 break-all'
                  style={{ fontSize: 'clamp(11px, 3.4vw, 14px)' }}
                >
                  선택됨: {file.name}{' '}
                  <span className='text-white/50'>
                    ({fmtBytes(file.size)}, {file.type || 'unknown'})
                  </span>
                </div>

                {step === 'uploading' && (
                  <div style={{ marginTop: 'clamp(8px, 3.4vw, 12px)' }}>
                    <div
                      className='w-full rounded bg-white/10 overflow-hidden'
                      style={{ height: 'clamp(6px, 1.8vw, 8px)' }}
                    >
                      <div
                        className='h-full rounded'
                        style={{
                          width: `${Math.round(progress)}%`,
                          backgroundColor: ACCENT,
                        }}
                      />
                    </div>
                    <div
                      className='text-white/65'
                      style={{
                        fontSize: 'clamp(10px, 3vw, 12px)',
                        marginTop: '6px',
                      }}
                    >
                      {Math.round(progress)}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 액션 버튼 */}
          <div
            className='flex items-center'
            style={{
              marginTop: 'clamp(10px, 3.8vw, 16px)',
              gap: 'clamp(6px, 2vw, 10px)',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={startUpload}
              disabled={
                !file ||
                step === 'uploading' ||
                step === 'completing' ||
                step === 'waiting' ||
                step === 'polling'
              }
              className='font-semibold disabled:opacity-50'
              style={{
                flex: isNarrow ? '1 0 100%' : '0 0 auto',
                paddingInline: 'clamp(12px, 4vw, 16px)',
                paddingBlock: 'clamp(9px, 2.8vw, 11px)',
                borderRadius: '12px',
                backgroundColor: ACCENT,
                fontSize: 'clamp(12px, 3.6vw, 15px)',
              }}
            >
              업로드 시작
            </button>
          </div>

          {/* 상태 문구 */}
          {(richError || msg) && (
            <div
              className={richError ? 'text-red-300' : 'text-white/80'}
              style={{
                marginTop: 'clamp(8px, 3.2vw, 14px)',
                fontSize: 'clamp(11px, 3.2vw, 13px)',
                textAlign: 'center',
              }}
            >
              {richError ? richError : msg}
            </div>
          )}

          {(step === 'done' || step === 'failed' || step === 'error') && (
            <div style={{ marginTop: 'clamp(10px, 3.8vw, 16px)' }}>
              <button
                onClick={cancelAll}
                className='font-semibold'
                style={{
                  paddingInline: 'clamp(12px, 4vw, 16px)',
                  paddingBlock: 'clamp(9px, 2.8vw, 11px)',
                  borderRadius: '12px',
                  backgroundColor: ACCENT,
                  fontSize: 'clamp(12px, 3.6vw, 15px)',
                }}
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* helpers */

function delay(ms: number) {
  return new Promise<void>(res => setTimeout(res, ms));
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null>
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open('PUT', url, true);
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream'
    );
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === 'content-length') continue;
      xhr.setRequestHeader(k, v as string);
    }

    xhr.upload.onprogress = e => {
      if (!e.lengthComputable) return;
      onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 PUT 실패: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('네트워크 오류'));
    xhr.onabort = () => reject(new Error('업로드 취소됨'));

    xhr.send(file);
  });
}

async function pollStatus(
  mediaId: string,
  intervalMs: number,
  timeoutMs: number,
  pollTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
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
    } catch (e: any) {
      const status: number | undefined =
        e?.response?.status ?? e?.status ?? e?.code;
      if (
        status === 400 ||
        status === 404 ||
        status === 409 ||
        (typeof status === 'number' && status >= 500)
      ) {
        // 일시 오류 → 재시도
      } else if (e?.__status === 'FAILED') {
        throw e;
      }
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(
        '처리가 오래 걸리고 있어요. 잠시 후 피드에서 확인해 주세요.'
      );
    }

    await new Promise<void>(res => {
      const t = setTimeout(() => res(), wait);
      pollTimerRef.current = t;
    });
    wait = Math.min(Math.round(wait * 1.5), MAX_WAIT);
  }
}
