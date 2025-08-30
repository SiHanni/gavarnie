import { MigrationInterface, QueryRunner } from 'typeorm';

export default class CreateMediaReaction20250831050040
  implements MigrationInterface
{
  name = 'CreateMediaReaction20250831050040';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS media_reaction (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        media_core_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_media_reaction_media_core
          FOREIGN KEY (media_core_id) REFERENCES media_core(id) ON DELETE CASCADE,
        CONSTRAINT fk_media_reaction_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_media_reaction UNIQUE (media_core_id, user_id)
      ) ENGINE=InnoDB;
    `);

    await q.query(`
      CREATE INDEX idx_media_reaction_media_is_active
      ON media_reaction (media_core_id, is_active);
    `);

    await q.query(`
      CREATE INDEX idx_media_reaction_user
      ON media_reaction (user_id);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS media_reaction;`);
  }
}
