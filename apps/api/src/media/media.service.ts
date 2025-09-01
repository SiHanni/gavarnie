import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3Service } from '../storage/s3.service';
import { Comment, Media, MediaReaction, User } from '@gavarnie/entities';
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

type GetRecentArgs = {
  limit: number;
  cursor?: string;
  currentUserId?: string;
};
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(MediaCore)
    private readonly mediaCoreRepository: Repository<MediaCore>,
    @InjectRepository(MediaReaction)
    private readonly mediaReactionRepository: Repository<MediaReaction>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
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
      createdAt: media.createdAt,
    };
  }

  async findOne(id: string) {
    return this.mediaRepository.findOne({ where: { id } });
  }

  /**
   * READY 상태인 컨텐츠 목록 반환
   * 커서 조건: (createdAt, id) 튜플의 "엄격히 이전"만 가져오기
   *
   */
  async getRecent(dto: RecentQueryDto): Promise<RecentResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = decodeCursor(dto.cursor);

    // ORDER BY createdAt DESC, id DESC 를 쓰므로, where:
    // (createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)
    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .innerJoin('media.core', 'mediaCore')
      .innerJoin('mediaCore.owner', 'owner')
      .where('media.status = :ready', { ready: 'READY' })
      .andWhere('media.hlsKey IS NOT NULL')
      .orderBy('media.createdAt', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .limit(limit + 1); // hasNextPage 판단용으로 하나 더 가져오기

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      if (isNaN(cursorDate.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }
      qb.andWhere(
        '(media.createdAt < :cud) OR (media.createdAt = :cud AND media.id < :cid)',
        { cud: cursorDate, cid: cursor.id },
      );
    }

    // 필요한 컬럼만 선택 (민감정보 배제)
    qb.select([
      'media.id             AS m_id',
      'media.hls_key        AS m_hls_key',
      'media.original_filename AS m_original_filename',
      'media.content_type   AS m_content_type',
      'media.size           AS m_size',
      'media.created_at     AS m_created_at',
      'mediaCore.id            AS mc_id',
      'owner.id             AS owner_id',
      'owner.display_name   AS owner_display_name',
      'owner.avatar_url     AS owner_avatar_url',
    ]);

    const raw = await qb.getRawMany<{
      m_id: string;
      m_hls_key: string | null;
      m_original_filename: string;
      m_content_type: string;
      m_size: string | number | null;
      m_created_at: Date;
      mc_id: string; // BIGINT
      owner_id: string;
      owner_display_name: string;
      owner_avatar_url: string | null;
    }>();

    const hasNextPage = raw.length > limit;
    const pageRows = hasNextPage ? raw.slice(0, limit) : raw;

    if (pageRows.length === 0) {
      return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    // 이번 페이지 묶음 id
    const mediaCoreIds = pageRows.map((r) => String(r.mc_id)); // for 리액션, 댓글

    // 좋아요 집계 (is_active=1만)
    const likeRows = await this.mediaReactionRepository
      .createQueryBuilder('mediaReaction')
      .select('mediaReaction.media_core_id', 'mcid')
      .addSelect(
        'SUM(CASE WHEN mediaReaction.is_active = 1 THEN 1 ELSE 0 END)',
        'likeCount',
      )
      .where('mediaReaction.media_core_id IN (:...ids)', { ids: mediaCoreIds })
      .groupBy('mediaReaction.media_core_id')
      .getRawMany<{ mcid: string; likeCount: string }>();

    const likeCountMap = new Map<string, number>(
      likeRows.map((r) => [String(r.mcid), Number(r.likeCount)]),
    );

    // 댓글 수 집계 (삭제되지 않은 것만)
    const commentRows = await this.commentRepository
      .createQueryBuilder('comment')
      .select('comment.media_id', 'mcid')
      .addSelect('COUNT(*)', 'cnt')
      .where('comment.media_id IN (:...ids)', { ids: mediaCoreIds })
      .andWhere('comment.deleted_at IS NULL')
      .groupBy('comment.media_id')
      .getRawMany<{ mcid: string; cnt: string }>();
    const commentCountMap = new Map(
      commentRows.map((r) => [String(r.mcid), Number(r.cnt)]),
    );

    // 내가 좋아요 눌렀는지 (선택)
    let likedByMeMap = new Map<string, boolean>();
    if (dto.currentUserId) {
      const liked = await this.mediaReactionRepository
        .createQueryBuilder('reaction')
        .select('reaction.media_core_id', 'mcid')
        .where('reaction.user_id = :uid AND reaction.is_active = 1', {
          uid: dto.currentUserId,
        })
        .andWhere('reaction.media_core_id IN (:...ids)', { ids: mediaCoreIds })
        .getRawMany<{ mcid: string }>();
      likedByMeMap = new Map(liked.map((r) => [String(r.mcid), true]));
    }

    // 응답 매핑
    const nodes: RecentMediaNode[] = pageRows.map((r) => ({
      id: r.m_id,
      hlsKey: r.m_hls_key ?? '',
      originalFilename: r.m_original_filename,
      contentType: r.m_content_type,
      size: r.m_size === null ? null : Number(r.m_size),
      createdAt: new Date(r.m_created_at).toISOString(),
      author: {
        id: String(r.owner_id),
        displayName: r.owner_display_name,
        avatarUrl: r.owner_avatar_url ?? null,
      },
      likeCount: likeCountMap.get(String(r.mc_id)) ?? 0,
      commentCount: commentCountMap.get(String(r.mc_id)) ?? 0,
      ...(dto.currentUserId
        ? { likedByMe: !!likedByMeMap.get(String(r.mc_id)) }
        : {}),
    }));

    const last = pageRows.at(-1)!;
    const endCursor = encodeCursor({
      createdAt: new Date(last.m_created_at).toISOString(),
      id: last.m_id,
    });

    return { nodes, pageInfo: { hasNextPage, endCursor } };
  }
}
