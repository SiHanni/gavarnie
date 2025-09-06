import 'reflect-metadata';
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
} from '@gavarnie/entities';
import { MEDIA_CORE_STATUS, MEDIA_STATUS } from './media.constants';

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
      const { mediaId, srcKey, contentType } = job.data;

      // (a) 레코드 조회/검증
      const media = await mediaRepository.findOne({ where: { id: mediaId } });
      if (!media) throw new Error('media not found');
      if (media.srcKey !== srcKey) throw new Error('srcKey mismatch');

      // 멱등: 이미 완료면 스킵
      if (media.status === MEDIA_STATUS.READY && media.hlsKey) {
        console.log(
          `[worker] skip READY mediaId=${mediaId} hlsKey=${media.hlsKey}`,
        );
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
      console.log(
        `[worker] PROCESSING mediaId=${mediaId} ct=${contentType ?? media.contentType}`,
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
        // 초기 생성 단계에서는 버전 증가 없이 기본값 유지 (재생성 시에만 증가 고려)
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

        console.log(
          `[worker] READY mediaId=${mediaId} hlsKey=${hlsKey} thumb=${thumbnailKey}`,
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

        console.error(`[worker] FAILED mediaId=${mediaId} error=${msg}`);
        throw new Error(msg);
      }
    },
    {
      connection,
      prefix: 'bull',
      concurrency: 1,
    },
  );

  const events = new QueueEvents(QUEUE_NAME, { connection, prefix: 'bull' });
  events.on('completed', ({ jobId }) => console.log('✅ completed', jobId));
  events.on('failed', ({ jobId, failedReason }) =>
    console.error('💥 failed', jobId, failedReason),
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

  console.log('[worker] started: queue=transcode, concurrency=1 (TypeORM)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
