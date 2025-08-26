import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { downloadToFile, uploadDir } from './s3';

ffmpeg.setFfmpegPath(ffmpegPath || '');
/**
 * 목적: 원본(srcKey)을 HLS(m3u8 + ts)로 변환 → MinIO 업로드 → 업로드 경로 반환
 */
export async function transcodeToHLS(mediaId: string, srcKey: string) {
  const segment = parseInt(process.env.HLS_SEGMENT_SECONDS || '6', 10);
  const outPrefix = process.env.HLS_OUTPUT_PREFIX || 'hls';

  const work = mkdtempSync(join(tmpdir(), `hls-${mediaId}-`));
  const input = join(work, 'input');
  const outDir = join(work, 'out');
  mkdirSync(outDir, { recursive: true });

  try {
    await downloadToFile(srcKey, input);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(input)
        .outputOptions([
          '-c:v h264',
          '-c:a aac',
          '-preset veryfast',
          `-hls_time ${segment}`,
          '-hls_list_size 0',
          '-hls_segment_filename',
          `${outDir}/segment_%05d.ts`,
          '-f hls',
          '-movflags +faststart',
          '-y',
        ])
        .output(join(outDir, 'index.m3u8'))
        .on('start', (cmd) => console.log('FFmpeg:', cmd))
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });

    const destPrefix = `${outPrefix}/${mediaId}`;
    await uploadDir(destPrefix, outDir);
    return `${destPrefix}/index.m3u8`;
  } finally {
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {}
  }
}
