import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { transcodeToHLS } from './transcode';
import {
  User,
  Media,
  MediaCore,
  MediaReaction,
  Comment,
} from '@gavarnie/entities';

type JobData = { mediaId: string; srcKey: string; contentType?: string };
const QUEUE_NAME = 'transcode';

function isAudio(ct?: string) {
  return !!ct && ct.startsWith('audio/');
}
function isVideo(ct?: string) {
  return !!ct && ct.startsWith('video/');
}

async function createDataSource() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DB || '',
    entities: [User, Media, MediaCore, MediaReaction, Comment],
    synchronize: false, // 운영 컨벤션 유지
    logging: true, // 필요 시 켜서 디버깅
  });
  await ds.initialize();
  return ds;
}

/**
 * 목적: BullMQ 'transcode' 큐 컨슈머.
 * 동작: media 상태를 PROCESSING→READY/FAILED로 갱신(TypeORM Repo + API의 공용 엔티티).
 */
async function main() {
  // 1) TypeORM DataSource / Repository
  const dataSource = await createDataSource();
  const mediaRepo: Repository<Media> = dataSource.getRepository(Media);

  // 2) Redis (BullMQ)
  const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  // 3) Worker (동시성 고정 1 — ENV 추가 없음)
  const worker = new Worker<JobData>(
    QUEUE_NAME,
    async (job) => {
      const { mediaId, srcKey, contentType } = job.data;

      // (a) 레코드 조회/검증
      const media = await mediaRepo.findOne({ where: { id: mediaId } });
      if (!media) throw new Error('media not found');
      if (media.srcKey !== srcKey) throw new Error('srcKey mismatch');

      // 멱등: 이미 완료면 스킵
      if (media.status === 'READY' && media.hlsKey) {
        console.log(
          `[worker] skip READY mediaId=${mediaId} hlsKey=${media.hlsKey}`,
        );
        return {
          ok: true,
          skipped: true,
          status: 'READY',
          hlsKey: media.hlsKey,
        };
      }

      // (b) PROCESSING 전이
      media.status = 'PROCESSING' as any;
      media.error = null as any;
      await mediaRepo.save(media);
      console.log(
        `[worker] PROCESSING mediaId=${mediaId} ct=${contentType ?? media.contentType}`,
      );

      try {
        // (c) FFmpeg → HLS → MinIO 업로드
        const hlsKey = await transcodeToHLS(
          mediaId,
          srcKey,
          contentType ?? media.contentType,
        );

        // (d) READY 전이 + hlsKey 기록
        media.status = 'READY' as any;
        media.hlsKey = hlsKey;
        await mediaRepo.save(media);

        console.log(`[worker] READY mediaId=${mediaId} hlsKey=${hlsKey}`);
        return { ok: true, status: 'READY', hlsKey };
      } catch (e: any) {
        const msg = e?.message || String(e);
        media.status = 'FAILED' as any;
        media.error = msg;
        await mediaRepo.save(media);

        console.error(`[worker] FAILED mediaId=${mediaId} error=${msg}`);

        throw new Error(msg);
      }
    },
    {
      connection,
      prefix: 'bull',
      concurrency: 1, // 컨벤션: ENV 추가 없이 고정
    },
  );

  // 4) Queue Events (옵션 로깅)
  const events = new QueueEvents(QUEUE_NAME, { connection, prefix: 'bull' });
  events.on('completed', ({ jobId }) => console.log('✅ completed', jobId));
  events.on('failed', ({ jobId, failedReason }) =>
    console.error('💥 failed', jobId, failedReason),
  );

  // 5) 그레이스풀 종료
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
