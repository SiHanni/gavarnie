import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_follows')
@Unique('uq_user_follows_follower_followee', ['followerId', 'followeeId'])
@Index('idx_user_follows_follower_is_active', ['followerId', 'isActive'])
@Index('idx_user_follows_followee_is_active', ['followeeId', 'isActive'])
export class UserFollows {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  // follower: 팔로우 하는 사람(나)
  @Column({ name: 'follower_id', type: 'bigint' })
  followerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id', referencedColumnName: 'id' })
  follower!: User;

  // followee: 팔로우 받는 사람(상대)
  @Column({ name: 'followee_id', type: 'bigint' })
  followeeId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followee_id', referencedColumnName: 'id' })
  followee!: User;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: () => '1' })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
