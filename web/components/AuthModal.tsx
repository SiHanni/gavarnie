'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { ENV } from '@/lib/env';
import {
  login,
  signUp,
  storeToken,
  fetchProfile,
  requestSignupCode,
  verifySignupCode,
} from '@/lib/http';
import { saveUserProfile, type UserProfile } from '@/lib/user';

type Step = 'email' | 'code' | 'details';
type Mode = 'login' | 'signup';

const DOMAIN_OPTIONS = [
  'gmail.com',
  'naver.com',
  'hanmail.net',
  'hotmail.com',
  'daum.net',
  'yahoo.com',
  'outlook.com',
  'nate.com',
] as const;

const LOCAL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_RE = /^(?=.{1,255}$)([A-Za-z0-9-]{1,63}\.)+[A-Za-z]{2,}$/;

export default function AuthModal() {
  const { isOpen, close, mode, setMode } = useAuthModal();

  // 이메일(분리 입력)
  const [emailLocal, setEmailLocal] = useState('');
  const [emailDomain, setEmailDomain] = useState<
    (typeof DOMAIN_OPTIONS)[number] | '직접입력'
  >('gmail.com');
  const [emailDomainCustom, setEmailDomainCustom] = useState('');

  // OTP/비밀번호/닉네임
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [step, setStep] = useState<Step>('email');

  // 자동완성 우회용
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      resetAll();
      return;
    }
    setNonce(Date.now());
    setStep(mode === 'signup' ? 'email' : 'details');
  }, [isOpen, mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const chosenDomain =
    emailDomain === '직접입력' ? emailDomainCustom.trim() : emailDomain;

  const email = useMemo(() => {
    const local = emailLocal.trim();
    const domain = chosenDomain.toLowerCase();
    return local && domain ? `${local}@${domain}` : '';
  }, [emailLocal, chosenDomain]);

  const isEmailValid = useMemo(() => {
    const [local, domain] = [
      emailLocal.trim(),
      chosenDomain.trim().toLowerCase(),
    ];
    if (!local || !domain) return false;
    if (!LOCAL_RE.test(local)) return false;
    if (!DOMAIN_RE.test(domain)) return false;
    return true;
  }, [emailLocal, chosenDomain]);

  // 비밀번호 확인 불일치 여부(가입 & details 단계에서만 보이도록)
  const pwMismatch =
    mode === 'signup' &&
    step === 'details' &&
    passwordConfirm.length > 0 &&
    password !== passwordConfirm;

  if (!isOpen) return null;

  const title =
    mode === 'login' ? `${ENV.APP_NAME}에 로그인` : `${ENV.APP_NAME} 가입`;

  function mapError(e: any): { msg: string; cooldown?: number } {
    const data = e?.response?.data || {};
    const reason = data.reason || data.error;
    switch (reason) {
      case 'invalid_email':
        return { msg: '이메일 형식이 올바르지 않습니다.' };
      case 'cooldown_email':
        return {
          msg: `이미 코드를 전송했습니다. ${data.cooldownRemainSec ?? 60}초 후에 다시 시도해 주세요.`,
          cooldown: Number(data.cooldownRemainSec ?? 60),
        };
      case 'rate_limit_ip':
        return { msg: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' };
      case 'email_send_failed':
        return { msg: '메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요.' };
      default:
        return { msg: '잠시 후 다시 시도해 주세요.' };
    }
  }

  function resetAll() {
    setEmailLocal('');
    setEmailDomain('gmail.com');
    setEmailDomainCustom('');
    setOtp('');
    setPassword('');
    setPasswordConfirm('');
    setDisplayName('');
    setErr(null);
    setLoading(false);
    setShowPw(false);
    setCooldown(0);
    setStep('email');
    setNonce(0);
  }

  // 1) 코드 요청
  const handleRequestCode = async () => {
    setErr(null);
    if (!isEmailValid) {
      setErr('이메일 형식을 확인해 주세요.');
      return;
    }
    setLoading(true);
    try {
      const r = await requestSignupCode(email);
      setCooldown(Number(r.cooldownRemainSec ?? 60));
      setStep('code');
    } catch (e: any) {
      const m = mapError(e);
      setErr(m.msg);
      if (m.cooldown) {
        setCooldown(m.cooldown);
        setStep('code');
      }
    } finally {
      setLoading(false);
    }
  };

  // 2) 코드 검증
  const handleVerifyCode = async () => {
    setErr(null);
    if (!otp || otp.length !== 6) {
      setErr('6자리 코드를 입력해 주세요.');
      return;
    }
    setLoading(true);
    try {
      await verifySignupCode(email, otp);
      setStep('details');
    } catch (e: any) {
      const data = e?.response?.data || {};
      const reason = data.reason || data.error;
      if (reason === 'invalid_code') setErr('코드가 올바르지 않습니다.');
      else if (reason === 'expired_code')
        setErr('코드 유효시간이 지났습니다. 다시 요청해 주세요.');
      else setErr('코드를 확인할 수 없어요. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  // 3) 가입/로그인 제출
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res =
        mode === 'login'
          ? await login(email, password)
          : await signUp(email, password, passwordConfirm, displayName);

      storeToken(res.accessToken);
      const me = await fetchProfile();
      const normalized: UserProfile = { ...me, handle: me.handle ?? undefined };
      saveUserProfile(normalized);
      window.dispatchEvent(
        new CustomEvent('auth:login', { detail: normalized })
      );
      close();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        '요청을 처리하지 못했습니다.';
      setErr(String(msg));
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
      {/* 어두운 배경 */}
      <div className='fixed inset-0 z-[9998] bg-black/70' aria-hidden='true' />

      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        autoComplete='off'
        className='relative z-[9999] max-h-[92vh] overflow-y-auto border border-white/10
                   bg-neutral-950/90 shadow-[0_10px_40px_rgba(0,0,0,0.6)]'
        style={{
          width: 'clamp(320px, 92vw, 560px)',
          maxWidth: 'calc(100svw - 16px)', // 극단적 소형 기기에서도 안전
          borderRadius: 'clamp(14px, 3.5vw, 18px)',
        }}
      >
        {/* 헤더 */}
        <div
          className='relative'
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

            {/* ✅ overflow 방지: flex-wrap + 유연한 너비 제어 */}
            <div
              className='mt-1 flex flex-wrap items-center gap-2'
              style={{ rowGap: 8, maxWidth: '100%' }}
            >
              {/* decoy (자동완성 회피) */}
              <input
                type='text'
                name='decoy_user'
                autoComplete='username'
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  height: 0,
                  width: 0,
                }}
                aria-hidden='true'
              />

              {/* local-part */}
              <input
                className='rounded-lg bg-neutral-900/80 border border-neutral-700/70 outline-none text-white caret-white placeholder:text-white/40
                           focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f] min-w-0'
                type='text'
                inputMode='email'
                autoComplete='off'
                name={`email_local_${nonce}`}
                required
                value={emailLocal}
                onChange={e => setEmailLocal(e.target.value)}
                placeholder=''
                style={{
                  height: 'clamp(40px, 8.5vw, 46px)',
                  fontSize: 'clamp(13px, 3.6vw, 15px)',
                  paddingInline: 'clamp(10px, 3.6vw, 12px)',
                  flex: '1 1 160px', // 기본 160px, 남으면 늘어남
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              />

              {/* @ */}
              <span className='text-white/70' style={{ flex: '0 0 auto' }}>
                @
              </span>

              {/* domain select */}
              <select
                className='rounded-lg bg-neutral-900/80 border border-neutral-700/70 outline-none text-white focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]'
                value={emailDomain}
                onChange={e => setEmailDomain(e.target.value as any)}
                style={{
                  height: 'clamp(40px, 8.5vw, 46px)',
                  fontSize: 'clamp(13px, 3.6vw, 15px)',
                  paddingInline: 'clamp(8px, 3vw, 10px)',
                }}
                name={`email_domain_${nonce}`}
              >
                {DOMAIN_OPTIONS.map(d => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value='직접입력'>직접입력</option>
              </select>

              {/* custom domain (선택 시만) */}
              {emailDomain === '직접입력' && (
                <input
                  className='rounded-lg bg-neutral-900/80 border border-neutral-700/70 outline-none text-white placeholder:text-white/40
                             focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f] min-w-0'
                  type='text'
                  autoComplete='off'
                  name={`email_domain_custom_${nonce}`}
                  required
                  value={emailDomainCustom}
                  onChange={e => setEmailDomainCustom(e.target.value)}
                  placeholder='example.com'
                  style={{
                    height: 'clamp(40px, 8.5vw, 46px)',
                    fontSize: 'clamp(13px, 3.6vw, 15px)',
                    paddingInline: 'clamp(10px, 3.6vw, 12px)',
                    flex: '1 1 170px',
                    minWidth: 120,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                />
              )}
            </div>
          </label>

          {/* (가입) 1단계 */}
          {mode === 'signup' && step === 'email' && (
            <div style={{ marginTop: 'clamp(12px, 3.6vw, 16px)' }}>
              <button
                type='button'
                onClick={handleRequestCode}
                disabled={loading || !isEmailValid}
                className='w-full rounded-xl font-semibold bg-[#5a319f] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all'
                style={{
                  height: 'clamp(44px, 9vw, 54px)',
                  fontSize: 'clamp(14px, 4vw, 16px)',
                }}
              >
                {loading ? '전송 중…' : '인증 코드 보내기'}
              </button>
              <p
                className='text-white/60'
                style={{ marginTop: 8, fontSize: 12 }}
              >
                이메일로 6자리 인증코드를 보내드립니다.
              </p>
            </div>
          )}

          {/* (가입) 2단계 */}
          {mode === 'signup' && step === 'code' && (
            <>
              <label
                className='block'
                style={{ marginTop: 'clamp(12px, 3.6vw, 16px)' }}
              >
                <span
                  className='text-white/80'
                  style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
                >
                  인증 코드
                </span>
                <input
                  className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70 outline-none text-white caret-white placeholder:text-white/40
                             focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  name={`otp_${nonce}`}
                  pattern='\d{6}'
                  maxLength={6}
                  value={otp}
                  onChange={e =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder=''
                  style={{
                    height: 'clamp(40px, 8.5vw, 46px)',
                    fontSize: 'clamp(16px, 4vw, 18px)',
                    paddingInline: 'clamp(10px, 3.6vw, 12px)',
                    letterSpacing: 4,
                  }}
                />
              </label>

              <div
                className='flex items-center gap-2'
                style={{ marginTop: 10 }}
              >
                <button
                  type='button'
                  onClick={handleVerifyCode}
                  disabled={loading || otp.length !== 6}
                  className='flex-1 rounded-xl font-semibold bg-[#5a319f] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all'
                  style={{
                    height: 'clamp(40px, 8.5vw, 46px)',
                    fontSize: 'clamp(14px, 4vw, 16px)',
                  }}
                >
                  {loading ? '확인 중…' : '코드 확인'}
                </button>

                <button
                  type='button'
                  onClick={handleRequestCode}
                  disabled={cooldown > 0 || loading}
                  className='rounded-xl border border-white/20 px-3 py-2 text-white/90 disabled:opacity-50'
                  aria-disabled={cooldown > 0}
                  title={
                    cooldown > 0 ? `재전송까지 ${cooldown}초` : '코드 재전송'
                  }
                >
                  {cooldown > 0 ? `재전송 ${cooldown}s` : '재전송'}
                </button>
              </div>

              <button
                type='button'
                onClick={() => setStep('email')}
                className='mt-2 text-white/70 underline underline-offset-4 hover:text-white'
              >
                이메일 재입력
              </button>
            </>
          )}

          {/* 로그인 또는 (가입) 3단계 */}
          {(mode === 'login' || step === 'details') && (
            <>
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
                  {/* decoy */}
                  <input
                    type='password'
                    name='decoy_pw'
                    autoComplete='new-password'
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      height: 0,
                      width: 0,
                    }}
                    aria-hidden='true'
                  />
                  <input
                    className={`mt-1 w-full rounded-lg bg-neutral-900/80 border outline-none text-white caret-white placeholder:text-white/40
                               focus:ring-2 ${pwMismatch ? 'border-red-500/60 focus:ring-red-500/60' : 'border-neutral-700/70 focus:ring-[#5a319f] focus:border-[#5a319f]'}`}
                    type={showPw ? 'text' : 'password'}
                    autoComplete='off'
                    name={`pw_${nonce}`}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder=''
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

              {/* (가입) 비밀번호 확인 + 닉네임 */}
              {mode === 'signup' && (
                <>
                  {/* 레이블 오른쪽에 작은 빨간 문구 */}
                  <div
                    className='flex items-baseline justify-between'
                    style={{ marginTop: 'clamp(12px, 3.6vw, 16px)' }}
                  >
                    <span
                      className='text-white/80'
                      style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
                    >
                      비밀번호 확인
                    </span>
                    {pwMismatch && (
                      <span
                        className='text-red-400'
                        style={{ fontSize: 'clamp(10px, 2.8vw, 12px)' }}
                      >
                        비밀번호를 확인해주세요.
                      </span>
                    )}
                  </div>
                  <input
                    className={`mt-1 w-full rounded-lg bg-neutral-900/80 border outline-none text-white caret-white placeholder:text-white/40
                               focus:ring-2 ${pwMismatch ? 'border-red-500/60 focus:ring-red-500/60' : 'border-neutral-700/70 focus:ring-[#5a319f] focus:border-[#5a319f]'}`}
                    type='password'
                    autoComplete='off'
                    name={`pw_confirm_${nonce}`}
                    required
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    placeholder=''
                    style={{
                      height: 'clamp(40px, 8.5vw, 46px)',
                      fontSize: 'clamp(13px, 3.6vw, 15px)',
                      paddingInline: 'clamp(10px, 3.6vw, 12px)',
                    }}
                  />

                  <label
                    className='block'
                    style={{ marginTop: 'clamp(12px, 3.6vw, 16px)' }}
                  >
                    <span
                      className='text-white/80'
                      style={{ fontSize: 'clamp(12px, 3.4vw, 14px)' }}
                    >
                      닉네임
                    </span>
                    <input
                      className='mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700/70 outline-none text-white caret-white placeholder:text-white/40
                                 focus:ring-2 focus:ring-[#5a319f] focus:border-[#5a319f]'
                      autoComplete='off'
                      name={`display_${nonce}`}
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
                </>
              )}
            </>
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
          {(mode === 'login' || step === 'details') && (
            <button
              type='submit'
              disabled={
                loading ||
                (mode === 'signup' &&
                  (!password ||
                    !passwordConfirm ||
                    password !== passwordConfirm ||
                    !displayName))
              }
              className='w-full rounded-xl font-semibold bg-[#5a319f] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all'
              style={{
                height: 'clamp(44px, 9vw, 54px)',
                marginTop: 'clamp(16px, 4.6vw, 20px)',
                fontSize: 'clamp(14px, 4vw, 16px)',
              }}
            >
              {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입 완료'}
            </button>
          )}

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
