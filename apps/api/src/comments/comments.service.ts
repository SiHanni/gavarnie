import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment, Media, MediaCore, User } from '@gavarnie/entities';
import { CommentReaction } from '@gavarnie/entities';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  ListCommentsResponseDto,
  CommentNodeDto,
} from './dto/comment-node.dto';
import { encodeCursor, decodeCursor } from '../media/utils/cursor.util';

type ListArgs = {
  mediaId: string;
  parentId?: string;
  limit: number;
  cursor?: string;
  currentUserId?: string;
};

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(MediaCore)
    private readonly coreRepository: Repository<MediaCore>,
    @InjectRepository(CommentReaction)
    private readonly commentReactionRepository: Repository<CommentReaction>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  private async mediaUuidToCoreId(mediaUuid: string): Promise<string> {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaUuid },
      relations: ['core'],
    });
    if (!media?.core?.id) throw new BadRequestException('media not found');
    return String(media.core.id);
  }

  /** 댓글/대댓글 작성 (depth: 0/1) */
  async create(dto: CreateCommentDto, userId: string) {
    const mediaCoreId = await this.mediaUuidToCoreId(dto.mediaId);

    let depth = 0;
    if (dto.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: dto.parentId, mediaCoreId },
      });
      if (!parent) throw new BadRequestException('parent comment not found');
      if (parent.depth >= 1)
        throw new BadRequestException('reply depth exceeded');
      depth = parent.depth + 1; // 1
    }

    const row = this.commentRepository.create({
      mediaCoreId,
      userId,
      parentId: dto.parentId ?? null,
      depth,
      text: dto.text,
    });
    const saved = await this.commentRepository.save(row);
    return {
      id: saved.id,
      parentId: saved.parentId ?? null,
      depth: saved.depth,
      text: saved.text,
      isDeleted: false,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /** 댓글 목록(루트) 또는 대댓글 목록(parentId 지정) – createdAt ASC, id ASC */
  async list(q: ListArgs): Promise<ListCommentsResponseDto> {
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const mediaCoreId = await this.mediaUuidToCoreId(q.mediaId);
    const cursor = decodeCursor(q.cursor);

    const qb = this.commentRepository
      .createQueryBuilder('c')
      .leftJoin('c.user', 'u')
      .where('c.media_id = :mcid', { mcid: mediaCoreId })
      .andWhere('c.parent_id ' + (q.parentId ? '= :pid' : 'IS NULL'), {
        pid: q.parentId ?? null,
      })
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);

    if (cursor) {
      const ts = new Date(cursor.createdAt);
      if (isNaN(ts.getTime())) throw new BadRequestException('Invalid cursor');
      qb.andWhere(
        '(c.created_at > :ts) OR (c.created_at = :ts AND c.id > :cid)',
        { ts, cid: cursor.id },
      );
    }

    // 필요한 컬럼만 선택 (민감정보 배제)
    qb.select([
      'c.id           AS c_id',
      'c.parent_id    AS c_parent_id',
      'c.depth        AS c_depth',
      'c.text         AS c_text',
      'c.created_at   AS c_created_at',
      'c.deleted_at   AS c_deleted_at',

      'u.id           AS u_id',
      'u.display_name AS u_display_name',
      'u.avatar_url   AS u_avatar_url',
      'u.handle       AS u_handle', // ← handle 추가
    ]);

    const raw = await qb.getRawMany<{
      c_id: string;
      c_parent_id: string | null;
      c_depth: number;
      c_text: string;
      c_created_at: Date;
      c_deleted_at: Date | null;
      u_id: string;
      u_display_name: string;
      u_avatar_url: string | null;
      u_handle: string;
    }>();

    const hasNextPage = raw.length > limit;
    const pageRows = hasNextPage ? raw.slice(0, limit) : raw;

    // 페이지에 레코드가 없는 경우
    if (pageRows.length === 0) {
      return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    // 1) 이번 페이지 댓글 id 묶음
    const commentIds = pageRows.map((r) => String(r.c_id));

    // 2) 좋아요 집계 (is_active=1)
    const counts = await this.commentReactionRepository
      .createQueryBuilder('r')
      .select('r.comment_id', 'commentId')
      .addSelect(
        'SUM(CASE WHEN r.is_active = 1 THEN 1 ELSE 0 END)',
        'likeCount',
      )
      .where('r.comment_id IN (:...ids)', { ids: commentIds })
      .groupBy('r.comment_id')
      .getRawMany<{ commentId: string; likeCount: string }>();

    const likeCountMap = new Map<string, number>(
      counts.map((c) => [String(c.commentId), Number(c.likeCount)]),
    );

    // 3) 내가 좋아요 눌렀는지 (선택)
    let likedByMeMap = new Map<string, boolean>();
    if (q.currentUserId) {
      const liked = await this.commentReactionRepository
        .createQueryBuilder('r')
        .select('r.comment_id', 'commentId')
        .where('r.user_id = :uid AND r.is_active = 1', { uid: q.currentUserId })
        .andWhere('r.comment_id IN (:...ids)', { ids: commentIds })
        .getRawMany<{ commentId: string }>();
      likedByMeMap = new Map(liked.map((r) => [String(r.commentId), true]));
    }

    // 4) 응답 매핑
    const nodes: CommentNodeDto[] = pageRows.map((r) => ({
      id: String(r.c_id),
      parentId: r.c_parent_id ?? null,
      depth: Number(r.c_depth),
      text: r.c_deleted_at ? '' : r.c_text,
      isDeleted: !!r.c_deleted_at,
      createdAt: new Date(r.c_created_at).toISOString(),
      author: {
        id: String(r.u_id),
        displayName: r.u_display_name,
        avatarUrl: r.u_avatar_url ?? null,
        handle: r.u_handle, // ← handle 포함
      },
      likeCount: likeCountMap.get(String(r.c_id)) ?? 0,
      ...(q.currentUserId
        ? { likedByMe: !!likedByMeMap.get(String(r.c_id)) }
        : {}),
    }));

    const last = pageRows.at(-1)!;
    const endCursor = encodeCursor({
      createdAt: new Date(last.c_created_at).toISOString(),
      id: String(last.c_id),
    });

    return { nodes, pageInfo: { hasNextPage, endCursor } };
  }

  /** 댓글 soft delete (본인만) */
  async softDelete(commentId: string, requesterUserId: string) {
    const c = await this.commentRepository.findOne({
      where: { id: commentId },
    });
    if (!c) throw new BadRequestException('comment not found');
    if (String(c.userId) !== String(requesterUserId)) {
      throw new ForbiddenException('not your comment');
    }
    if (c.deletedAt) return { ok: true }; // 멱등

    c.deletedAt = new Date();
    await this.commentRepository.save(c);
    return { ok: true };
  }
}
