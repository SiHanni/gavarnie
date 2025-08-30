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
import { MediaCore } from './media-core.entity';
import { User } from '../user/user.entity';

@Entity('media_reaction')
@Unique('uq_media_reaction_media_core_user', ['mediaCoreId', 'userId'])
export class MediaReaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'media_core_id', type: 'bigint' })
  mediaCoreId!: string;

  @ManyToOne(() => MediaCore, mc => mc.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_core_id', referencedColumnName: 'id' })
  mediaCore!: MediaCore;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user!: User;

  @Index('idx_media_reaction_media_is_active')
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: () => '1' })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
