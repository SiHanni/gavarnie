// "abc/def/video.mp4" -> "video"
export function filenameWithoutExt(pathOrName: string): string {
  const base = (pathOrName.split('/').pop() ?? pathOrName).trim();
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return base; // .으로 시작하거나 확장자 없음
  return base.slice(0, dot);
}
