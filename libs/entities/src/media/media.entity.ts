import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MediaStatus =
  | 'UPLOADING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

@Entity({ name: 'media' })
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  originalFilename!: string;

  @Column({ length: 128 })
  contentType!: string;

  @Column({ length: 512 })
  srcKey!: string; // 예: original/{id}.mp4

  @Column({ type: 'varchar', length: 32, default: 'UPLOADING' })
  status!: MediaStatus;

  @Column({ type: 'bigint', nullable: true })
  size!: number | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  hlsKey!: string | null; // 예: hls/{id}/index.m3u8

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
