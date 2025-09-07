import { MediaCore } from '../media/media-core.entity';
import {
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

export type UserGrade = 'basic' | 'plus' | 'premium';

@Entity('users')
// 기존 이메일 고유 제약 유지
@Unique(['email'])
// 핸들 고유 제약 추가 (이름을 명시하고 싶으면 @Unique('uq_users_handle', ['handle']))
@Unique(['handle'])
export class User {
  // BIGINT AUTO_INCREMENT → JS 정밀도 이슈 회피 위해 string 사용
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  // 마이그레이션과 일치: NULL 허용
  @Column({
    name: 'status_message',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  statusMessage!: string | null;

  // 새로 추가된 @handle (NOT NULL, 30자, 대소문자/악센트 비구분 콜레이션)
  // 주: MySQL 8 이상에서 'utf8mb4_0900_ai_ci' 사용 가능
  @Column({
    name: 'handle',
    type: 'varchar',
    length: 30,
    nullable: false,
    collation: 'utf8mb4_0900_ai_ci',
  })
  handle!: string;

  @Column({
    name: 'user_grade',
    type: 'enum',
    enum: ['basic', 'plus', 'premium'],
    default: 'basic',
  })
  userGrade!: UserGrade;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;

  @Column({ name: 'avatar_cooldown_until', type: 'timestamp', nullable: true })
  avatarCooldownUntil?: Date | null;

  @Column({ name: 'avatar_updated_at', type: 'timestamp', nullable: true })
  avatarUpdatedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @OneToMany(() => MediaCore, mc => mc.owner)
  mediaCores!: MediaCore[];
}
