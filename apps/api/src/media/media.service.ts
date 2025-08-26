import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { S3Service } from '../storage/s3.service';
import { Media } from './media.entity';
import { Inject } from '@nestjs/common';
import { TRANSCODE_QUEUE } from '../queue/queue.module';
import { Queue } from 'bullmq';
import { MEDIA_EXTS } from './exts';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media) private readonly repo: Repository<Media>,
    private readonly s3: S3Service,
    @Inject(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}

  private ensureAllowed(contentType: string, filename: string) {
    const ct = (contentType || '').toLowerCase();
    if (ct.startsWith('video/') || ct.startsWith('audio/')) return;

    // 브라우저가 MIME을 못 주는 경우(application/octet-stream)만 확장자로 보조 판단
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (ct === 'application/octet-stream' && MEDIA_EXTS.has(ext)) return;

    throw new BadRequestException('Only audio/video files are allowed');
  }

  async createPresign(originalFilename: string, contentType: string) {
    this.ensureAllowed(contentType, originalFilename);

    const id = uuidv4();

    const key = `original/${id}`;

    const media = this.repo.create({
      id,
      originalFilename,
      contentType,
      srcKey: key,
      status: 'UPLOADING',
    });
    await this.repo.save(media);

    const presign = await this.s3.presignedPut(key, contentType);
    return { mediaId: media.id, ...presign };
  }

  async completeUpload(mediaId: string, key: string, size?: number) {
    const media = await this.repo.findOne({ where: { id: mediaId } });
    if (!media) throw new BadRequestException('media not found');
    if (media.srcKey !== key) throw new BadRequestException('key mismatch');

    media.size = size ?? null;
    media.status = 'QUEUED';
    await this.repo.save(media);

    await this.transcodeQueue.add(
      'hls',
      { mediaId: media.id, srcKey: media.srcKey },
      {
        removeOnComplete: true,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { ok: true };
  }
}
