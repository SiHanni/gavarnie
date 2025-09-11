import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const ffprobe = require('ffprobe-static');

import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { extname, join } from 'path';
import { downloadToFile, uploadDir } from './s3';
import { logger } from './logging/logging';

ffmpeg.setFfmpegPath(ffmpegPath || '');
ffmpeg.setFfprobePath(ffprobe.path);

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
 * fluent-ffmpeg 실행을 Promise로 래핑
 * - 진행률 로그는 기본 1.5초 간격으로만 출력 (스팸 방지)
 * - FFMPEG_VERBOSE=1 이면 stderr 라인도 debug로 기록
 */
function runFfmpeg(cmd: ffmpeg.FfmpegCommand): Promise<void> {
  const ffmpegLog = logger.child({ mod: 'ffmpeg' });
  const intervalMs = parseInt(
    process.env.FFMPEG_PROGRESS_INTERVAL_MS || '1500',
    10,
  );

  return new Promise<void>((resolve, reject) => {
    let last = 0;
    cmd
      .on('start', (cmdline: string) => {
        ffmpegLog.info({ cmdline }, 'ffmpeg start');
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('progress', (p: any) => {
        const now = Date.now();
        if (now - last > intervalMs) {
          last = now;
          ffmpegLog.info(
            { timemark: p?.timemark ?? undefined, percent: p?.percent },
            'ffmpeg progress',
          );
        }
      })
      .on('end', (_stdout: string | null, _stderr: string | null) => {
        ffmpegLog.info('ffmpeg end');
        resolve();
      })
      .on('error', (err: Error) => {
        ffmpegLog.error({ error: err.message }, 'ffmpeg error');
        reject(err);
      })
      .run();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cmd as any).on?.('stderr', (line: string) => {
      if (process.env.FFMPEG_VERBOSE)
        ffmpegLog.debug({ line }, 'ffmpeg stderr');
    });
  });
}

/** ffprobe로 길이/이미지 크기 확인 */
function ffprobeAsync(input: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, data) => (err ? reject(err) : resolve(data)));
  });
}
async function getDurationSec(input: string): Promise<number | null> {
  try {
    const meta = await ffprobeAsync(input);
    const s = meta.format?.duration;
    return typeof s === 'number'
      ? s
      : typeof s === 'string'
        ? parseFloat(s)
        : null;
  } catch {
    return null;
  }
}
async function getImageSize(
  input: string,
): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await ffprobeAsync(input);
    const v = meta.streams?.find((s) => s.codec_type === 'video');
    if (v?.width && v?.height) return { width: v.width, height: v.height };
    return null;
  } catch {
    return null;
  }
}

/** 썸네일(단일 프레임) 생성: 비디오용 */
async function generateVideoPosterFrame(
  input: string,
  time: number,
  width: number,
  outPath: string,
) {
  const cmd = ffmpeg(input)
    .seekInput(time) // -ss {time}
    .frames(1) // -frames:v 1
    .videoCodec('libwebp') // -c:v libwebp
    .outputOptions([
      '-q:v',
      '80',
      '-vf',
      `scale=${width}:-1:force_original_aspect_ratio=decrease`,
    ])
    .output(outPath);
  await runFfmpeg(cmd);
}

/** 썸네일(단일 프레임) 생성: 오디오용(스펙트럼) → 실패 시 단색 대체 */
async function generateAudioPoster(
  input: string,
  width: number,
  outPath: string,
) {
  const height = Math.round((width * 16) / 9); // 9:16 세로 비율
  try {
    const cmd = ffmpeg(input)
      .complexFilter([`showspectrumpic=s=${width}x${height}:legend=disabled`])
      .frames(1)
      .videoCodec('libwebp')
      .outputOptions(['-q:v', '80'])
      .output(outPath);
    await runFfmpeg(cmd);
  } catch {
    // 스펙트럼 실패 시 단색(서비스 퍼플) 백업
    const cmd = ffmpeg('color=c=0x5a319f:s=' + `${width}x${height}` + ':d=1')
      .inputOptions(['-f', 'lavfi'])
      .frames(1)
      .videoCodec('libwebp')
      .outputOptions(['-q:v', '80'])
      .output(outPath);
    await runFfmpeg(cmd);
  }
}

/** HLS + 썸네일 동시 처리 함수(기존 transcodeToHLS 대체) */
export async function transcodeToHLSAndThumbnails(
  mediaId: string,
  srcKey: string,
  contentType?: string,
): Promise<{
  hlsKey: string;
  thumbnailKey: string; // thumbs/{id}/poster_540.webp
  thumbnailWidth: number;
  thumbnailHeight: number;
}> {
  const segment = parseInt(process.env.HLS_SEGMENT_SECONDS || '6', 10);
  const outPrefix = process.env.HLS_OUTPUT_PREFIX || 'hls';
  const thumbPrefix = process.env.THUMB_OUTPUT_PREFIX || 'thumbs';
  const thumbWidths = (process.env.THUMB_WIDTHS || '360,540,720')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  const work = mkdtempSync(join(tmpdir(), `hls-${mediaId}-`));
  const input = join(work, 'input');
  const outDir = join(work, 'out');
  const thumbDir = join(work, 'thumbs');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(thumbDir, { recursive: true });

  const kind = inferKind(contentType, srcKey);
  const log = logger.child({ mediaId, kind });

  log.info(
    {
      srcKey,
      contentType: contentType ?? null,
      segment,
      outPrefix,
      thumbPrefix,
      thumbWidths,
    },
    'transcode start',
  );

  try {
    // 1) 원본 다운로드
    await downloadToFile(srcKey, input);
    log.info({ input }, 'downloaded');

    // 2) FFmpeg → HLS
    const cmd = ffmpeg(input).output(join(outDir, 'index.m3u8'));
    switch (kind) {
      case 'audio':
        cmd
          .noVideo()
          .audioCodec('aac')
          .audioBitrate('128k')
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
        cmd
          .videoCodec('libx264')
          .audioCodec('aac')
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
          ]);
        break;
      case 'unknown':
      default:
        log.error({ contentType, ext: extname(srcKey) }, 'unsupported kind');
        throw new Error(
          `Unsupported contentType/ext for HLS: contentType=${contentType ?? 'N/A'}, srcKeyExt=${extname(srcKey)}`,
        );
    }
    log.info('hls encode start');
    await runFfmpeg(cmd);
    log.info('hls encode done');

    // 3) 업로드 (hls/<id>/…)
    const destPrefix = `${outPrefix}/${mediaId}`;
    await uploadDir(destPrefix, outDir);
    log.info({ destPrefix }, 'hls uploaded');

    // 4) 썸네일 생성 (poster_360/540/720.webp)
    let poster540 = '';
    for (const w of thumbWidths) {
      const outPath = join(thumbDir, `poster_${w}.webp`);
      if (kind === 'video') {
        const duration = (await getDurationSec(input)) ?? 0;
        const t =
          duration > 0
            ? Math.max(0, Math.min(duration * 0.1, Math.max(duration - 0.2, 0)))
            : 0; // 10% 지점(백업: 0s)
        await generateVideoPosterFrame(input, t, w, outPath);
        log.info({ width: w, at: t, outPath }, 'poster frame generated');
      } else {
        await generateAudioPoster(input, w, outPath);
        log.info({ width: w, outPath }, 'audio poster generated');
      }
      if (w === 540) poster540 = outPath;
    }

    // 5) 썸네일 업로드 (thumbs/<id>/…)
    const thumbDestPrefix = `${thumbPrefix}/${mediaId}`;
    await uploadDir(thumbDestPrefix, thumbDir);
    log.info({ thumbDestPrefix }, 'thumbs uploaded');

    // 6) 대표(540) 크기 측정 → 리턴
    const dim = poster540 ? await getImageSize(poster540) : null;
    const width = dim?.width ?? 540;
    const height = dim?.height ?? Math.round((540 * 16) / 9);
    const thumbnailKey = `${thumbDestPrefix}/poster_540.webp`;

    log.info(
      {
        hlsKey: `${destPrefix}/index.m3u8`,
        thumbnailKey,
        thumbnailWidth: width,
        thumbnailHeight: height,
      },
      'transcode done',
    );

    return {
      hlsKey: `${destPrefix}/index.m3u8`,
      thumbnailKey,
      thumbnailWidth: width,
      thumbnailHeight: height,
    };
  } finally {
    // 7) 임시 정리
    try {
      rmSync(work, { recursive: true, force: true });
      logger.debug({ mediaId, work }, 'tmp cleaned');
    } catch {
      // 청소 실패는 치명적이지 않으므로 무시
    }
  }
}
