import {
  Entity,
  Unique,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  Index,
  OneToMany,
} from 'typeorm';
import { Media } from './media.entity';
import { User } from '../user/user.entity';
import { MediaReaction } from './media-reaction.entity';
import { Comment } from './comment.entity';

export type MediaCoreStatus = 'draft' | 'processing' | 'published' | 'rejected';

@Entity('media_core')
@Unique(['mediaId'])
export class MediaCore {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'media_id', type: 'char', length: 36 })
  mediaId!: string;

  @Column({ name: 'owner_id', type: 'bigint' })
  ownerId!: string;

  @Index('idx_media_status_pub')
  @Column({
    type: 'enum',
    enum: ['draft', 'processing', 'published', 'rejected'],
    default: 'processing',
  })
  status!: MediaCoreStatus;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'duration_sec', type: 'int', nullable: true })
  durationSec!: number | null;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt!: Date | null;

  @OneToOne(() => Media, m => m.core, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_id', referencedColumnName: 'id' })
  media!: Media;

  @ManyToOne(() => User, u => u.mediaCores, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id', referencedColumnName: 'id' })
  owner!: User;

  @OneToMany(() => MediaReaction, r => r.mediaCore)
  reactions!: MediaReaction[];

  @OneToMany(() => Comment, c => c.mediaCore)
  comments!: Comment[];
}
