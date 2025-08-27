import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './s3.module';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly expires: number;

  constructor(
    private readonly config: ConfigService,
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {
    this.bucket = this.config.get<string>('STORAGE_BUCKET', 'media');
    this.publicBase = this.config.get<string>('PUBLIC_CDN_BASE_URL', '');
    this.expires = parseInt(
      this.config.get<string>('PRESIGN_EXPIRES_SEC', '900'),
      10,
    );
  }
  /**
   * presigned URL 생성 서비스
   * @key: original/${mediaId}
   * @contentType: 'audio' || 'video'
   */
  async presignedPut(key: string, contentType: string) {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: this.expires });

    const publicUrl = this.publicBase
      ? encodeURI(`${this.publicBase}/${key}`)
      : null;

    return {
      url,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      key,
      publicUrl,
      expiresIn: this.expires,
    };
  }
}
