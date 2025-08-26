import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Media } from '../../api/src/media/media.entity';
import { Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { transcodeToHLS } from './transcode';

/**
 * 목적: BullMQ 'transcode' 큐 컨슈머.
 * 동작: media 상태를 PROCESSING→READY/FAILED로 갱신(TypeORM Repo + API의 공용 엔티티).
 */
async function bootstrap() {
  // DB 연결 (API가 스키마 관리. 여기선 synchronize: false 권장)
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    entities: [Media],
    synchronize: false,
  });
  await ds.initialize();
  const repo = ds.getRepository(Media);

  // Redis 연결 (BullMQ 권장옵션)
  const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  new Worker(
    'transcode',
    async (job) => {
      const { mediaId, srcKey } = job.data as {
        mediaId: string;
        srcKey: string;
      };
      console.log(`🎬 job=${job.id} media=${mediaId}`);

      const media = await repo.findOne({ where: { id: mediaId } });
      if (!media) throw new Error('media not found');

      media.status = 'PROCESSING';
      media.error = null;
      await repo.save(media);

      try {
        const hlsKey = await transcodeToHLS(mediaId, srcKey);
        media.status = 'READY';
        media.hlsKey = hlsKey;
        await repo.save(media);
        console.log(`✅ READY media=${mediaId} hlsKey=${hlsKey}`);
        return { hlsKey };
      } catch (e: any) {
        media.status = 'FAILED';
        media.error = e?.message || String(e);
        await repo.save(media);
        console.error(`💥 FAILED media=${mediaId}: ${media.error}`);
        throw e;
      }
    },
    { connection, prefix: 'bull', concurrency: 1 },
  );

  const events = new QueueEvents('transcode', { connection, prefix: 'bull' });
  events.on('completed', ({ jobId }) => console.log('🎉 completed', jobId));
  events.on('failed', ({ jobId, failedReason }) =>
    console.error('💣 failed', jobId, failedReason),
  );

  console.log('Transcode worker started');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
