import { MigrationInterface, QueryRunner } from 'typeorm';

export default class CreateUserFollow20250905005500
  implements MigrationInterface
{
  name = 'CreateUserFollow20250905013305';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS user_follow (
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
      CREATE INDEX idx_user_follow_follower_active
      ON user_follow (follower_id, is_active);
    `);

    await q.query(`
      CREATE INDEX idx_user_follow_followee_active
      ON user_follow (followee_id, is_active);
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS user_follow;`);
  }
}
