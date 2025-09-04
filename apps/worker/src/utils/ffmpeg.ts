import ffmpeg from 'fluent-ffmpeg';

/** 영상 길이 반환 */
export async function probeDurationSec(
  filePath: string,
): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(null);
      const sec = data?.format?.duration;
      if (typeof sec === 'number' && isFinite(sec)) {
        resolve(Math.round(sec)); // 정수 초
      } else {
        resolve(null);
      }
    });
  });
}
