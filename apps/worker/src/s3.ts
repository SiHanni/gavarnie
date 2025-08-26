// MinIO(S3)에서 원본 다운로드 & HLS 산출물 업로드
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream, readdirSync, statSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { join } from 'path';

const pipe = promisify(pipeline);

const BUCKET = process.env.STORAGE_BUCKET || 'media';

export const s3 = new S3Client({
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.STORAGE_SECRET_KEY!,
  },
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
});

export async function downloadToFile(key: string, dest: string) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!obj.Body) throw new Error('Empty body from S3');
  await pipe(obj.Body as any, createWriteStream(dest));
}

export async function uploadDir(prefixKey: string, dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (!statSync(p).isFile()) continue;
    await new Upload({
      client: s3,
      params: {
        Bucket: BUCKET,
        Key: `${prefixKey}/${f}`,
        Body: createReadStream(p),
      },
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
    }).done();
  }
}
