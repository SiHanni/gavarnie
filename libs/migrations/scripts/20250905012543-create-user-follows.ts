import { MigrationInterface, QueryRunner } from 'typeorm';

export default class CreateUserFollows20250905005500
  implements MigrationInterface
{
  name = 'CreateUserFollows20250905013305';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        follower_id BIGINT NOT NULL,
        followee_id BIGINT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_follow_follower
          FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_follow_followee
          FOREIGN KEY (followee_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT uq_user_follow UNIQUE (follower_id, followee_id)
      ) ENGINE=InnoDB;
    `);

    await q.query(`
      CREATE INDEX idx_user_follows_follower_active
      ON user_follows (follower_id, is_active);
    `);

    await q.query(`
      CREATE INDEX idx_user_follows_followee_active
      ON user_follows (followee_id, is_active);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS user_follows;`);
  }
}
