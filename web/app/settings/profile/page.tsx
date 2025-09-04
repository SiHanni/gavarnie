'use client';

import { useEffect, useState } from 'react';
import { fetchProfile, updateMyProfile } from '@/lib/http';
import { saveUserProfile } from '@/lib/user';
import { useRouter } from 'next/navigation';

export default function EditProfilePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [myId, setMyId] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const me = await fetchProfile();
        setMyId(me.id);
        setDisplayName(me.displayName ?? '');
        setAvatarUrl(me.avatarUrl ?? '');
      } catch (e: any) {
        setErr(e?.message || '프로필 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const res = await updateMyProfile({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });
      saveUserProfile(res);
      window.dispatchEvent(new CustomEvent('auth:login', { detail: res })); // 우상단 아바타 즉시 갱신
      router.push(`/users/${res.id}`);
    } catch (e: any) {
      setErr(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className='h-[100svh] grid place-items-center'>불러오는 중…</div>
    );

  return (
    <div className='min-h-[100svh] text-white px-5 py-8'>
      <form
        onSubmit={submit}
        className='max-w-xl mx-auto rounded-2xl border border-white/10 bg-neutral-950 p-6'
      >
        <h1 className='text-2xl font-extrabold'>프로필 편집</h1>

        <label className='block mt-6'>
          <span className='text-sm text-white/80'>표시 이름</span>
          <input
            className='mt-1 w-full px-3 py-3 rounded-xl bg-neutral-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/60'
            value={displayName}
            maxLength={50}
            onChange={e => setDisplayName(e.target.value)}
            required
          />
        </label>

        <label className='block mt-4'>
          <span className='text-sm text-white/80'>아바타 URL</span>
          <input
            className='mt-1 w-full px-3 py-3 rounded-xl bg-neutral-900 border border-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500/60'
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
            placeholder='https://...'
          />
        </label>

        {err && <p className='mt-3 text-sm text-red-400'>{err}</p>}

        <div className='mt-6 flex items-center gap-3'>
          <button
            type='submit'
            disabled={saving}
            className='px-4 py-2 rounded-lg font-semibold disabled:opacity-50'
            style={{ backgroundColor: '#5a319f' }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          <button
            type='button'
            onClick={() => router.push(`/users/${myId || ''}`)}
            className='px-4 py-2 rounded-lg bg-white/10 border border-white/15'
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
