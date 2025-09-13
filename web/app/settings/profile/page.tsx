'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchProfile,
  updateMyProfile,
  avatarsPresign,
  avatarsComplete,
} from '@/lib/http';
import { saveUserProfile, type UserProfile } from '@/lib/user';
import { useRouter } from 'next/navigation';

const ACCENT = '#5a319f';

export default function EditProfileModal() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(''); // 서버에 저장되는 최종 URL
  const [statusMessage, setStatusMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 업로드 관련
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const [myHandle, setMyHandle] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 프리뷰 캐시버스터
  const [previewNonce, setPreviewNonce] = useState<number>(0);

  // 모달 포커스는 "카드 래퍼"에만 한 번 부여
  const dialogRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchProfile();
        setDisplayName(me.displayName ?? '');
        setAvatarUrl(me.avatarUrl ?? '');
        setStatusMessage(me.statusMessage ?? '');
        setMyHandle(me.handle ?? null);
        setPreviewNonce(Date.now());
      } catch (e: any) {
        setErr(e?.message || '프로필 정보를 불러오지 못했습니다.');
      }
    })();
  }, []);

  // 스크롤 복원 끄기 + 포커스 한 번만, 스크롤 없이
  useEffect(() => {
    const prev = (history as any).scrollRestoration;
    try {
      history.scrollRestoration = 'manual';
    } catch {}

    const raf = requestAnimationFrame(() => {
      const alreadyInside =
        dialogRef.current && dialogRef.current.contains(document.activeElement);
      if (!alreadyInside) {
        dialogRef.current?.focus({ preventScroll: true });
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      try {
        history.scrollRestoration = prev ?? 'auto';
      } catch {}
    };
  }, []);

  // ESC로 닫기 (기존 흐름 유지)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 파일 선택
  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async e => {
    const f = e.target.files?.[0] ?? null;
    setUploadErr(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith('image/')) {
      setUploadErr('이미지 파일만 선택해 주세요.');
      e.target.value = '';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadErr('이미지는 5MB 이하만 업로드할 수 있어요.');
      e.target.value = '';
      return;
    }

    setFile(f);

    // 선택 즉시 업로드 (presign → PUT → complete)
    try {
      setUploading(true);

      const presign = await avatarsPresign({
        contentType: f.type || undefined,
        fileSize: f.size,
        originalFilename: f.name,
      });

      const put = await fetch(presign.url, {
        method: presign.method,
        headers: presign.headers,
        body: await f.arrayBuffer(),
      });
      if (!put.ok) throw new Error(`업로드 실패(${put.status})`);

      const done = await avatarsComplete(presign.key);

      // 서버에서 확정한 최종 URL을 상태에 반영
      setAvatarUrl(done.avatarUrl);

      // 미리보기는 캐시를 강제로 우회해서 즉시 반영
      setPreviewNonce(Date.now());

      // 인풋 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFile(null);
    } catch (e: any) {
      const status: number | undefined =
        e?.response?.status ?? e?.status ?? e?.code;

      if (status === 429 || status === 400) {
        setUploadErr('너무 자주 변경하셨어요. 10초 뒤 다시 시도해주세요.');
      } else {
        setUploadErr(e?.message || '이미지 업로드에 실패했어요.');
      }
    } finally {
      setUploading(false);
    }
  };

  const clearSelected = () => {
    setFile(null);
    setUploadErr(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 프리뷰 src: avatarUrl + 캐시버스터
  const previewSrc = useMemo(() => {
    if (!avatarUrl) return '';
    const join = avatarUrl.includes('?') ? '&' : '?';
    return `${avatarUrl}${join}t=${previewNonce}`;
  }, [avatarUrl, previewNonce]);

  const closeModal = () => {
    if (myHandle && myHandle.trim()) router.push(`/@${myHandle}`);
    else router.push('/');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await updateMyProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl?.trim() || null,
        statusMessage: statusMessage.trim() || null,
      });

      const normalized: UserProfile = {
        ...res,
        handle: res.handle ?? undefined,
      };
      saveUserProfile(normalized);
      window.dispatchEvent(
        new CustomEvent('auth:login', { detail: normalized })
      );
      closeModal();
    } catch (e: any) {
      setErr(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-[9999] grid place-items-center'
    >
      {/* 오버레이 */}
      <div
        className='fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm'
        onClick={closeModal}
        aria-hidden
      />

      {/* 모달 카드 (tabIndex로 포커스 가능하게) */}
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={submit}
        className='relative z-[9999] overflow-hidden border border-white/10 bg-neutral-950 text-white shadow-2xl'
        onClick={e => e.stopPropagation()}
        style={{
          // ✅ 모바일(270px 폭)에서도 넘치지 않게 최소폭 낮춤
          width: 'clamp(240px, 92vw, 560px)',
          maxHeight: '92vh',
          borderRadius: 'clamp(12px, 3.5vw, 18px)',
        }}
      >
        {/* 헤더: 동일 그라데이션 */}
        <div
          className='relative'
          style={{
            paddingInline: 'clamp(12px, 4.5vw, 22px)',
            paddingBlock: 'clamp(8px, 3vw, 16px)',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
            background:
              'linear-gradient(180deg, rgba(90,49,159,0.28) 0%, rgba(90,49,159,0.06) 100%)',
          }}
        >
          <h2
            className='text-center font-extrabold'
            style={{ fontSize: 'clamp(16px, 4.6vw, 22px)' }}
          >
            프로필 편집
          </h2>

          <button
            type='button'
            aria-label='닫기'
            onClick={closeModal}
            className='absolute text-white/75 hover:text-white transition-colors'
            style={{
              right: 'clamp(6px, 2.4vw, 12px)',
              top: 'clamp(6px, 2.2vw, 10px)',
              fontSize: 'clamp(18px, 6vw, 22px)',
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
            paddingInline: 'clamp(12px, 4.2vw, 22px)',
            paddingBlock: 'clamp(12px, 4vw, 20px)',
          }}
        >
          {/* 닉네임 */}
          <label className='block'>
            <span
              className='text-white/70'
              style={{ fontSize: 'clamp(12px, 3.2vw, 14px)' }}
            >
              닉네임
            </span>
            <input
              className='mt-1 w-full rounded-xl bg-neutral-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/60'
              style={{
                paddingInline: 'clamp(10px, 3.4vw, 12px)',
                paddingBlock: 'clamp(8px, 2.4vw, 10px)',
                fontSize: 'clamp(13px, 3.4vw, 15px)',
              }}
              value={displayName}
              maxLength={50}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          </label>

          {/* 프로필 이미지 */}
          <div style={{ marginTop: 'clamp(10px, 3.4vw, 16px)' }}>
            <span
              className='text-white/70'
              style={{ fontSize: 'clamp(12px, 3.2vw, 14px)' }}
            >
              프로필 이미지
            </span>

            <div className='mt-2 flex items-center gap-3'>
              {/* 미리보기 */}
              <div
                className='rounded-full overflow-hidden border border-white/10 bg-neutral-800 shrink-0'
                style={{
                  width: 'clamp(36px, 11vw, 80px)',
                  height: 'clamp(36px, 11vw, 80px)',
                }}
              >
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSrc}
                    alt='미리보기'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <div
                    className='w-full h-full grid place-items-center text-white/40'
                    style={{ fontSize: 'clamp(10px, 3vw, 12px)' }}
                  >
                    No Image
                  </div>
                )}
              </div>

              {/* 액션 */}
              <div className='flex-1'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='image/*'
                    capture='environment'
                    onChange={onPickFile}
                    className='hidden'
                  />
                  <button
                    type='button'
                    onClick={() => fileInputRef.current?.click()}
                    className='font-semibold disabled:opacity-50'
                    disabled={uploading}
                    style={{
                      paddingInline: 'clamp(10px, 3.6vw, 16px)',
                      paddingBlock: 'clamp(7px, 2.4vw, 10px)',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      fontSize: 'clamp(12px, 3.2vw, 14px)',
                    }}
                  >
                    {uploading ? '업로드 중…' : '파일 선택'}
                  </button>

                  {file && !uploading && (
                    <button
                      type='button'
                      onClick={clearSelected}
                      className='font-semibold'
                      style={{
                        paddingInline: 'clamp(9px, 3.2vw, 14px)',
                        paddingBlock: 'clamp(7px, 2.4vw, 10px)',
                        borderRadius: '12px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255,255,255,0.16)',
                        fontSize: 'clamp(12px, 3.2vw, 14px)',
                      }}
                    >
                      선택 해제
                    </button>
                  )}
                </div>

                {/* 파일 안내/에러 */}
                <div
                  className='mt-1 text-white/60 break-all'
                  style={{ fontSize: 'clamp(11px, 3vw, 12px)' }}
                >
                  {file
                    ? `${file.name} (${Math.round(file.size / 1024)} KB)`
                    : avatarUrl
                      ? '이미 등록된 프로필 이미지가 있어요.'
                      : '이미지를 선택하면 자동으로 업로드됩니다.'}
                </div>
                {uploadErr && (
                  <div
                    className='mt-1 text-red-400'
                    style={{ fontSize: 'clamp(11px, 3vw, 12px)' }}
                  >
                    {uploadErr}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 상태 메시지 */}
          <label
            style={{ display: 'block', marginTop: 'clamp(10px, 3.4vw, 16px)' }}
          >
            <span
              className='text-white/70'
              style={{ fontSize: 'clamp(12px, 3.2vw, 14px)' }}
            >
              상태 메시지
            </span>
            <textarea
              className='mt-1 w-full rounded-xl bg-neutral-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/60'
              style={{
                paddingInline: 'clamp(10px, 3.4vw, 12px)',
                paddingBlock: 'clamp(8px, 2.4vw, 10px)',
                fontSize: 'clamp(13px, 3.4vw, 15px)',
              }}
              value={statusMessage}
              onChange={e => setStatusMessage(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder=''
            />
            <div
              className='text-white/50'
              style={{ fontSize: 'clamp(11px, 3vw, 12px)', marginTop: 4 }}
            >
              {statusMessage.length}/200
            </div>
          </label>

          {/* 에러 */}
          {err && (
            <p
              className='text-red-400'
              style={{ marginTop: 10, fontSize: 'clamp(12px, 3vw, 13px)' }}
            >
              {err}
            </p>
          )}

          {/* 액션: 한 줄 [저장][취소] */}
          <div
            className='flex items-center'
            style={{
              marginTop: 'clamp(12px, 3.6vw, 18px)',
              gap: 'clamp(6px, 2vw, 10px)',
              paddingBottom: 'clamp(4px, 2.4vw, 8px)', // ✅ 작은 화면에서 마지막 버튼이 가리지 않게
            }}
          >
            <button
              type='submit'
              disabled={saving || uploading}
              className='font-semibold disabled:opacity-50'
              style={{
                flex: 1,
                paddingInline: 'clamp(12px, 3.6vw, 16px)',
                paddingBlock: 'clamp(9px, 2.6vw, 11px)',
                borderRadius: '12px',
                backgroundColor: ACCENT,
                fontSize: 'clamp(13px, 3.4vw, 15px)',
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type='button'
              onClick={closeModal}
              className='border'
              style={{
                flex: 1,
                paddingInline: 'clamp(10px, 3.4vw, 14px)',
                paddingBlock: 'clamp(9px, 2.6vw, 11px)',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.2)',
                fontSize: 'clamp(13px, 3.4vw, 15px)',
              }}
            >
              취소
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
