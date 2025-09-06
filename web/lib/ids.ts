// userId를 URL에 그대로 노출하지 않도록 하는 간단한 base62 인/디코딩 유틸.

const ALPH = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** 숫자(userId)를 base62 문자열로 인코딩 */
export function encodeUserId(id: string | number): string {
  let n = BigInt(id);
  if (n < 0n) throw new Error('id must be non-negative');
  if (n === 0n) return '0';
  let s = '';
  while (n > 0n) {
    const r = Number(n % 62n);
    s = ALPH[r] + s;
    n = n / 62n;
  }
  return s;
}

/** base62 문자열을 10진수 문자열(userId)로 디코딩 */
export function decodeUserId(uid: string): string {
  let n = 0n;
  for (const ch of uid) {
    const i = ALPH.indexOf(ch);
    if (i < 0) throw new Error('Invalid uid');
    n = n * 62n + BigInt(i);
  }
  return n.toString(10);
}
