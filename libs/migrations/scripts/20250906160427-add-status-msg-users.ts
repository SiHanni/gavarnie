import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AddStatusMessageToUsers20250906160427
  implements MigrationInterface
{
  name = 'AddStatusMessageToUsers20250906160427';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users
      ADD COLUMN status_message VARCHAR(255) NULL AFTER display_name;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users
      DROP COLUMN status_message;
    `);
  }
}
