import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { downloadToFile, uploadDir } from './s3';

ffmpeg.setFfmpegPath(ffmpegPath || '');

type MediaKind = 'audio' | 'video' | 'unknown';

/** contentType 우선, 없으면 srcKey 확장자로 대략 추론 */
function inferKind(contentType: string | undefined, srcKey: string): MediaKind {
  if (contentType?.startsWith('audio/')) return 'audio';
  if (contentType?.startsWith('video/')) return 'video';
  const ext = extname(srcKey).toLowerCase();
  if (
    ['.mp3', '.aac', '.m4a', '.wav', '.flac', '.ogg', '.oga', '.opus'].includes(
      ext,
    )
  )
    return 'audio';
  if (['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.ts'].includes(ext))
    return 'video';
  return 'unknown';
}

/**
 * fluent-ffmpeg 실행을 Promise로 래핑 (타입 오버로드 준수)
 * - 타입 선언: ('end', (stdout: string|null, stderr: string|null) => void)
 * - 타입 선언: ('error', (err: Error, stdout: string|null, stderr: string|null) => void) */
function runFfmpeg(cmd: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    cmd
      .on('start', (cmdline: string) => console.log('[ffmpeg] start:', cmdline))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('progress', (p: any) =>
        console.log('[ffmpeg] progress', p?.timemark ?? ''),
      )
      .on('end', (_stdout: string | null, _stderr: string | null) => resolve())
      .on(
        'error',
        (err: Error, _stdout: string | null, _stderr: string | null) =>
          reject(err),
      )
      .run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cmd as any).on?.('stderr', (line: string) => {
      if (process.env.FFMPEG_VERBOSE) console.log('[ffmpeg]', line);
    });
  });
}

/**
 * srcKey → 임시 입력 → FFmpeg(HLS VOD) → hls/<mediaId>/index.m3u8 업로드 → m3u8 key 반환
 * ENV: HLS_SEGMENT_SECONDS(기본 6), HLS_OUTPUT_PREFIX(기본 hls)
 */
export async function transcodeToHLS(
  mediaId: string,
  srcKey: string,
  contentType?: string,
) {
  const segment = parseInt(process.env.HLS_SEGMENT_SECONDS || '6', 10);
  const outPrefix = process.env.HLS_OUTPUT_PREFIX || 'hls';

  const work = mkdtempSync(join(tmpdir(), `hls-${mediaId}-`));
  const input = join(work, 'input');
  const outDir = join(work, 'out');
  mkdirSync(outDir, { recursive: true });

  // 분기 판단
  const kind = inferKind(contentType, srcKey);
  console.log(
    `[transcode] mediaId=${mediaId} kind=${kind} ct=${contentType ?? '(none)'} srcKey=${srcKey}`,
  );
  try {
    // 1) 원본 다운로드
    await downloadToFile(srcKey, input);

    // 2) FFmpeg → HLS
    const cmd = ffmpeg(input).output(join(outDir, 'index.m3u8'));

    switch (kind) {
      case 'audio':
        // 오디오 전용: AAC + fMP4 세그먼트
        cmd
          .noVideo() // -vn
          .audioCodec('aac') // -c:a aac
          .audioBitrate('128k') // -b:a 128k
          .outputOptions([
            '-movflags',
            '+faststart',
            '-hls_playlist_type',
            'vod',
            '-hls_time',
            String(segment),
            '-hls_list_size',
            '0',
            '-hls_segment_type',
            'fmp4',
            '-hls_fmp4_init_filename',
            'init.mp4',
            '-hls_segment_filename',
            join(outDir, 'seg_%05d.m4s'),
          ]);
        break;

      case 'video':
        // 비디오(기본): libx264 + AAC + HLS (mpegts 세그먼트)
        cmd
          .videoCodec('libx264') // -c:v libx264
          .audioCodec('aac') // -c:a aac
          .outputOptions([
            '-preset',
            'veryfast',
            '-movflags',
            '+faststart',
            '-g',
            '48',
            '-keyint_min',
            '48',
            '-sc_threshold',
            '0',
            '-hls_playlist_type',
            'vod',
            '-hls_time',
            String(segment),
            '-hls_list_size',
            '0',
            // 필요 시 fMP4로 통일하려면 아래 두 줄 교체:
            // '-hls_segment_type', 'fmp4',
            // '-hls_segment_filename', join(outDir, 'seg_%05d.m4s'),
          ]);
        break;

      case 'unknown':
      default:
        throw new Error(
          `Unsupported contentType/ext for HLS: contentType=${contentType ?? 'N/A'}, srcKeyExt=${extname(srcKey)}`,
        );
    }

    await runFfmpeg(cmd);

    // 3) 업로드 (hls/<id>/…)
    const destPrefix = `${outPrefix}/${mediaId}`;
    await uploadDir(destPrefix, outDir);
    console.log(`[transcode] uploaded to s3 prefix=${destPrefix}/`);

    return `${destPrefix}/index.m3u8`;
  } finally {
    // 4) 임시 정리
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {}
  }
}
