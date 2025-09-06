import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AlterMediaAddDeletedAt20250907052704
  implements MigrationInterface
{
  name = 'AlterMediaAddDeletedAt20250907052704';

  public async up(q: QueryRunner): Promise<void> {
    // 1) 컬럼 존재 검사 후 추가
    const hasCol = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media'
        AND COLUMN_NAME = 'deleted_at'
      LIMIT 1
    `);
    if (hasCol.length === 0) {
      await q.query(`
        ALTER TABLE media
        ADD COLUMN deleted_at DATETIME NULL AFTER updated_at
      `);
    }

    // 2) 인덱스 존재 검사 후 추가 (deleted_at 포함 쿼리 최적화)
    const hasIdx = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media'
        AND INDEX_NAME = 'idx_media_status_deleted_created'
      LIMIT 1
    `);
    if (hasIdx.length === 0) {
      await q.query(`
        CREATE INDEX idx_media_status_deleted_created
        ON media (status, deleted_at, created_at DESC, id DESC)
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    // 인덱스가 있을 때만 제거
    const hasIdx = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media'
        AND INDEX_NAME = 'idx_media_status_deleted_created'
      LIMIT 1
    `);
    if (hasIdx.length > 0) {
      await q.query(`
        DROP INDEX idx_media_status_deleted_created ON media
      `);
    }

    // 컬럼이 있을 때만 제거
    const hasCol = await q.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'media'
        AND COLUMN_NAME = 'deleted_at'
      LIMIT 1
    `);
    if (hasCol.length > 0) {
      await q.query(`
        ALTER TABLE media
        DROP COLUMN deleted_at
      `);
    }
  }
}
