import { MigrationInterface, QueryRunner } from 'typeorm';

// helper: index 존재 여부 체크
async function indexExists(
  qr: QueryRunner,
  table: string,
  index: string
): Promise<boolean> {
  const rows: Array<{ cnt: number }> = await qr.query(
    `
      SELECT COUNT(1) AS cnt
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      `,
    [table, index]
  );
  return (rows?.[0]?.cnt ?? 0) > 0;
}

// helper: 인덱스 보장 생성
async function ensureIndex(
  qr: QueryRunner,
  table: string,
  index: string,
  columnsExpr: string // e.g. "(status, updated_at DESC, id DESC)"
) {
  if (!(await indexExists(qr, table, index))) {
    await qr.query(`CREATE INDEX ${index} ON ${table} ${columnsExpr}`);
  }
}

// helper: 존재하면 인덱스 삭제
async function dropIndexIfExists(
  qr: QueryRunner,
  table: string,
  index: string
) {
  if (await indexExists(qr, table, index)) {
    // MySQL은 DROP INDEX idx ON table 또는 ALTER TABLE table DROP INDEX idx
    await qr.query(`ALTER TABLE ${table} DROP INDEX ${index}`);
  }
}

export default class Baseline20250825090900 implements MigrationInterface {
  name = 'Baseline20250825090900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        avatar_url VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media (
        id CHAR(36) PRIMARY KEY,
        original_filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(128) NOT NULL,
        src_key VARCHAR(512) NOT NULL,
        status ENUM('UPLOADING','QUEUED','PROCESSING','READY','FAILED') NOT NULL DEFAULT 'UPLOADING',
        size BIGINT NULL,
        hls_key VARCHAR(512) NULL,
        error TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    await ensureIndex(
      queryRunner,
      'media',
      'idx_media_status_updated_id',
      '(status, updated_at DESC, id DESC)'
    );

    await ensureIndex(queryRunner, 'media', 'idx_media_hls_key', '(hls_key)');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS media_core (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        media_id CHAR(36) NOT NULL,
        owner_id BIGINT NOT NULL,
        status ENUM('draft','processing','published','rejected') NOT NULL DEFAULT 'processing',
        title VARCHAR(200) NOT NULL,
        description TEXT NULL,
        duration_sec INT NULL,
        published_at DATETIME NULL,
        like_count INT NOT NULL DEFAULT 0,
        dislike_count INT NOT NULL DEFAULT 0,
        comment_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_media_core_media FOREIGN KEY (media_id) REFERENCES media(id),
        CONSTRAINT fk_media_core_owner FOREIGN KEY (owner_id) REFERENCES users(id),
        CONSTRAINT uq_media_core_media UNIQUE (media_id)
      ) ENGINE=InnoDB;
    `);

    await ensureIndex(
      queryRunner,
      'media_core',
      'idx_media_status_pub',
      '(status, published_at DESC)'
    );
    await ensureIndex(
      queryRunner,
      'media_core',
      'idx_media_owner_created',
      '(owner_id, created_at DESC)'
    );

    await queryRunner.query(`
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

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        media_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        parent_id BIGINT NULL,
        depth TINYINT NOT NULL DEFAULT 0,
        text TEXT NOT NULL,
        like_count INT NOT NULL DEFAULT 0,
        dislike_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        FOREIGN KEY (media_id) REFERENCES media_core(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB;
    `);

    await ensureIndex(
      queryRunner,
      'comments',
      'idx_comments_media_parent_created',
      '(media_id, parent_id, created_at)'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropIndexIfExists(
      queryRunner,
      'comments',
      'idx_comments_media_parent_created'
    );
    await queryRunner.query(`DROP TABLE IF EXISTS comments`);

    await queryRunner.query(`DROP TABLE IF EXISTS reactions`);

    await dropIndexIfExists(
      queryRunner,
      'media_core',
      'idx_media_owner_created'
    );
    await dropIndexIfExists(queryRunner, 'media_core', 'idx_media_status_pub');
    await queryRunner.query(
      `ALTER TABLE media_core DROP FOREIGN KEY fk_media_core_media`
    );
    await queryRunner.query(
      `ALTER TABLE media_core DROP FOREIGN KEY fk_media_core_owner`
    );
    await queryRunner.query(`DROP TABLE IF EXISTS media_core`);

    await dropIndexIfExists(queryRunner, 'media', 'idx_media_hls_key');
    await dropIndexIfExists(
      queryRunner,
      'media',
      'idx_media_status_updated_id'
    );
    await queryRunner.query(`DROP TABLE IF EXISTS media`);

    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
