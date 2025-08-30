import { MigrationInterface, QueryRunner } from 'typeorm';

export default class CreateCommentReaction20250831050050
  implements MigrationInterface
{
  name = 'CreateCommentReaction20250831050050';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS comment_reaction (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        comment_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_comment_reaction_comment
          FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        CONSTRAINT fk_comment_reaction_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_comment_reaction UNIQUE (comment_id, user_id)
      ) ENGINE=InnoDB;
    `);

    await q.query(`
      CREATE INDEX idx_comment_reaction_comment_is_active
      ON comment_reaction (comment_id, is_active);
    `);

    await q.query(`
      CREATE INDEX idx_comment_reaction_user
      ON comment_reaction (user_id);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS comment_reaction;`);
  }
}
