import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';

import { S3Service } from '../storage/s3.service';
import { Comment, Media, MediaReaction, User } from '@catarie/entities';
import { MediaCore } from '@catarie/entities';
import { TRANSCODE_QUEUE } from '../queue/queue.module';
import { MEDIA_EXTS } from './exts';
import { decodeCursor, encodeCursor } from './utils/cursor.util';
import { RecentResponseDto, RecentMediaNode } from './dto/recent.dto';
import { guessContentType } from './utils/media-infer';
import { UPLOAD_POLICY, UserGrade } from './uploads/upload-policy';

type GetRecentParams = {
  limit?: number;
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly s3: S3Service,
    @Inject(TRANSCODE_QUEUE) private readonly transcodeQueue: Queue,
  ) {}

  /** 파일명에서 확장자 제거 */
  private getFilenameWithoutExtension(name: string) {
    const base = path.basename(name);
    return base.replace(/\.[^.]+$/, '');
  }

  /**
   * 업로드 허용 MIME/확장자 검증
   */
  private ensureAllowed(contentType?: string, filename?: string) {
    const mime = String(contentType ?? '')
      .trim()
      .toLowerCase();

    // 1) 명확한 미디어 MIME 우선 허용
    if (mime.startsWith('video/') || mime.startsWith('audio/')) return;

    // 2) 확장자 추출
    const base = path.basename(String(filename ?? ''));
    const dot = base.lastIndexOf('.');
    const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';

    // 3) 제네릭 MIME → 확장자로 판단
    const isGenericMime =
      mime === '' ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream';
    if (isGenericMime) {
      if (MEDIA_EXTS.has(ext)) return;
      throw new BadRequestException('Only audio/video files are allowed');
    }

    // 4) MIME이 애매해도 확장자가 미디어면 허용
    if (MEDIA_EXTS.has(ext)) return;

    // 5) 최종 거절
    throw new BadRequestException('Only audio/video files are allowed');
  }

  /**
   * Presigned URL 생성
   */
  async createPresign(
    originalFilename: string,
    contentType: string | undefined,
    ownerId: string,
    title: string | undefined,
  ) {
    // 0) 서버 측 content-type 추론
    const resolvedContentType =
      contentType ?? guessContentType(originalFilename);

    // 1) 화이트리스트 체크
    this.ensureAllowed(resolvedContentType, originalFilename);

    const id = uuidv4();
    const safeName = originalFilename.replace(/[^\w.\-()+\[\]{}@]/g, '_');
    const key = `original/${id}/${safeName}`;

    // 타이틀 처리
    const baseTitle = this.getFilenameWithoutExtension(originalFilename);
    const requestedDisplayTitle = (title ?? '').trim();
    const displayTitle =
      requestedDisplayTitle.length > 0 ? requestedDisplayTitle : baseTitle;

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
        title: displayTitle,
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
   * 업로드 완료 후 DB 갱신 + HLS 변환 큐 적재
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

    // 중복 큐잉 방지
    if (['QUEUED', 'PROCESSING', 'READY'].includes(media.status)) {
      return { ok: true, id: media.id, status: media.status };
    }

    const core = await this.mediaCoreRepository.findOne({ where: { mediaId } });
    if (!core) throw new BadRequestException('media_core missing');
    if (core.ownerId !== ownerId)
      throw new ForbiddenException('not your media');

    // S3 실제 용량 확인
    const anyS3 = this.s3 as any as {
      bucket: string;
      s3: import('@aws-sdk/client-s3').S3Client;
    };
    const head = await anyS3.s3.send(
      new HeadObjectCommand({ Bucket: anyS3.bucket, Key: key }),
    );
    const actualSize = head.ContentLength ?? 0;
    if (!actualSize || actualSize <= 0) {
      throw new BadRequestException('object not found or zero size');
    }

    // 등급별 용량 제한 (정책 위반 시 즉시 삭제 + FAILED 기록)
    const owner = await this.userRepository.findOne({
      where: { id: ownerId },
      select: ['id', 'userGrade'],
    });
    const grade = ((owner?.userGrade as UserGrade) ?? 'basic') as UserGrade;
    const { maxFileMB } = UPLOAD_POLICY[grade];
    const maxBytes = maxFileMB * 1024 * 1024;

    if (actualSize > maxBytes) {
      await anyS3.s3.send(
        new DeleteObjectCommand({ Bucket: anyS3.bucket, Key: key }),
      );
      media.status = 'FAILED';
      media.error = `FILE_TOO_LARGE:${actualSize}>${maxBytes} (grade=${grade})`;
      await this.mediaRepository.save(media);

      throw new BadRequestException(
        `파일이 등급 한도(${maxFileMB}MB)를 초과했습니다.`,
      );
    }

    // 통과 → 큐 적재
    media.size = actualSize;
    media.status = 'QUEUED';
    await this.mediaRepository.save(media);

    await this.transcodeQueue.add(
      'hls',
      { mediaId: media.id, srcKey: media.srcKey },
      {
        jobId: media.id,
        removeOnComplete: true, // 완료된 작업은 바로 제거
        removeOnFail: 1000, // 실패한 작업은 최근 1000개만 보관
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return { ok: true, id: media.id, status: media.status };
  }

  /**
   * 처리 상태 조회 — 소유자 전용
   * 컨트롤러에서 JwtAuthGuard 적용 후, currentUserId를 함께 넘겨야 함.
   */
  async getStatus(id: string, currentUserId: string) {
    const media = await this.mediaRepository.findOne({ where: { id } });
    if (!media) throw new NotFoundException('media not found');

    const core = await this.mediaCoreRepository.findOne({
      where: { mediaId: id },
      select: ['ownerId', 'deletedAt'],
    });
    if (!core) throw new NotFoundException('media_core missing');

    if (core.deletedAt || media.deletedAt) {
      throw new NotFoundException('media deleted');
    }
    if (String(core.ownerId) !== String(currentUserId)) {
      throw new ForbiddenException('not your media');
    }
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
   * READY 상태 콘텐츠(전역 피드)
   * - published만 노출
   * - 커서: (createdAt DESC, id DESC) 엄격 이전
   */
  async getRecent(dto: GetRecentParams): Promise<RecentResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = decodeCursor(dto.cursor);

    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .innerJoin('media.core', 'mediaCore')
      .innerJoin('mediaCore.owner', 'owner')
      .where('media.status = :ready', { ready: 'READY' })
      .andWhere('media.hlsKey IS NOT NULL')
      .andWhere('mediaCore.status = :pub', { pub: 'published' })
      // ⬇️ 소프트 삭제 차단 (추가)
      .andWhere('media.deleted_at IS NULL')
      .andWhere('mediaCore.deleted_at IS NULL')
      .orderBy('media.createdAt', 'DESC')
      .addOrderBy('media.id', 'DESC')
      .limit(limit + 1)
      .select([
        'media.id                 AS m_id',
        'media.hls_key            AS m_hls_key',
        'media.original_filename  AS m_original_filename',
        'media.content_type       AS m_content_type',
        'media.size               AS m_size',
        'media.created_at         AS m_created_at',

        'mediaCore.id            AS mc_id',
        'mediaCore.title         AS mc_title',

        'owner.id                AS owner_id',
        'owner.display_name      AS owner_display_name',
        'owner.avatar_url        AS owner_avatar_url',
        'owner.handle            AS owner_handle', // ← handle select
      ]);

    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      if (isNaN(cursorDate.getTime())) {
        throw new BadRequestException('Invalid cursor');
      }
      qb.andWhere(
        '(media.created_at < :cud) OR (media.created_at = :cud AND media.id < :cid)',
        { cud: cursorDate, cid: cursor.id },
      );
    }

    const raw = await qb.getRawMany<{
      m_id: string;
      m_hls_key: string | null;
      m_original_filename: string;
      m_content_type: string;
      m_size: string | number | null;
      m_created_at: Date;

      mc_id: string;
      mc_title: string;

      owner_id: string;
      owner_display_name: string;
      owner_avatar_url: string | null;
      owner_handle: string;
    }>();

    const hasNextPage = raw.length > limit;
    const pageRows = hasNextPage ? raw.slice(0, limit) : raw;

    if (pageRows.length === 0) {
      return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    // 집계용 core id 모음
    const mediaCoreIds = pageRows.map((r) => String(r.mc_id));

    // 좋아요 집계 (is_active=1)
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
      title: r.mc_title,
      contentType: r.m_content_type,
      size: r.m_size === null ? null : Number(r.m_size),
      createdAt: new Date(r.m_created_at).toISOString(),
      author: {
        id: String(r.owner_id),
        displayName: r.owner_display_name,
        avatarUrl: r.owner_avatar_url ?? null,
        handle: r.owner_handle, // ← handle 포함
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

  /**
   * 내 콘텐츠 소프트 삭제
   * - 소유자만 가능
   * - media / media_core 둘 다 deleted_at 설정
   * - 후처리(S3 객체 정리)는 별도 워커로 확장 권장
   */
  async softDeleteMedia(mediaUuid: string, requesterUserId: string) {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaUuid },
    });
    if (!media) throw new NotFoundException('media not found');

    const core = await this.mediaCoreRepository.findOne({
      where: { mediaId: mediaUuid },
      select: ['id', 'ownerId', 'deletedAt'],
    });
    if (!core) throw new NotFoundException('media_core missing');

    if (String(core.ownerId) !== String(requesterUserId)) {
      throw new ForbiddenException('not your media');
    }
    if (media.deletedAt || core.deletedAt) {
      // 멱등 처리
      return { ok: true, deleted: true, id: media.id };
    }

    const now = new Date();
    await this.mediaRepository.update({ id: mediaUuid }, { deletedAt: now });
    await this.mediaCoreRepository.update(
      { mediaId: mediaUuid },
      { deletedAt: now },
    );

    // (선택) S3 정리 작업 큐 등록 예시:
    // await this.transcodeQueue.add('cleanup', { mediaId: media.id, srcKey: media.srcKey }, { removeOnComplete: true });

    return { ok: true, deleted: true, id: media.id };
  }

  /**
   * 공개 스트리밍 메타 조회용 안전 쿼리
   * - 소프트삭제 차단
   * - 미발행 차단
   * - READY + HLS 존재 필수
   */
  async findOnePublicHlsMeta(id: string) {
    const row = await this.mediaRepository
      .createQueryBuilder('m')
      .innerJoin('m.core', 'c')
      .where('m.id = :id', { id })
      .andWhere('m.deleted_at IS NULL')
      .andWhere('c.deleted_at IS NULL')
      .andWhere('c.status = :pub', { pub: 'published' })
      .select(['m.id AS id', 'm.status AS status', 'm.hls_key AS hlsKey'])
      .getRawOne<{
        id: string;
        status: 'READY' | string;
        hlsKey: string | null;
      }>();

    if (!row) {
      // 존재하지 않거나 비공개/삭제된 경우 동일하게 404 처리
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }

    if (row.status !== 'READY' || !row.hlsKey) {
      // 존재는 하지만 아직 공개 불가 상태
      throw new HttpException('Media is not READY', HttpStatus.CONFLICT);
    }

    return { id: row.id, status: row.status, hlsKey: row.hlsKey };
  }
}
