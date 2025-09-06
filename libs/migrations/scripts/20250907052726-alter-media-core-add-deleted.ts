import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AlterMediaCoreAddDeletedAt20250907052726
  implements MigrationInterface
{
  name = 'AlterMediaCoreAddDeletedAt20250907052726';

  public async up(q: QueryRunner): Promise<void> {
    const hasCol = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media_core'
        AND COLUMN_NAME = 'deleted_at'
      LIMIT 1
    `);
    if (hasCol.length === 0) {
      await q.query(`
        ALTER TABLE media_core
        ADD COLUMN deleted_at DATETIME NULL AFTER created_at
      `);
    }

    const hasIdx = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media_core'
        AND INDEX_NAME = 'idx_media_core_owner_status_deleted_created'
      LIMIT 1
    `);
    if (hasIdx.length === 0) {
      await q.query(`
        CREATE INDEX idx_media_core_owner_status_deleted_created
        ON media_core (owner_id, status, deleted_at, created_at DESC, id DESC)
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const hasIdx = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media_core'
        AND INDEX_NAME = 'idx_media_core_owner_status_deleted_created'
      LIMIT 1
    `);
    if (hasIdx.length > 0) {
      await q.query(`
        DROP INDEX idx_media_core_owner_status_deleted_created ON media_core
      `);
    }

    const hasCol = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media_core'
        AND COLUMN_NAME = 'deleted_at'
      LIMIT 1
    `);
    if (hasCol.length > 0) {
      await q.query(`
        ALTER TABLE media_core
        DROP COLUMN deleted_at
      `);
    }
  }
}
