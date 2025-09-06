import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AddMediaThumbnailColumns20250906203213
  implements MigrationInterface
{
  name = 'AddMediaThumbnailColumns20250906203213';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE media
        ADD COLUMN thumbnail_key VARCHAR(500) NULL COMMENT '대표 썸네일(예: poster_540.webp) 오브젝트 키',
        ADD COLUMN thumbnail_width INT NULL COMMENT '대표 썸네일 가로(px)',
        ADD COLUMN thumbnail_height INT NULL COMMENT '대표 썸네일 세로(px)',
        ADD COLUMN thumbnail_updated_at DATETIME NULL COMMENT '썸네일 생성/갱신 시각',
        ADD COLUMN thumbnail_version INT NOT NULL DEFAULT 1 COMMENT '캐시 무효화용 버전(?v=2 등)';
    `);

    await q.query(`
      CREATE INDEX idx_media_thumbnail_updated_at ON media (thumbnail_updated_at);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX idx_media_thumbnail_updated_at ON media;`);
    await q.query(`
      ALTER TABLE media
        DROP COLUMN thumbnail_version,
        DROP COLUMN thumbnail_updated_at,
        DROP COLUMN thumbnail_height,
        DROP COLUMN thumbnail_width,
        DROP COLUMN thumbnail_key;
    `);
  }
}
