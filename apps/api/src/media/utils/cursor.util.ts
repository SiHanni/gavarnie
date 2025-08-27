export type CursorValue = { updatedAt: string; id: string };

// base64(JSON)로 인코딩/디코딩
export function encodeCursor(c: CursorValue): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64');
}
export function decodeCursor(s?: string): CursorValue | null {
  if (!s) return null;
  try {
    const obj = JSON.parse(Buffer.from(s, 'base64').toString('utf8'));
    if (typeof obj?.updatedAt === 'string' && typeof obj?.id === 'string')
      return obj;
    return null;
  } catch {
    return null;
  }
}
