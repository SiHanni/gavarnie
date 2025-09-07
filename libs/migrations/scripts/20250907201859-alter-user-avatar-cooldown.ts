import { MigrationInterface, QueryRunner } from 'typeorm';

export default class AddAvatarCooldown20250907201859
  implements MigrationInterface
{
  name = 'AddAvatarCooldown20250907201859';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users
      ADD COLUMN avatar_cooldown_until DATETIME NULL;
    `);
    await q.query(`
      ALTER TABLE users
      ADD COLUMN avatar_updated_at DATETIME NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE users
      DROP COLUMN avatar_updated_at;
    `);
    await q.query(`
      ALTER TABLE users
      DROP COLUMN avatar_cooldown_until;
    `);
  }
}
