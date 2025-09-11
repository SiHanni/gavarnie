// worker/src/s3.ts (예시 경로: 도련님 프로젝트 구조에 맞춰 두시던 위치 그대로 교체)
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream, readdirSync, statSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { join, extname } from 'path';
import { logger } from './logging/logging';

const pipe = promisify(pipeline);

// ---- helpers ----
const bool = (v: any) => String(v).toLowerCase() === 'true';

function getDriver(): 's3' | 'minio' {
  const d =
    process.env.STORAGE_DRIVER ??
    (process.env.NODE_ENV === 'production' ? 's3' : 'minio');
  return d === 's3' ? 's3' : 'minio';
}

// MinIO 경로에서만 필수로 요구되는 ENV는 required 사용
const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`[s3] missing env: ${name}`);
  return v;
};

// 버킷 우선순위: MEDIA 전용 → 공통 → 기본 'media'
const getBucket = () =>
  process.env.STORAGE_BUCKET_MEDIA || process.env.STORAGE_BUCKET || 'media';

// ---- lazy S3 client ----
let _s3Real: S3Client | null = null;

function createS3(): S3Client {
  const driver = getDriver();
  const isS3 = driver === 's3';

  // 기본 리전(운영/개발 공통). 필요 시 ENV로 덮어씀.
  const region = process.env.STORAGE_REGION || 'ap-northeast-2';

  // endpoint: S3는 기본적으로 지정하지 않음(공식 엔드포인트 사용),
  // MinIO는 필수(예: http://localhost:19000)
  const endpoint = isS3
    ? process.env.STORAGE_ENDPOINT || undefined // 비워두면 자동
    : required('STORAGE_ENDPOINT');

  // forcePathStyle: MinIO는 true 기본, S3는 false 기본
  const forcePathStyle =
    typeof process.env.STORAGE_FORCE_PATH_STYLE === 'string'
      ? bool(process.env.STORAGE_FORCE_PATH_STYLE)
      : !isS3;

  // 자격증명:
  // - 운영(S3)에서 IAM Role 사용 시 STORAGE_ACCESS_KEY/SECRET 없어도 됨(생략)
  // - MinIO에서는 키 필수
  const accessKeyId = isS3
    ? process.env.STORAGE_ACCESS_KEY
    : required('STORAGE_ACCESS_KEY');
  const secretAccessKey = isS3
    ? process.env.STORAGE_SECRET_KEY
    : required('STORAGE_SECRET_KEY');
  const hasStaticCreds = !!accessKeyId && !!secretAccessKey;

  logger.info(
    {
      mod: 's3',
      driver,
      endpoint: endpoint ?? '(aws default)',
      region,
      forcePathStyle,
      hasStaticCreds,
    },
    '[s3] init client',
  );

  // 공통 베이스
  const base: any = {
    region,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle,
  };

  // 정적 키가 있으면 명시, 없으면 IAM Role 등 기본 Provider Chain 사용
  const cfg = hasStaticCreds
    ? { ...base, credentials: { accessKeyId, secretAccessKey } }
    : base;

  return new S3Client(cfg);
}

function getS3Real(): S3Client {
  if (_s3Real) return _s3Real;
  _s3Real = createS3();
  return _s3Real;
}

/**
 * 외부 API 호환을 위해 s3 변수는 유지하되,
 * 실제 접근 시점에 getS3Real()로 위임하는 Proxy를 사용
 */
export const s3 = new Proxy({} as unknown as S3Client, {
  get(_target, prop, _recv) {
    const real = getS3Real();
    // @ts-ignore
    return real[prop];
  },
}) as unknown as S3Client;

// ---- logging child ----
const s3log = logger.child({ mod: 's3' });

// ---- public API (그대로 유지) ----
export async function downloadToFile(key: string, toPath: string) {
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  s3log.info(
    {
      key,
      toPath,
      contentLength: obj.ContentLength ?? null,
      contentType: obj.ContentType ?? null,
    },
    'download start',
  );
  await pipe(obj.Body as any, createWriteStream(toPath));
  s3log.info({ key, toPath }, 'download done');
}

function guessContentType(file: string) {
  const ext = extname(file).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.m4s') return 'video/iso.segment';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

/**
 * outDir의 파일들을 prefixKey 하위로 업로드
 * 예) prefixKey = hls/<mediaId>
 */
export async function uploadDir(prefixKey: string, dir: string) {
  const files = readdirSync(dir);
  let totalBytes = 0;

  for (const f of files) {
    const p = join(dir, f);
    if (!statSync(p).isFile()) continue;

    const size = statSync(p).size;
    totalBytes += size;

    const ContentType = guessContentType(f);

    const uploader = new Upload({
      client: s3, // ← Proxy가 실제 S3Client로 위임
      params: {
        Bucket: getBucket(),
        Key: `${prefixKey}/${f}`,
        Body: createReadStream(p),
        ContentType,
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    });

    if (process.env.S3_VERBOSE) {
      let last = 0;
      uploader.on('httpUploadProgress', (prog: any) => {
        const now = Date.now();
        if (now - last > 1500) {
          last = now;
          s3log.debug(
            {
              key: `${prefixKey}/${f}`,
              uploaded: prog?.loaded ?? null,
              total: prog?.total ?? size ?? null,
            },
            'upload progress',
          );
        }
      });
    }

    await uploader.done();
  }

  s3log.info({ prefixKey, files: files.length, totalBytes }, 'upload dir done');
}
