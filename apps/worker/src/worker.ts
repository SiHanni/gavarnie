import 'reflect-metadata';
import { logger, withJobContext, jobLogger } from './logging/logging';
import { DataSource, Repository } from 'typeorm';
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { transcodeToHLSAndThumbnails } from './transcode';
import {
  User,
  Media,
  MediaCore,
  MediaReaction,
  Comment,
} from '@catarie/entities';
import { MEDIA_CORE_STATUS, MEDIA_STATUS } from './media.constants';
import { randomUUID } from 'crypto';

type JobData = { mediaId: string; srcKey: string; contentType?: string };
const QUEUE_NAME = 'transcode';

async function createDataSource() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DB || '',
    entities: [User, Media, MediaCore, MediaReaction, Comment],
    synchronize: false,
    logging: true,
  });
  await ds.initialize();
  return ds;
}

/**
 * DEPRECATED : worker.runner 로 대체
 * 목적: BullMQ 'transcode' 큐 컨슈머.
 * 동작: media 상태를 PROCESSING→READY/FAILED로 갱신 + 썸네일 생성/반영
 */
async function main() {
  const dataSource = await createDataSource();
  const mediaRepository: Repository<Media> = dataSource.getRepository(Media);
  const mediaCoreRepository: Repository<MediaCore> =
    dataSource.getRepository(MediaCore);

  const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const worker = new Worker<JobData>(
    QUEUE_NAME,
    async (job) => {
      // 잡 컨텍스트(ALS) 주입 + jobId 포함 child 로거
      const jobId = String(
        job.id ?? job.name ?? job.data?.mediaId ?? randomUUID(),
      );
      return withJobContext(jobId, async () => {
        const log = jobLogger(jobId);
        const { mediaId, srcKey, contentType } = job.data;

        // (a) 레코드 조회/검증
        const media = await mediaRepository.findOne({ where: { id: mediaId } });
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

        // 멱등: 이미 완료면 스킵
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

        // (b) PROCESSING 전이
        media.status = MEDIA_STATUS.PROCESSING;
        media.error = null as any;
        await mediaRepository.save(media);
        log.info(
          { mediaId, contentType: contentType ?? media.contentType },
          'PROCESSING',
        );

        try {
          // (c) FFmpeg → HLS + 썸네일 → MinIO 업로드
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
          await mediaRepository.save(media);

          // core update
          const mediaCore = await mediaCoreRepository.findOne({
            where: { mediaId },
          });
          if (mediaCore) {
            mediaCore.status = MEDIA_CORE_STATUS.PUBLISHED;
            if (!mediaCore.publishedAt) mediaCore.publishedAt = new Date();
            await mediaCoreRepository.save(mediaCore);
          }

          log.info(
            { mediaId, hlsKey, thumbnailKey, thumbnailWidth, thumbnailHeight },
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
          await mediaRepository.save(media);

          const mediaCore = await mediaCoreRepository.findOne({
            where: { mediaId },
          });
          if (mediaCore) {
            mediaCore.status = MEDIA_CORE_STATUS.REJECTED;
            await mediaCoreRepository.save(mediaCore);
          }

          log.error({ mediaId, error: msg }, 'FAILED');
          throw new Error(msg);
        }
      });
    },
    {
      connection,
      prefix: 'bull',
      concurrency: 1,
    },
  );

  // QueueEvents 로그도 구조화
  const events = new QueueEvents(QUEUE_NAME, { connection, prefix: 'bull' });
  events.on('completed', ({ jobId }) =>
    logger.info({ jobId }, 'job completed'),
  );
  events.on('failed', ({ jobId, failedReason }) =>
    logger.error({ jobId, error: failedReason }, 'job failed'),
  );

  const shutdown = async () => {
    try {
      await worker.close();
      await events.close();
      await connection.quit();
      await dataSource.destroy();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('started: queue=transcode, concurrency=1 (TypeORM)');
}

main().catch((err) => {
  logger.error({ err: err?.message || String(err) }, 'fatal worker error');
  process.exit(1);
});
