import { MigrationInterface, QueryRunner } from 'typeorm';

export default class EnsureIndexMediaCoreOwnerCreatedSafe20250907043506
  implements MigrationInterface
{
  name = 'EnsureIndexMediaCoreOwnerCreatedSafe20250907043506';

  public async up(q: QueryRunner): Promise<void> {
    // 이미 동일 이름 인덱스가 있으면 스킵(안전모드)
    const rows: Array<{ cnt: number }> = await q.query(`
      SELECT COUNT(1) AS cnt
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'media_core'
        AND index_name = 'idx_media_owner_created'
    `);

    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (exists) return;

    await q.query(`
      CREATE INDEX idx_media_owner_created
      ON media_core (owner_id, status, created_at DESC, id DESC)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    // 존재할 때만 삭제(안전모드)
    const rows: Array<{ cnt: number }> = await q.query(`
      SELECT COUNT(1) AS cnt
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'media_core'
        AND index_name = 'idx_media_owner_created'
    `);

    const exists = Number(rows?.[0]?.cnt ?? 0) > 0;
    if (!exists) return;

    await q.query(`
      DROP INDEX idx_media_owner_created ON media_core
    `);
  }
}
