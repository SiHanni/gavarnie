import { MigrationInterface, QueryRunner } from 'typeorm';

export default class DropCommentAggregates20250831060010
  implements MigrationInterface
{
  name = 'DropCommentAggregates20250831060010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE comments
        DROP COLUMN like_count,
        DROP COLUMN dislike_count;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE comments
        ADD COLUMN like_count INT NOT NULL DEFAULT 0,
        ADD COLUMN dislike_count INT NOT NULL DEFAULT 0;
    `);
  }
}
