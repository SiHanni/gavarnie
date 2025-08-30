import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { MediaCore } from '../media/media-core.entity';
import { User } from '../user/user.entity';

@Entity('comments')
@Index('idx_comments_media_parent_created', [
  'mediaCoreId',
  'parentId',
  'createdAt',
])
@Index('idx_comments_parent_created', ['parentId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  // media_id는 media_core.id를 참조합니다(클라이언트 mediaId(UUID) → service에서 coreId로 해석)
  @Column({ name: 'media_id', type: 'bigint' })
  mediaCoreId!: string;

  @ManyToOne(() => MediaCore, mc => mc.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'media_id', referencedColumnName: 'id' })
  mediaCore!: MediaCore;

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user!: User;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string | null;

  @ManyToOne(() => Comment, c => c.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id', referencedColumnName: 'id' })
  parent?: Comment | null;

  @OneToMany(() => Comment, c => c.parent)
  children!: Comment[];

  @Column({ name: 'depth', type: 'tinyint', default: () => '0' })
  depth!: number; // 0=댓글, 1=대댓글

  @Column({ name: 'text', type: 'text' })
  text!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt?: Date | null;
}
