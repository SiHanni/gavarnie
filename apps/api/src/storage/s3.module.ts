import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = Symbol('S3_CLIENT');

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const endpoint = config.getOrThrow<string>('STORAGE_ENDPOINT');
        const region = config.getOrThrow<string>('STORAGE_REGION');
        const accessKeyId = config.getOrThrow<string>('STORAGE_ACCESS_KEY');
        const secretAccessKey = config.getOrThrow<string>('STORAGE_SECRET_KEY');
        const forcePathStyle =
          config.get<string>('STORAGE_FORCE_PATH_STYLE') === 'true';

        return new S3Client({
          region,
          endpoint,
          credentials: { accessKeyId, secretAccessKey },
          forcePathStyle,
        });
      },
    },
  ],
  exports: [S3_CLIENT],
})
export class S3Module {}
