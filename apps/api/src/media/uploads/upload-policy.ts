import {
  BASIC_GRADE_UPLOAD_MAX_PER_DAY,
  BASIC_GRADE_UPLOAD_VOLUME_PER_TIME,
  PLUS_GRADE_UPLOAD_MAX_PER_DAY,
  PLUS_GRADE_UPLOAD_VOLUME_PER_TIME,
  PREMIUM_GRADE_UPLOAD_MAX_PER_DAY,
  PREMIUM_GRADE_UPLOAD_VOLUME_PER_TIME,
} from './policy.constants';

export type UserGrade = 'basic' | 'plus' | 'premium';

export const UPLOAD_POLICY: Record<
  UserGrade,
  { maxPerDay: number; maxFileMB: number }
> = {
  basic: {
    maxPerDay: BASIC_GRADE_UPLOAD_MAX_PER_DAY,
    maxFileMB: BASIC_GRADE_UPLOAD_VOLUME_PER_TIME,
  },
  plus: {
    maxPerDay: PLUS_GRADE_UPLOAD_MAX_PER_DAY,
    maxFileMB: PLUS_GRADE_UPLOAD_VOLUME_PER_TIME,
  },
  premium: {
    maxPerDay: PREMIUM_GRADE_UPLOAD_MAX_PER_DAY,
    maxFileMB: PREMIUM_GRADE_UPLOAD_VOLUME_PER_TIME,
  },
};

// 한국시간 하루 경계 계산(KST 00:00~24:00)
export function kstDayRange(date = new Date()) {
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const kst = new Date(date.getTime() + KST_OFFSET);
  const startKst = new Date(
    kst.getFullYear(),
    kst.getMonth(),
    kst.getDate(),
    0,
    0,
    0,
    0,
  );
  const endKst = new Date(
    kst.getFullYear(),
    kst.getMonth(),
    kst.getDate(),
    23,
    59,
    59,
    999,
  );
  // 다시 UTC로 변환
  return {
    start: new Date(startKst.getTime() - KST_OFFSET),
    end: new Date(endKst.getTime() - KST_OFFSET),
  };
}
