CREATE DATABASE IF NOT EXISTS gavarnie_core CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE gavarnie_core;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS media (
  id CHAR(36) PRIMARY KEY,                               -- UUID (TypeORM: @PrimaryGeneratedColumn('uuid'))
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(128) NOT NULL,
  src_key VARCHAR(512) NOT NULL,                         -- 예: original/{id}.mp4
  status ENUM('UPLOADING','QUEUED','PROCESSING','READY','FAILED') NOT NULL DEFAULT 'UPLOADING',
  size BIGINT NULL,
  hls_key VARCHAR(512) NULL,                             -- 예: hls/{id}/index.m3u8
  error TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 인덱스 (상태별 최신 조회, HLS 필터링)
CREATE INDEX idx_media_status_updated_id ON media (status, updated_at DESC, id DESC);
CREATE INDEX idx_media_hls_key ON media (hls_key);

CREATE TABLE IF NOT EXISTS media_core (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  media_id CHAR(36) NOT NULL,                            -- FK → media(id)
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
  CONSTRAINT fk_media_core_media
    FOREIGN KEY (media_id) REFERENCES media(id),
  CONSTRAINT fk_media_core_owner
    FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT uq_media_core_media UNIQUE (media_id)       -- 1:1 매핑 가정 시 유니크 권장
) ENGINE=InnoDB;

-- 피드/조회 최적화 인덱스
CREATE INDEX idx_media_status_pub ON media_core (status, published_at DESC);
CREATE INDEX idx_media_owner_created ON media_core (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  target_type ENUM('media','comment') NOT NULL,
  target_id BIGINT NOT NULL,
  value TINYINT NOT NULL, -- 1 or -1
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_react (user_id, target_type, target_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  media_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  depth TINYINT NOT NULL DEFAULT 0, -- 0=댓글, 1=대댓글
  text TEXT NOT NULL,
  like_count INT NOT NULL DEFAULT 0,
  dislike_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (media_id) REFERENCES media_core(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE INDEX idx_comments_media_parent_created ON comments(media_id, parent_id, created_at);
