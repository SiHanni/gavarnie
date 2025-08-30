import { MigrationInterface, QueryRunner } from 'typeorm';

export default class DropPrototypeReactions20250831050010
  implements MigrationInterface
{
  name = 'DropPrototypeReactions20250831050010';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS reactions;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        target_type ENUM('media','comment') NOT NULL,
        target_id BIGINT NOT NULL,
        value TINYINT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_react (user_id, target_type, target_id)
      ) ENGINE=InnoDB;
    `);
  }
}
