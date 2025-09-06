'use client';

import { useEffect, useState } from 'react';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { ENV } from '@/lib/env';
import { login, signUp, storeToken, fetchProfile } from '@/lib/http';
import { saveUserProfile } from '@/lib/user';

export default function AuthModal() {
  const { isOpen, close, mode, setMode } = useAuthModal();

  // 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // UI 상태
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  // 열릴 때마다 초기화
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setDisplayName('');
      setErr(null);
      setLoading(false);
      setShowPw(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const title =
    mode === 'login' ? `${ENV.APP_NAME}에 로그인` : `${ENV.APP_NAME} 가입`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const r =
        mode === 'login'
          ? await login(email, password)
          : await signUp(email, password, displayName);

      storeToken(r.accessToken);
      const me = await fetchProfile();
      saveUserProfile(me);
      window.dispatchEvent(new CustomEvent('auth:login', { detail: me }));
      close();
    } catch (e: any) {
      setErr(
        e?.response?.data?.message ||
          e?.message ||
          '요청을 처리하지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-[9999] grid place-items-center'
    >
      {/* 백드롭 */}
      <div
        className='fixed inset-0 z-[9998] bg-black/70'
        onClick={close}
        aria-hidden='true'
      />

      {/* 패널 */}
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className='relative z-[9999] max-h-[92vh] overflow-y-auto border border-white/10
                   bg-neutral-950/90 shadow-[0_10px_40px_rgba(0,0,0,0.6)]'
        style={{
          /* 화면이 작을수록 작고, 크게는 520~560px 사이에서 자연 확장 */
          width: 'clamp(300px, 92vw, 540px)',
          borderRadius: 'clamp(14px, 3.5vw, 18px)',
        }}
      >
        {/* 상단 헤더(그라디언트) */}
        <div
          className='relative border-b border-white/10'
          style={{
            paddingInline: 'clamp(16px, 4.5vw, 24px)',
            paddingBlock: 'clamp(10px, 3.2vw, 18px)',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
            background:
              'linear-gradient(180deg, rgba(90,49,159,0.28) 0%, rgba(90,49,159,0.06) 100%)',
          }}
        >
          <h2
            className='text-center text-white font-extrabold'
            style={{ fontSize: 'clamp(18px, 5.2vw, 24px)' }}
          >
            {title}
          </h2>

          {/* 닫기 */}
          <button
            type='button'
            onClick={close}
            aria-label='닫기'
            className='absolute text-white/75 hover:text-white transition-colors'
            style={{
              right: 'clamp(8px, 2.6vw, 12px)',
              top: 'clamp(6px, 2.2vw, 10px)',
              fontSize: 'clamp(18px, 6vw, 22px)',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* 컨텐츠 */}
        <div
          className='text-white'
          style={{
            paddingInline: 'clamp(16px, 4.5vw, 24px)',
            paddingBlock: 'clamp(14px, 4.2vw, 24px)',
          }}
        >
          {/* 이메일 */}
          <label className='block'>
            <span
              className='text-white/80'
              style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
            >
              이메일
            </span>
            <input
              className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70
                         outline-none text-white caret-white placeholder:text-white/40
                         focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]'
              type='email'
              inputMode='email'
              autoComplete='email'
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='catarie@example.com'
              style={{
                height: 'clamp(40px, 8.5vw, 46px)',
                fontSize: 'clamp(13px, 3.6vw, 15px)',
                paddingInline: 'clamp(10px, 3.6vw, 12px)',
              }}
            />
          </label>

          {/* 비밀번호 */}
          <label
            className='block'
            style={{ marginTop: 'clamp(12px, 3.6vw, 16px)' }}
          >
            <span
              className='text-white/80'
              style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
            >
              비밀번호
            </span>
            <div className='relative'>
              <input
                className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70
                           outline-none text-white caret-white placeholder:text-white/40
                           focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]'
                type={showPw ? 'text' : 'password'}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••'
                style={{
                  height: 'clamp(40px, 8.5vw, 46px)',
                  fontSize: 'clamp(13px, 3.6vw, 15px)',
                  paddingInline: 'clamp(10px, 3.6vw, 12px)',
                  paddingRight: 'clamp(40px, 10vw, 56px)',
                }}
              />
              <button
                type='button'
                onClick={() => setShowPw(s => !s)}
                className='absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white'
                style={{
                  fontSize: 'clamp(12px, 3.4vw, 14px)',
                  paddingInline: 'clamp(4px, 1.6vw, 8px)',
                  paddingBlock: '2px',
                }}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
              >
                {showPw ? '숨김' : '표시'}
              </button>
            </div>
          </label>

          {/* 표시 이름(회원가입 모드에서만) */}
          {mode === 'signup' && (
            <label
              className='block'
              style={{ marginTop: 'clamp(12px, 3.6vw, 16px)' }}
            >
              <span
                className='text-white/80'
                style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
              >
                표시 이름
              </span>
              <input
                className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70
                           outline-none text-white caret-white placeholder:text-white/40
                           focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]'
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder='예) Alice'
                style={{
                  height: 'clamp(40px, 8.5vw, 46px)',
                  fontSize: 'clamp(13px, 3.6vw, 15px)',
                  paddingInline: 'clamp(10px, 3.6vw, 12px)',
                }}
              />
            </label>
          )}

          {/* 에러 배너 */}
          {err && (
            <div
              className='rounded-lg border border-red-500/30 bg-red-500/10 text-red-300'
              style={{
                marginTop: 'clamp(10px, 3vw, 14px)',
                fontSize: 'clamp(12px, 3.2vw, 13px)',
                padding: 'clamp(8px, 2.6vw, 10px)',
              }}
            >
              {err}
            </div>
          )}

          {/* 액션 버튼 */}
          <button
            type='submit'
            disabled={loading}
            className='w-full rounded-xl font-semibold bg-[#5a319f] hover:brightness-110
                       disabled:opacity-60 disabled:cursor-not-allowed transition-all'
            style={{
              height: 'clamp(44px, 9vw, 54px)',
              marginTop: 'clamp(16px, 4.6vw, 20px)',
              fontSize: 'clamp(14px, 4vw, 16px)',
            }}
          >
            {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입'}
          </button>

          {/* 약관/고지 */}
          {!!ENV.AUTH_DISCLAIMER && (
            <p
              className='text-white/60'
              style={{
                marginTop: 'clamp(10px, 3.4vw, 14px)',
                fontSize: 'clamp(11px, 3.2vw, 12px)',
                lineHeight: 1.5,
              }}
            >
              {ENV.AUTH_DISCLAIMER}
            </p>
          )}

          {/* 모드 전환 */}
          <p
            className='text-center text-white/80'
            style={{
              marginTop: 'clamp(14px, 4.8vw, 20px)',
              fontSize: 'clamp(12px, 3.4vw, 14px)',
            }}
          >
            {mode === 'login' ? (
              <>
                계정이 없으신가요?{' '}
                <button
                  type='button'
                  onClick={() => setMode('signup')}
                  className='text-[#c8b3ff] hover:text-white underline underline-offset-4'
                >
                  가입
                </button>
              </>
            ) : (
              <>
                이미 계정이 있으신가요?{' '}
                <button
                  type='button'
                  onClick={() => setMode('login')}
                  className='text-[#c8b3ff] hover:text-white underline underline-offset-4'
                >
                  로그인
                </button>
              </>
            )}
          </p>
        </div>
      </form>
    </div>
  );
}
