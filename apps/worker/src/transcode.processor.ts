import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

/**
 * DEPRECATED
 * - worker -> transcode.ts 로만 처리하며 transcode.processor가 provider로서 작업을 소비하지 않도록
 */
@Injectable()
export class TranscodeProcessor implements OnModuleInit {
  private readonly logger = new Logger(TranscodeProcessor.name);

  async onModuleInit() {
    const connection = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    const worker = new Worker(
      'transcode',
      async (job) => {
        const { mediaId, srcKey } = job.data as {
          mediaId: string;
          srcKey: string;
        };
        this.logger.log(`🎬 job=${job.id} mediaId=${mediaId} srcKey=${srcKey}`);
        // 7단계에서 FFmpeg HLS 변환 로직 추가
        return true;
      },
      { connection, prefix: 'bull', concurrency: 1 },
    );

    const events = new QueueEvents('transcode', { connection, prefix: 'bull' });
    events.on('completed', ({ jobId }) =>
      this.logger.log(`✅ completed ${jobId}`),
    );
    events.on('failed', ({ jobId, failedReason }) =>
      this.logger.error(`❌ failed ${jobId}: ${failedReason}`),
    );

    this.logger.log('Transcode worker started');
  }
}
