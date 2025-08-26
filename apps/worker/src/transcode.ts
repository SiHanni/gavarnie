import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { downloadToFile, uploadDir } from './s3';

ffmpeg.setFfmpegPath(ffmpegPath || '');

/**
 * srcKey → 임시 입력 → FFmpeg(HLS VOD) → hls/<mediaId>/index.m3u8 업로드 → m3u8 key 반환
 * ENV: HLS_SEGMENT_SECONDS(기본 6), HLS_OUTPUT_PREFIX(기본 hls)
 */
export async function transcodeToHLS(mediaId: string, srcKey: string) {
  const segment = parseInt(process.env.HLS_SEGMENT_SECONDS || '6', 10);
  const outPrefix = process.env.HLS_OUTPUT_PREFIX || 'hls';

  const work = mkdtempSync(join(tmpdir(), `hls-${mediaId}-`));
  const input = join(work, 'input');
  const outDir = join(work, 'out');
  mkdirSync(outDir, { recursive: true });

  try {
    // 1) 원본 다운로드
    await downloadToFile(srcKey, input);

    // 2) FFmpeg → HLS (VOD)
    await new Promise<void>((resolve, reject) => {
      ffmpeg(input)
        .outputOptions([
          '-preset veryfast',
          '-movflags +faststart',
          '-g 48',
          '-keyint_min 48',
          '-sc_threshold 0',
          '-hls_playlist_type vod',
          `-hls_time ${segment}`,
          '-hls_list_size 0',
        ])
        .on('start', (cmd) => console.log('[ffmpeg] start:', cmd))
        .on('progress', (p) =>
          console.log('[ffmpeg] progress', p.timemark ?? ''),
        )
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .output(join(outDir, 'index.m3u8'))
        .run();
    });

    // 3) 업로드 (hls/<id>/…)
    const destPrefix = `${outPrefix}/${mediaId}`;
    await uploadDir(destPrefix, outDir);

    return `${destPrefix}/index.m3u8`;
  } finally {
    // 4) 임시 정리
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {}
  }
}
