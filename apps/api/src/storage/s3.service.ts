// api/src/storage/s3.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './s3.module';

type Driver = 's3' | 'minio';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);

  // 기본 파라미터
  private readonly bucket: string;
  private readonly publicBase?: string;
  private readonly expiresSec: number;

  // 스위치 정보 (디버깅/분기용)
  private readonly driver: Driver;

  constructor(
    private readonly config: ConfigService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {
    // 드라이버 결정: 명시값 우선, 없으면 NODE_ENV로 추론 (dev=minio, prod=s3)
    const driverEnv =
      this.config.get<string>('STORAGE_DRIVER') ??
      (process.env.NODE_ENV === 'production' ? 's3' : 'minio');
    this.driver = driverEnv === 's3' ? 's3' : 'minio';

    // 버킷: 미디어 전용 → 공통 → 기본 'media'
    // (아바타 전용은 avatars 서비스에서 STORAGE_BUCKET_AVATARS 사용)
    this.bucket =
      this.config.get<string>('STORAGE_BUCKET_MEDIA') ??
      this.config.get<string>('STORAGE_BUCKET') ??
      'media';

    // 퍼블릭 CDN 베이스 (CloudFront 도메인 등). 없으면 presign 위주 사용 권장.
    const base = this.config.get<string>('PUBLIC_CDN_BASE_URL', '').trim();
    this.publicBase = base ? base.replace(/\/+$/, '') : undefined;

    // presign 만료(초). 기본 15분.
    this.expiresSec = parseInt(
      this.config.get<string>('PRESIGN_EXPIRES_SEC', '900'),
      10,
    );
  }

  /**
   * PUT 업로드용 presigned URL 생성
   * @param key      예: 'original/${mediaId}'
   * @param contentType 예: 'video/mp4', 'audio/mpeg', 'image/png' 등
   */
  async presignedPut(key: string, contentType: string) {
    if (!key || typeof key !== 'string') {
      throw new Error('presignedPut: key is required');
    }
    if (!contentType || typeof contentType !== 'string') {
      throw new Error('presignedPut: contentType is required');
    }

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      // ACL은 필요 시 추가 (S3 기본은 소유자 전유. 퍼블릭 공개는 CDN을 권장)
      // ACL: 'private'
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
      publicUrl: this.publicBase ? this.joinPublicUrl(key) : null,
      expiresIn: this.expiresSec,
      driver: this.driver,
    };
  }

  /**
   * (옵션) 공개 URL 조립 (CDN 기반 사용 권장)
   * CDN 미설정 시 반환하지 않거나 presign GET 사용 권장
   */
  private joinPublicUrl(key: string): string {
    // double-encoding 방지: 경로만 encodeURI, base는 신뢰 가정
    const normalizedKey = String(key).replace(/^\/+/, '');
    return `${this.publicBase}/${encodeURI(normalizedKey)}`;
  }
}
