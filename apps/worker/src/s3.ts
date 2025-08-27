import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream, readdirSync, statSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { join, extname } from 'path';

const pipe = promisify(pipeline);

// ENV에서만 값 사용 (임의 추가 없음)
const BUCKET = process.env.STORAGE_BUCKET || 'media';

export const s3 = new S3Client({
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY || '',
    secretAccessKey: process.env.STORAGE_SECRET_KEY || '',
  },
  forcePathStyle:
    String(process.env.STORAGE_FORCE_PATH_STYLE || 'true') === 'true',
});

export async function downloadToFile(key: string, toPath: string) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`download file: ${obj}`);
  await pipe(obj.Body as any, createWriteStream(toPath));
}

function guessContentType(file: string) {
  const ext = extname(file).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

/**
 * outDir의 파일들을 prefixKey 하위로 업로드
 * 예) prefixKey = hls/<mediaId>
 */
export async function uploadDir(prefixKey: string, dir: string) {
  const files = readdirSync(dir);
  for (const f of files) {
    const p = join(dir, f);
    if (!statSync(p).isFile()) continue;

    const ContentType = guessContentType(f);

    await new Upload({
      client: s3,
      params: {
        Bucket: BUCKET,
        Key: `${prefixKey}/${f}`,
        Body: createReadStream(p),
        ContentType,
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    }).done();
  }
}
