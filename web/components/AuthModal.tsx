'use client';

import { useEffect, useState } from 'react';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { ENV } from '@/lib/env';
import { login, signUp, storeToken } from '@/lib/http';
import { setUserFromToken } from '@/lib/user';

export default function AuthModal() {
  const { isOpen, close, mode, setMode } = useAuthModal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setDisplayName('');
      setErr(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const title =
    mode === 'login' ? `${ENV.APP_NAME}에 로그인` : `${ENV.APP_NAME} 가입`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      if (mode === 'login') {
        const r = await login(email, password);
        storeToken(r.accessToken);
        const profile = setUserFromToken(r.accessToken);
        window.dispatchEvent(
          new CustomEvent('auth:login', { detail: profile })
        );
      } else {
        const r = await signUp(email, password, displayName);
        storeToken(r.accessToken);
        const profile = setUserFromToken(r.accessToken);
        window.dispatchEvent(
          new CustomEvent('auth:login', { detail: profile })
        );
      }
      close();
    } catch (e: any) {
      setErr(e?.message || '요청 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role='dialog'
      aria-modal='true'
      className='fixed inset-0 z-50 grid place-items-center'
    >
      <div className='absolute inset-0 bg-black/70' onClick={close} />
      <form
        onSubmit={submit}
        className='relative w-[min(540px,92vw)] max-h-[90vh] overflow-y-auto rounded-2xl bg-neutral-950 text-white border border-white/10 p-6'
      >
        <button
          type='button'
          onClick={close}
          aria-label='닫기'
          className='absolute right-3 top-3 text-2xl leading-none text-white/70 hover:text-white'
        >
          ×
        </button>
        <h2 className='text-2xl font-extrabold text-center'>{title}</h2>

        <div className='mt-6 space-y-3'>
          <label className='block'>
            <span className='text-sm text-white/80'>이메일</span>
            <input
              className='mt-1 w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700'
              type='email'
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </label>
          <label className='block'>
            <span className='text-sm text-white/80'>비밀번호</span>
            <input
              className='mt-1 w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700'
              type='password'
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          {mode === 'signup' && (
            <label className='block'>
              <span className='text-sm text-white/80'>표시 이름</span>
              <input
                className='mt-1 w-full px-3 py-2 rounded bg-neutral-900 border border-neutral-700'
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder='예) Alice'
              />
            </label>
          )}

          {err && <p className='text-red-400 text-sm'>{err}</p>}

          <button
            type='submit'
            disabled={loading}
            className='w-full py-2 mt-2 rounded bg-white text-black font-semibold disabled:opacity-50'
          >
            {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입'}
          </button>

          {!!ENV.AUTH_DISCLAIMER && (
            <p className='mt-3 text-[12px] leading-5 text-white/60'>
              {ENV.AUTH_DISCLAIMER}
            </p>
          )}

          <p className='mt-4 text-sm text-white/80 text-center'>
            {mode === 'login' ? (
              <>
                계정이 없으신가요?{' '}
                <button
                  type='button'
                  onClick={() => setMode('signup')}
                  className='text-white underline underline-offset-4'
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
                  className='text-white underline underline-offset-4'
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
