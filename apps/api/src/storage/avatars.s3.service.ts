import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  HeadObjectCommandOutput,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './s3.module';

type Driver = 's3' | 'minio';

function isLocalhostUrl(u?: string) {
  if (!u) return false;
  try {
    const { hostname } = new URL(u);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

@Injectable()
export class AvatarsS3Service {
  private readonly logger = new Logger(AvatarsS3Service.name);

  // 아바타 전용 파라미터
  private readonly bucket: string;
  private readonly publicBase: string; // 항상 절대 URL
  private readonly expiresSec: number;

  // 디버깅용
  private readonly driver: Driver;

  constructor(
    private readonly config: ConfigService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {
    // 드라이버
    const driverEnv =
      this.config.get<string>('STORAGE_DRIVER') ??
      (process.env.NODE_ENV === 'production' ? 's3' : 'minio');
    this.driver = driverEnv === 's3' ? 's3' : 'minio';

    // 아바타 전용 버킷: STORAGE_BUCKET_AVATARS → AVATAR_BUCKET → 기본
    this.bucket =
      this.config.get<string>('STORAGE_BUCKET_AVATARS') ??
      this.config.get<string>('AVATAR_BUCKET') ??
      'catarie-avatars-prod';

    const configured = (
      this.config.get<string>('AVATAR_PUBLIC_BASE_URL') ?? ''
    ).trim();
    const region =
      this.config.get<string>('STORAGE_REGION') ?? 'ap-northeast-2';
    const forcePathStyle =
      String(
        this.config.get<string>(
          'STORAGE_FORCE_PATH_STYLE',
          this.driver === 's3' ? 'false' : 'true',
        ),
      ) === 'true';

    // 퍼블릭 베이스 결정
    if (configured && !isLocalhostUrl(configured)) {
      // 명시값이 있고 localhost가 아니면 그대로 사용 (CloudFront / S3 정식 도메인)
      this.publicBase = configured.replace(/\/+$/, '');
    } else if (this.driver === 's3') {
      // S3라면 S3 절대 URL로 강제
      this.publicBase = forcePathStyle
        ? `https://s3.${region}.amazonaws.com/${this.bucket}`
        : `https://${this.bucket}.s3.${region}.amazonaws.com`;
    } else {
      // MinIO — 명시값(로컬 프록시) 또는 엔드포인트/bucket
      const endpoint = (
        this.config.get<string>('STORAGE_ENDPOINT') ?? 'http://localhost:19000'
      ).replace(/\/+$/, '');
      this.publicBase = configured
        ? configured.replace(/\/+$/, '')
        : `${endpoint}/${this.bucket}`;
    }

    // presign 만료(초)
    this.expiresSec = parseInt(
      this.config.get<string>('PRESIGN_EXPIRES_SEC', '900'),
      10,
    );
  }

  /** 외부에서 퍼블릭 URL 만들 때 사용 */
  publicUrlFor(key: string): string {
    const normalizedKey = String(key).replace(/^\/+/, '');
    return `${this.publicBase}/${encodeURI(normalizedKey)}`;
  }

  /** PUT 업로드용 presigned URL 생성 */
  async presignedPut(key: string, contentType: string) {
    if (!key) throw new Error('AvatarsS3Service.presignedPut: key is required');
    if (!contentType)
      throw new Error('AvatarsS3Service.presignedPut: contentType is required');

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3, cmd, {
      expiresIn: this.expiresSec,
    });

    return {
      url,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      key,
      bucket: this.bucket,
      publicUrl: this.publicUrlFor(key), // ← 항상 절대 URL
      expiresIn: this.expiresSec,
      driver: this.driver,
    };
  }

  /** HeadObject */
  async headObject(key: string): Promise<HeadObjectCommandOutput> {
    return this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** GetObject */
  async getObject(key: string): Promise<GetObjectCommandOutput> {
    return this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** PutObject (리사이즈 업로드 등) */
  async putObject(opts: {
    key: string;
    body: Buffer | Uint8Array | Blob | string | ReadableStream<any>;
    contentType: string;
    cacheControl?: string;
  }) {
    const { key, body, contentType, cacheControl } = opts;
    return this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(cacheControl ? { CacheControl: cacheControl } : {}),
      }),
    );
  }

  /** Prefix로 키 나열 */
  async listKeys(prefix: string): Promise<string[]> {
    // 참고: 오브젝트 수가 아주 많아지면 pagination 필요
    const res = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
    );
    return res.Contents?.map((o) => o.Key!).filter(Boolean) ?? [];
  }

  /** 다건 삭제 */
  async deleteObjects(keys: string[]) {
    if (keys.length === 0) return;
    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((k) => ({ Key: k })) },
      }),
    );
  }

  /** 단건 삭제 */
  async deleteObject(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
