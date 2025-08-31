import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3Service } from '../storage/s3.service';
import { Media } from '@gavarnie/entities';
import { MediaCore } from '@gavarnie/entities';
import { TRANSCODE_QUEUE } from '../queue/queue.module';
import { MEDIA_EXTS } from './exts';
import * as path from 'path';
import { decodeCursor, encodeCursor } from './utils/cursor.util';
import {
  RecentQueryDto,
  RecentResponseDto,
  RecentMediaNode,
} from './dto/recent.dto';
import {
  Kind,
  guessContentType,
  inferKindByExtOrMime,
} from './utils/media-infer';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(MediaCore)
    private readonly mediaCoreRepository: Repository<MediaCore>,
    private readonly s3: S3Service,
    @Inject(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}

  /**
   * 업로드 대상의 mime 판단 (audio/video)
   * @param contentType
   * @param filename
   * @returns
   */
  private ensureAllowed(contentType?: string, filename?: string) {
    const mime = String(contentType ?? '')
      .trim()
      .toLowerCase();

    // 1) MIME이 확실히 미디어면 그대로 허용
    if (mime.startsWith('video/') || mime.startsWith('audio/')) return;

    // 2) 파일명에서 확장자 추출 (안전 파싱)
    const base = path.basename(String(filename ?? ''));
    const dot = base.lastIndexOf('.');
    const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';

    // 3) 브라우저/클라이언트가 MIME을 못 주거나 일반형으로 준 경우 → 확장자 보조
    //    (application/octet-stream, binary/octet-stream, 빈 문자열 등)
    const isGenericMime =
      mime === '' ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream';

    if (isGenericMime) {
      if (MEDIA_EXTS.has(ext)) return;
      throw new BadRequestException('Only audio/video files are allowed');
    }

    // 4) MIME이 애매하거나 잘못 왔는데, 확장자가 확실한 미디어인 경우
    //    (예: 일부 환경에서 .mp4인데 text/plain으로 오는 케이스)
    if (MEDIA_EXTS.has(ext)) return;

    // 5) 최종 거절
    throw new BadRequestException('Only audio/video files are allowed');
  }

  /**
   * Presigned URL 생성 API
   * @param originalFilename
   * @param contentType
   * @returns
   */
  async createPresign(
    originalFilename: string,
    contentType: string | undefined,
    ownerId: string,
    kind?: Kind,
  ) {
    // 0) 서버 추론
    const resolvedContentType =
      contentType ?? guessContentType(originalFilename);
    const resolvedKind =
      kind ?? inferKindByExtOrMime(originalFilename, resolvedContentType);

    // 1) 화이트리스트 체크
    this.ensureAllowed(resolvedContentType, originalFilename);

    const id = uuidv4();
    const safeName = originalFilename.replace(/[^\w.\-()+\[\]{}@]/g, '_');
    const key = `original/${id}/${safeName}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('REPEATABLE READ');

    try {
      await queryRunner.manager.insert(Media, {
        id,
        originalFilename,
        contentType: resolvedContentType,
        srcKey: key,
        status: 'UPLOADING',
        size: null,
        hlsKey: null,
        error: null,
      });
      await queryRunner.manager.insert(MediaCore, {
        mediaId: id,
        ownerId,
        status: 'processing',
        title: originalFilename,
        description: null,
        durationSec: null,
        publishedAt: null,
      });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return error;
    } finally {
      await queryRunner.release();
    }

    try {
      const presign = await this.s3.presignedPut(key, resolvedContentType);
      return { mediaId: id, ...presign };
    } catch (error) {
      this.logger?.warn?.(
        `presign failed: id=${id} key=${key} ct=${contentType}`,
      );
      throw error;
    }
  }

  /**
   * 업로드 완료 후 DB 레코드 갱신, HLS 변환 워커 큐 적재
   * @param mediaId
   * @param key
   * @param size
   * @returns
   */
  async completeUpload(
    mediaId: string,
    key: string,
    ownerId: string,
    size?: number,
  ) {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
    });
    if (!media) throw new BadRequestException('media not found');
    if (media.srcKey !== key) throw new BadRequestException('key mismatch');

    // 이미 적재된 상태면 중복 적재 방지
    if (['QUEUED', 'PROCESSING', 'READY'].includes(media.status)) {
      return { ok: true, id: media.id, status: media.status };
    }

    const core = await this.mediaCoreRepository.findOne({
      where: { mediaId: mediaId },
    });
    if (!core) throw new BadRequestException('media_core missing');
    if (core.ownerId !== ownerId)
      throw new ForbiddenException('not your media');

    // HEAD로 실제 존재/사이즈 확인
    // (S3Service 내부 필드 접근이 필요하면 public getter 제공하거나 여기서 S3Client, bucket 주입받도록 리팩토링 권장)
    const anyS3 = this.s3 as any as {
      bucket: string;
      s3: import('@aws-sdk/client-s3').S3Client;
    };
    const head = await anyS3.s3.send(
      new HeadObjectCommand({
        Bucket: anyS3.bucket,
        Key: key,
      }),
    );
    const actualSize = head.ContentLength ?? 0;
    if (!actualSize || actualSize <= 0) {
      throw new BadRequestException('object not found or zero size');
    }

    media.size = actualSize ?? null;
    media.status = 'QUEUED';
    await this.mediaRepository.save(media);

    await this.transcodeQueue.add(
      'hls',
      { mediaId: media.id, srcKey: media.srcKey },
      {
        jobId: media.id,
        removeOnComplete: false, // 로컬 개발 중에는 성공하더라도 큐를 삭제하지 않도록 = false
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { ok: true, id: media.id, status: media.status };
  }

  async getStatus(id: string) {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new NotFoundException('media not found');
    if (media.status !== 'READY') {
      throw new BadRequestException(`Media not ready (status=${media.status})`);
    }

    return {
      exists: true,
      id: media.id,
      status: media.status,
      srcKey: media.srcKey,
      hlsKey: media.hlsKey,
      size: media.size,
      updatedAt: media.updatedAt,
    };
  }

  async findOne(id: string) {
    return this.mediaRepository.findOne({ where: { id } });
  }

  /**
   * READY 상태인 컨텐츠 목록 반환
   * 커서 조건: (updatedAt, id) 튜플의 "엄격히 이전"만 가져오기
   *
   */
  async getRecent(dto: RecentQueryDto): Promise<RecentResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = decodeCursor(dto.cursor);

    // ORDER BY updatedAt DESC, id DESC 를 쓰므로, where:
    // (updatedAt < cursor.updatedAt) OR (updatedAt = cursor.updatedAt AND id < cursor.id)
    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .select([
        'media.id',
        'media.hlsKey',
        'media.originalFilename',
        'media.contentType',
        'media.size',
        'media.updatedAt',
      ])
      .where('media.status = :ready', { ready: 'READY' })
      .andWhere('media.hlsKey IS NOT NULL')
      .orderBy('media.updatedAt', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .limit(limit + 1); // hasNextPage 판단용으로 하나 더 가져오기

    if (cursor) {
      const cursorDate = new Date(cursor.updatedAt);
      if (isNaN(cursorDate.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }
      qb.andWhere(
        '(media.updatedAt < :cud) OR (media.updatedAt = :cud AND media.id < :cid)',
        { cud: cursorDate, cid: cursor.id },
      );
    }

    const rows = await qb.getMany();
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

    const nodes: RecentMediaNode[] = pageRows.map((m) => ({
      id: m.id,
      hlsKey: m.hlsKey!,
      originalFilename: m.originalFilename,
      contentType: m.contentType,
      size: m.size ?? null,
      updatedAt: m.updatedAt.toISOString(),
    }));

    const endCursor = pageRows.length
      ? encodeCursor({
          updatedAt: pageRows[pageRows.length - 1].updatedAt.toISOString(),
          id: pageRows[pageRows.length - 1].id,
        })
      : null;

    return {
      nodes,
      pageInfo: { endCursor, hasNextPage },
    };
  }
}
