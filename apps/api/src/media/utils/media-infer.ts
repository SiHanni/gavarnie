import path from 'node:path';
import mime from 'mime-types';

export type Kind = 'video' | 'audio';

const VIDEO_EXT = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
const AUDIO_EXT = new Set([
  '.mp3',
  '.aac',
  '.m4a',
  '.wav',
  '.flac',
  '.ogg',
  '.oga',
  '.opus',
]);

export function guessContentType(originalFilename: string): string {
  const ct = mime.lookup(originalFilename);
  return typeof ct === 'string' && ct ? ct : 'application/octet-stream';
}

export function inferKindByExtOrMime(
  originalFilename: string,
  contentType?: string,
): Kind | undefined {
  const ext = path.extname(originalFilename).toLowerCase();
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  if (contentType?.startsWith('video/')) return 'video';
  if (contentType?.startsWith('audio/')) return 'audio';
  return undefined;
}
