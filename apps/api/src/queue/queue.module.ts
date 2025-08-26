import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const TRANSCODE_QUEUE = Symbol('TRANSCODE_QUEUE');

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: TRANSCODE_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('REDIS_URL');
        // e.g. redis://:pass@localhost:16379/0
        const connection = new IORedis(url, {
          // BullMQ 권장: ioredis 기본 pipeline 이슈 회피
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });
        return new Queue('transcode', { connection, prefix: 'bull' });
      },
    },
  ],
  exports: [TRANSCODE_QUEUE],
})
export class QueueModule {}
