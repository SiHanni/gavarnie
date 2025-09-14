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
  const [avatarUrl, setAvatarUrl] = useState(''); // 서버가 주는 "버전 포함" 최종 URL
  const [statusMessage, setStatusMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 업로드 관련
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const [myHandle, setMyHandle] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 최초 서버 값(버튼 노출 판단용)
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string>('');

  // 모달 포커스
  const dialogRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchProfile();
        setDisplayName(me.displayName ?? '');
        setAvatarUrl(me.avatarUrl ?? '');
        setInitialAvatarUrl(me.avatarUrl ?? '');
        setStatusMessage(me.statusMessage ?? '');
        setMyHandle(me.handle ?? null);
      } catch (e: any) {
        setErr(e?.message || '프로필 정보를 불러오지 못했습니다.');
      }
    })();
  }, []);

  // 스크롤 복원/포커스
  useEffect(() => {
    const prev = (history as any).scrollRestoration;
    try {
      history.scrollRestoration = 'manual';
    } catch {}
    const raf = requestAnimationFrame(() => {
      const inside =
        dialogRef.current?.contains(document.activeElement) ?? false;
      if (!inside) dialogRef.current?.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      try {
        history.scrollRestoration = prev ?? 'auto';
      } catch {}
    };
  }, []);

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /**
   * 변경사항:
   * - 서버 complete()가 DB에 최신 버전 URL을 이미 저장하므로,
   *   여기서 따로 updateMyProfile({ avatarUrl })를 호출하지 않습니다.
   * - complete()의 avatarUrl(버전 포함 경로)을 그대로 사용합니다. (쿼리스트링 캐시버스터 제거)
   */
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

    try {
      setUploading(true);

      // 1) presign
      const presign = await avatarsPresign({
        contentType: f.type || undefined,
        fileSize: f.size,
        originalFilename: f.name,
      }); // { url, method:'PUT', headers, key, publicUrl? }

      // 2) S3 PUT (presign.headers 그대로, 바디는 Blob)
      const headers: Record<string, string> = { ...(presign.headers || {}) };
      const hasCT = Object.keys(headers).some(
        k => k.toLowerCase() === 'content-type'
      );
      if (!hasCT && f.type) headers['Content-Type'] = f.type;

      const put = await fetch(presign.url, {
        method: presign.method || 'PUT',
        headers,
        body: f, // ✅ Blob
      });

      if (!put.ok) {
        const text = await safeReadText(put);
        throw new Error(
          `S3 업로드 실패 ${put.status}${text ? `: ${text}` : ''}`
        );
      }

      // 3) 완료 통지 → 서버가 최종 경로(버전 포함 avatarUrl)를 돌려줌
      const done = await avatarsComplete(presign.key);
      const canonicalUrl = done.avatarUrl || presign.publicUrl || '';

      // 4) 로컬 상태/캐시 갱신 (DB는 서버에서 이미 반영됨)
      setAvatarUrl(canonicalUrl);
      setInitialAvatarUrl(canonicalUrl);

      // 로컬 프로필 캐시도 즉시 갱신하여 헤더/프로필 등 반영
      const normalized: UserProfile = {
        // 서버 DB에는 이미 반영되었으나, 로컬 캐시/이벤트로 즉시 UI 동기화
        displayName,
        statusMessage,
        avatarUrl: canonicalUrl,
        handle: myHandle ?? undefined,
      } as any;
      saveUserProfile(normalized);
      window.dispatchEvent(
        new CustomEvent('auth:login', { detail: normalized })
      );

      // 인풋 초기화
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFile(null);
    } catch (e: any) {
      setUploadErr(e?.message || '이미지 업로드에 실패했어요.');
      console.error('[AvatarUploadError]', e);
    } finally {
      setUploading(false);
    }
  };

  const clearSelected = () => {
    setFile(null);
    setUploadErr(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** 기본 이미지(= null)로 즉시 전환 (DB 반영) */
  const onClickDefaultAvatar = async () => {
    if (uploading) return;
    try {
      setUploading(true);
      const updated = await updateMyProfile({ avatarUrl: null });
      setAvatarUrl('');
      setInitialAvatarUrl('');
      clearSelected();

      const normalized: UserProfile = {
        ...updated,
        avatarUrl: undefined,
        handle: updated.handle ?? undefined,
      };
      saveUserProfile(normalized);
      window.dispatchEvent(
        new CustomEvent('auth:login', { detail: normalized })
      );
    } catch (e: any) {
      setUploadErr(e?.message || '기본 이미지로 전환에 실패했어요.');
    } finally {
      setUploading(false);
    }
  };

  // 프리뷰 src:
  // 버전 포함 URL이므로 추가 캐시버스터가 필요 없습니다.
  const previewSrc = useMemo(() => avatarUrl || '', [avatarUrl]);

  const closeModal = () => {
    if (myHandle && myHandle.trim()) router.push(`/@${myHandle}`);
    else router.push('/');
  };

  // 저장 버튼: 닉네임/상태메시지만 처리(아바타는 업로드 완료 시점에 이미 반영)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await updateMyProfile({
        displayName: displayName.trim(),
        statusMessage: statusMessage.trim() || null,
      });

      const normalized: UserProfile = {
        ...res,
        avatarUrl: res.avatarUrl || undefined,
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

  const hasAnyAvatar = Boolean(initialAvatarUrl || avatarUrl);

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

      {/* 모달 카드 */}
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={submit}
        className='relative z-[9999] overflow-hidden border border-white/10 bg-neutral-950 text-white shadow-2xl'
        onClick={e => e.stopPropagation()}
        style={{
          width: 'clamp(240px, 92vw, 560px)',
          maxHeight: '92vh',
          borderRadius: 'clamp(12px, 3.5vw, 18px)',
        }}
      >
        {/* 헤더 */}
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

                  {/* 기존/현재 아바타가 있을 때만 노출 */}
                  {hasAnyAvatar && !uploading && (
                    <button
                      type='button'
                      onClick={onClickDefaultAvatar}
                      className='font-semibold'
                      title='기본 이미지로 되돌리기'
                      style={{
                        paddingInline: 'clamp(9px, 3.2vw, 14px)',
                        paddingBlock: 'clamp(7px, 2.4vw, 10px)',
                        borderRadius: '12px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255,255,255,0.16)',
                        fontSize: 'clamp(12px, 3.2vw, 14px)',
                      }}
                    >
                      기본 이미지
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

          {/* 액션 */}
          <div
            className='flex items-center'
            style={{
              marginTop: 'clamp(12px, 3.6vw, 18px)',
              gap: 'clamp(6px, 2vw, 10px)',
              paddingBottom: 'clamp(4px, 2.4vw, 8px)',
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

/** 실패 원인 파악을 위해 응답 본문을 안전하게 읽는 헬퍼 */
async function safeReadText(res: Response) {
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text') || ct.includes('json') || ct.includes('xml')) {
      return await res.text();
    }
  } catch {}
  return '';
}
