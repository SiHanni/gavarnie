import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AlterMediaCoreDropAggregates20250831050020
  implements MigrationInterface
{
  name = 'AlterMediaCoreDropAggregates20250831050020';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE media_core
        DROP COLUMN like_count,
        DROP COLUMN dislike_count,
        DROP COLUMN comment_count;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE media_core
        ADD COLUMN like_count INT NOT NULL DEFAULT 0,
        ADD COLUMN dislike_count INT NOT NULL DEFAULT 0,
        ADD COLUMN comment_count INT NOT NULL DEFAULT 0;
    `);
  }
}
