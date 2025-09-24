import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

export const S3_CLIENT = Symbol('S3_CLIENT');

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // dev → minio, production → s3
        const driver =
          config.get<string>('STORAGE_DRIVER') ??
          (process.env.NODE_ENV === 'production' ? 's3' : 'minio');

        const isS3 = driver === 's3';

        const region = config.get<string>('STORAGE_REGION', 'ap-northeast-2');

        // S3일 때는 endpoint 지정하지 않는 게 기본. MinIO는 endpoint 필수.
        const endpoint = isS3
          ? config.get<string>('STORAGE_ENDPOINT') || undefined
          : config.get<string>('STORAGE_ENDPOINT', 'http://localhost:19000');

        // forcePathStyle: MinIO 기본 true, S3 기본 false
        const forcePathStyleEnv = config.get<string>(
          'STORAGE_FORCE_PATH_STYLE',
        );
        const forcePathStyle =
          typeof forcePathStyleEnv === 'string'
            ? forcePathStyleEnv === 'true'
            : !isS3;

        // 정적 키가 모두 있을 때만 credentials 주입
        const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY');
        const secretAccessKey = config.get<string>('STORAGE_SECRET_KEY');
        const hasStaticCreds = !!accessKeyId && !!secretAccessKey;

        const base: S3ClientConfig = {
          region,
          ...(endpoint ? { endpoint } : {}),
          forcePathStyle,
        };

        const cfg: S3ClientConfig = hasStaticCreds
          ? {
              ...base,
              credentials: {
                accessKeyId: accessKeyId!,
                secretAccessKey: secretAccessKey!,
              },
            }
          : base; // IAM Role/기본 프로바이더 체인 사용

        return new S3Client(cfg);
      },
    },
  ],
  exports: [S3_CLIENT],
})
export class S3Module {}
