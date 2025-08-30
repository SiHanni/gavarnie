import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AddCommentsParentFk20250831050030
  implements MigrationInterface
{
  name = 'AddCommentsParentFk20250831050030';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE comments
      ADD CONSTRAINT fk_comments_parent
      FOREIGN KEY (parent_id) REFERENCES comments(id)
      ON DELETE CASCADE;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE comments
      DROP FOREIGN KEY fk_comments_parent;
    `);
  }
}
