import { MigrationInterface, QueryRunner } from 'typeorm';

export default class CreateAvatarChange20250907195740
  implements MigrationInterface
{
  name = 'CreateAvatarChange20250907195740';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS avatar_change (
        id CHAR(36) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_avatar_change_user_created (user_id, created_at)
      ) ENGINE=InnoDB;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS avatar_change;`);
  }
}
