// apps/worker/src/worker.runner.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { randomUUID } from 'crypto';
import { logger, withJobContext, jobLogger } from './logging/logging';
import { transcodeToHLSAndThumbnails } from './transcode';
import { Media, MediaCore } from '@catarie/entities';
import { MEDIA_CORE_STATUS, MEDIA_STATUS } from './media.constants';

type JobData = { mediaId: string; srcKey: string; contentType?: string };
const QUEUE_NAME = 'transcode';

@Injectable()
export class WorkerRunner implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker<JobData>;
  private events?: QueueEvents;
  private redis?: IORedis;
  private mediaRepository!: Repository<Media>;
  private mediaCoreRepository!: Repository<MediaCore>;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cfg: ConfigService,
  ) {}

  async onModuleInit() {
    this.mediaRepository = this.dataSource.getRepository(Media);
    this.mediaCoreRepository = this.dataSource.getRepository(MediaCore);

    // Redis 연결 (Config에서 주입)
    const redisUrl = this.cfg.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    // BullMQ Worker
    this.worker = new Worker<JobData>(
      QUEUE_NAME,
      async (job) => {
        const jobId = String(
          job.id ?? job.name ?? job.data?.mediaId ?? randomUUID(),
        );
        return withJobContext(jobId, async () => {
          const log = jobLogger(jobId);
          const { mediaId, srcKey, contentType } = job.data;

          // (a) 조회/검증
          const media = await this.mediaRepository.findOne({
            where: { id: mediaId },
          });
          if (!media) {
            log.error({ mediaId }, 'media not found');
            throw new Error('media not found');
          }
          if (media.srcKey !== srcKey) {
            log.error(
              { mediaId, expected: media.srcKey, got: srcKey },
              'srcKey mismatch',
            );
            throw new Error('srcKey mismatch');
          }

          // 멱등
          if (media.status === MEDIA_STATUS.READY && media.hlsKey) {
            log.info({ mediaId, hlsKey: media.hlsKey }, 'skip READY media');
            return {
              ok: true,
              skipped: true,
              status: MEDIA_STATUS.READY,
              hlsKey: media.hlsKey,
              thumbnailKey: media.thumbnailKey ?? null,
              thumbnailWidth: media.thumbnailWidth ?? null,
              thumbnailHeight: media.thumbnailHeight ?? null,
            };
          }

          // (b) PROCESSING
          media.status = MEDIA_STATUS.PROCESSING;
          media.error = null as any;
          await this.mediaRepository.save(media);
          log.info(
            { mediaId, contentType: contentType ?? media.contentType },
            'PROCESSING',
          );

          try {
            // (c) 트랜스코딩
            const { hlsKey, thumbnailKey, thumbnailWidth, thumbnailHeight } =
              await transcodeToHLSAndThumbnails(
                mediaId,
                srcKey,
                contentType ?? media.contentType,
              );

            media.status = MEDIA_STATUS.READY;
            media.hlsKey = hlsKey;
            media.thumbnailKey = thumbnailKey;
            media.thumbnailWidth = thumbnailWidth;
            media.thumbnailHeight = thumbnailHeight;
            media.thumbnailUpdatedAt = new Date();
            await this.mediaRepository.save(media);

            // core update
            const core = await this.mediaCoreRepository.findOne({
              where: { mediaId },
            });
            if (core) {
              core.status = MEDIA_CORE_STATUS.PUBLISHED;
              if (!core.publishedAt) core.publishedAt = new Date();
              await this.mediaCoreRepository.save(core);
            }

            log.info(
              {
                mediaId,
                hlsKey,
                thumbnailKey,
                thumbnailWidth,
                thumbnailHeight,
              },
              'READY',
            );
            return {
              ok: true,
              status: MEDIA_STATUS.READY,
              hlsKey,
              thumbnailKey,
              thumbnailWidth,
              thumbnailHeight,
            };
          } catch (e: any) {
            const msg = e?.message || String(e);
            media.status = MEDIA_STATUS.FAILED as any;
            media.error = msg;
            await this.mediaRepository.save(media);

            const core = await this.mediaCoreRepository.findOne({
              where: { mediaId },
            });
            if (core) {
              core.status = MEDIA_CORE_STATUS.REJECTED;
              await this.mediaCoreRepository.save(core);
            }

            log.error({ mediaId, error: msg }, 'FAILED');
            throw new Error(msg);
          }
        });
      },
      {
        connection: this.redis,
        prefix: 'bull',
        concurrency: 1,
      },
    );

    // QueueEvents
    this.events = new QueueEvents(QUEUE_NAME, {
      connection: this.redis,
      prefix: 'bull',
    });
    this.events.on('completed', ({ jobId }) =>
      logger.info({ jobId }, 'job completed'),
    );
    this.events.on('failed', ({ jobId, failedReason }) =>
      logger.error({ jobId, error: failedReason }, 'job failed'),
    );

    logger.info('worker started: queue=transcode, concurrency=1 (Nest DI)');
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close();
      await this.events?.close();
      await this.redis?.quit();
      await this.dataSource.destroy();
    } catch {
      /* noop */
    }
  }
}
