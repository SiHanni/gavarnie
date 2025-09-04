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
    // ESC로 닫기
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
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

      // 토큰 저장 → 프로필 로드 → 전역 이벤트
      storeToken(r.accessToken);
      const me = await fetchProfile();
      saveUserProfile(me);
      window.dispatchEvent(new CustomEvent('auth:login', { detail: me }));
      close();
    } catch (e: any) {
      // 서버에서 에러 본문을 내려줄 수도 있으니 메세지 최대한 노출
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
        className='relative z-[9999] w-[min(560px,92vw)] max-h-[92vh] overflow-y-auto
                   rounded-2xl border border-white/10 bg-neutral-950/90
                   shadow-[0_10px_40px_rgba(0,0,0,0.6)]
                   p-0'
      >
        {/* 상단 헤더(그라디언트) */}
        <div
          className='relative px-6 py-5 rounded-t-2xl
                        bg-[linear-gradient(180deg,rgba(90,49,159,0.3)_0%,rgba(90,49,159,0.05)_100%)]
                        border-b border-white/10'
        >
          <h2 className='text-2xl font-extrabold text-white text-center'>
            {title}
          </h2>

          {/* 닫기 */}
          <button
            type='button'
            onClick={close}
            aria-label='닫기'
            className='absolute right-3 top-3 text-2xl leading-none
                       text-white/70 hover:text-white transition-colors'
          >
            ×
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className='px-6 py-6'>
          {/* 이메일 */}
          <label className='block'>
            <span className='text-sm text-white/80'>이메일</span>
            <input
              className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70
                         px-3 py-2 outline-none text-white caret-white
                         focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]
                         placeholder:text-white/40'
              type='email'
              inputMode='email'
              autoComplete='email'
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder='you@example.com'
            />
          </label>

          {/* 비밀번호 */}
          <label className='block mt-4'>
            <span className='text-sm text-white/80'>비밀번호</span>
            <div className='relative'>
              <input
                className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70
                           px-3 py-2 pr-10 outline-none text-white caret-white
                           focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]
                           placeholder:text-white/40'
                type={showPw ? 'text' : 'password'}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••'
              />
              <button
                type='button'
                onClick={() => setShowPw(s => !s)}
                className='absolute right-2 top-1/2 -translate-y-1/2
                           text-white/60 hover:text-white text-sm px-2 py-1'
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
              >
                {showPw ? '숨김' : '표시'}
              </button>
            </div>
          </label>

          {/* 표시 이름(회원가입 모드에서만) */}
          {mode === 'signup' && (
            <label className='block mt-4'>
              <span className='text-sm text-white/80'>표시 이름</span>
              <input
                className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70
                           px-3 py-2 outline-none text-white caret-white
                           focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]
                           placeholder:text-white/40'
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder='예) Alice'
              />
            </label>
          )}

          {/* 에러 배너 */}
          {err && (
            <div className='mt-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-3 py-2'>
              {err}
            </div>
          )}

          {/* 액션 버튼 */}
          <button
            type='submit'
            disabled={loading}
            className='w-full mt-6 py-3 rounded-xl font-semibold
                       bg-[#5a319f] hover:brightness-110
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-all'
          >
            {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입'}
          </button>

          {/* 약관/고지 (ENV로 노출/비노출 제어) */}
          {!!ENV.AUTH_DISCLAIMER && (
            <p className='mt-3 text-[12px] leading-5 text-white/60'>
              {ENV.AUTH_DISCLAIMER}
            </p>
          )}

          {/* 모드 전환 */}
          <p className='mt-5 text-sm text-white/80 text-center'>
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
