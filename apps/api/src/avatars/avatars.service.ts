import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { User } from '@catarie/entities';
import sharp from 'sharp';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

// --- helpers ---
function guessImageContentType(name?: string, fallback?: string) {
  const ext = (name ? extname(name) : '').toLowerCase();
  if (fallback?.startsWith('image/')) return fallback;
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (d) =>
      chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

type UserGrade = 'basic' | 'plus' | 'premium'; // 네 프로젝트 타입에 맞춰 조정

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);
  private readonly bucket: string;
  private readonly maxBytes = 2 * 1024 * 1024; // 2MB 고정
  private readonly sizes: number[];
  private readonly publicBase?: string;
  private readonly cooldownMs = 10_000; // 10초

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.bucket = this.config.get('AVATAR_BUCKET', 'avatars');
    this.publicBase = this.config.get('AVATAR_PUBLIC_BASE_URL');
    this.sizes = (this.config.get<string>('AVATAR_SIZES', '256,64') ?? '256,64')
      .split(',')
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => Number.isFinite(n) && n > 0);
  }

  private s3(): S3Client {
    // 드라이버 결정: 명시적 STORAGE_DRIVER 우선, 없으면 NODE_ENV 기준
    // dev → minio, production → s3 로 동작하도록 기본값 설정
    const driver =
      process.env.STORAGE_DRIVER ??
      (process.env.NODE_ENV === 'production' ? 's3' : 'minio');

    const isS3 = driver === 's3';

    const region = process.env.STORAGE_REGION || 'ap-northeast-2';
    const endpoint =
      // S3일 때는 endpoint 지정 안 하는 게 기본(빈 값이면 자동 무시)
      isS3
        ? undefined
        : process.env.STORAGE_ENDPOINT || 'http://localhost:19000';

    // 운영(S3)에서는 EC2 IAM Role을 쓰는 경우가 많으므로,
    // AccessKey/Secret이 없으면 credentials를 아예 넘기지 않음(Provider Chain 사용)
    const hasStaticCreds =
      !!process.env.STORAGE_ACCESS_KEY && !!process.env.STORAGE_SECRET_KEY;

    const base: S3ClientConfig = {
      region,
      ...(endpoint ? { endpoint } : {}),
      // MinIO는 path-style 권장(true). 운영 S3는 false(기본) 권장.
      forcePathStyle:
        typeof process.env.STORAGE_FORCE_PATH_STYLE === 'string'
          ? String(process.env.STORAGE_FORCE_PATH_STYLE) === 'true'
          : !isS3, // 기본: MinIO=true, S3=false
    };

    // 정적 키가 있으면 명시적 credentials, 없으면 기본 Provider Chain(IAM Role 포함)
    const cfg: S3ClientConfig = hasStaticCreds
      ? {
          ...base,
          credentials: {
            accessKeyId: process.env.STORAGE_ACCESS_KEY!,
            secretAccessKey: process.env.STORAGE_SECRET_KEY!,
          },
        }
      : base;

    return new S3Client(cfg);
  }

  /** presign: 원본 업로드용 URL 발급 (여기서 쿨다운 + 용량 가드) */
  async presign(
    userId: string,
    contentType?: string,
    fileSize?: number,
    originalFilename?: string,
  ) {
    // 1) 쿨다운 체크 (DB 기반)
    const me = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'avatarCooldownUntil'],
    });
    const now = Date.now();
    const until = me?.avatarCooldownUntil?.getTime() ?? 0;
    if (until && now < until) {
      const remainSec = Math.ceil((until - now) / 1000);
      throw new BadRequestException(
        `프로필 이미지는 ${remainSec}초 후에 다시 변경할 수 있습니다.`,
      );
    }

    // 2) 입력 가드
    const ct = guessImageContentType(originalFilename, contentType);
    if (!ct.startsWith('image/')) {
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    }
    if (fileSize != null && fileSize > this.maxBytes) {
      throw new BadRequestException(
        '이미지는 2MB 이하만 업로드할 수 있습니다.',
      );
    }

    // 3) 키 생성
    const ext = extname(originalFilename || '').toLowerCase() || '.jpg';
    const id = uuidv4();
    const key = `raw/${userId}/${id}${ext}`;

    // 4) presigned PUT 생성
    const expiresIn = parseInt(process.env.PRESIGN_EXPIRES_SEC || '900', 10);
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: ct,
    });
    const url = await getSignedUrl(this.s3(), cmd, { expiresIn });

    // 5) 쿨다운 시작(발급 시점에 잡는다 → 리소스 소모 예방)
    const cooldownUntil = new Date(now + this.cooldownMs);
    await this.users.update(
      { id: userId },
      { avatarCooldownUntil: cooldownUntil },
    );

    this.logger.log(
      `[avatars.presign] user=${userId} key=${key} ct=${ct} size=${fileSize} cooldownUntil=${cooldownUntil.toISOString()}`,
    );

    return {
      url,
      method: 'PUT' as const,
      headers: { 'Content-Type': ct },
      key,
      expiresIn,
      publicUrl: this.publicBase ? `${this.publicBase}/${key}` : null,
    };
  }

  /** complete: 원본 확인 → 리사이즈 → 이전 public 삭제 → 새 public 저장 → 원본 삭제 → URL 반환(캐시버스터 포함) */
  async complete(userId: string, key: string) {
    // 1) 원본 존재/크기 확인
    const head = await this.s3().send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const size = head.ContentLength ?? 0;
    if (!size) throw new BadRequestException('업로드된 파일이 없습니다.');
    if (size > this.maxBytes)
      throw new BadRequestException('이미지 크기 제한(2MB)을 초과했습니다.');

    // 2) 원본 다운로드
    const obj = await this.s3().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const rawBuf = await streamToBuffer(obj.Body as NodeJS.ReadableStream);

    // 3) 이전 public/* 삭제 (public/{userId}/...)
    await this.deleteAllPublicVariants(userId);

    // 4) 새 변형 생성 & 업로드
    const outs: string[] = [];
    for (const s of this.sizes) {
      const buf = await sharp(rawBuf)
        .rotate()
        .resize(s, s, { fit: 'cover', position: 'centre' })
        .webp({ quality: 90 })
        .toBuffer();

      const outKey = `public/${userId}/avatar_${s}.webp`;
      await this.s3().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: outKey,
          Body: buf,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      outs.push(outKey);
    }

    // 5) 원본 즉시 삭제
    await this.safeDeleteObject(key);

    // 6) 대표 URL + 캐시버스터 (쿼리 버전)
    const maxSize = Math.max(...this.sizes);
    const bestKey = `public/${userId}/avatar_${maxSize}.webp`;
    const version = Date.now(); // 또는 uuid
    const avatarPath = `${bestKey}?v=${version}`;
    const avatarUrl = this.publicBase
      ? `${this.publicBase}/${avatarPath}`
      : `/${this.bucket}/${avatarPath}`;

    // 7) DB 업데이트(업데이트 시각 포함)
    await this.users.update(
      { id: userId },
      { avatarUrl, avatarUpdatedAt: new Date() },
    );

    return {
      ok: true,
      avatarUrl,
      variants: outs.map((k) => {
        const p = `${k}?v=${version}`;
        return this.publicBase
          ? `${this.publicBase}/${p}`
          : `/${this.bucket}/${p}`;
      }),
    };
  }

  /** public/{userId}/ 아래 기존 파일 전부 삭제 */
  private async deleteAllPublicVariants(userId: string) {
    const prefix = `public/${userId}/`;
    const s3 = this.s3();

    // 목록 조회
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
    );
    const keys = listed.Contents?.map((o) => o.Key!).filter(Boolean) ?? [];

    if (keys.length === 0) return;

    // 일괄 삭제
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((k) => ({ Key: k })) },
      }),
    );
  }

  private async safeDeleteObject(key: string) {
    try {
      await this.s3().send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (e) {
      this.logger.warn(
        `[avatars] failed to delete raw: ${key} (${(e as Error).message})`,
      );
    }
  }
}
