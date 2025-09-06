import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MediaCore } from './media-core.entity';

export type MediaStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

@Entity({ name: 'media' })
export class Media {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 128 })
  contentType!: string;

  @Column({ name: 'src_key', type: 'varchar', length: 512 })
  srcKey!: string; // 예: original/{id}.mp4

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'],
    default: 'UPLOADING',
  })
  status!: MediaStatus;

  @Column({ name: 'size', type: 'bigint', nullable: true })
  size!: number | null;

  @Column({ name: 'hls_key', type: 'varchar', length: 512, nullable: true })
  hlsKey!: string | null; // 예: hls/{id}/index.m3u8

  @Column({ name: 'error', type: 'text', nullable: true })
  error!: string | null;

  @Column({
    name: 'thumbnail_key',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  thumbnailKey!: string | null; // 예: thumbs/{id}/poster_540.webp

  @Column({ name: 'thumbnail_width', type: 'int', nullable: true })
  thumbnailWidth!: number | null;

  @Column({ name: 'thumbnail_height', type: 'int', nullable: true })
  thumbnailHeight!: number | null;

  @Column({ name: 'thumbnail_updated_at', type: 'datetime', nullable: true })
  thumbnailUpdatedAt!: Date | null;

  @Column({ name: 'thumbnail_version', type: 'int', default: 1 })
  thumbnailVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToOne(() => MediaCore, mc => mc.media)
  core!: MediaCore;
}
