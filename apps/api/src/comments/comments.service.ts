import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment, Media, MediaCore } from '@gavarnie/entities';
import { CreateCommentDto } from './dto/create-comment.dto';
import { encodeCursor, decodeCursor } from '../media/utils/cursor.util';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(MediaCore)
    private readonly coreRepo: Repository<MediaCore>,
  ) {}

  private async mediaUuidToCoreId(mediaUuid: string): Promise<string> {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaUuid },
      relations: ['core'], // relations쓰면 core데이터까지 가져오는걸로 아는데 굳이 왜?
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
  async list(q: {
    mediaId: string;
    parentId?: string;
    limit: number;
    cursor?: string;
  }) {
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50);
    const mediaCoreId = await this.mediaUuidToCoreId(q.mediaId);

    const cursor = decodeCursor(q.cursor);
    const qb = this.commentRepository
      .createQueryBuilder('c')
      .where('c.media_id = :mcid', { mcid: mediaCoreId })
      .andWhere('c.parent_id ' + (q.parentId ? '= :pid' : 'IS NULL'), {
        pid: q.parentId,
      })
      .orderBy('c.created_at', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .limit(limit + 1);

    if (cursor) {
      const ts = new Date(cursor.createdAt);
      if (isNaN(ts.getTime())) throw new BadRequestException('Invalid cursor');
      // (createdAt > ts) OR (createdAt = ts AND id > cursor.id)
      qb.andWhere(
        '(c.created_at > :ts) OR (c.created_at = :ts AND c.id > :cid)',
        { ts, cid: cursor.id },
      );
    }

    const rows = await qb.getMany();
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

    const nodes = pageRows.map((r) => ({
      id: r.id,
      parentId: r.parentId ?? null,
      depth: r.depth,
      text: r.deletedAt ? '' : r.text,
      isDeleted: !!r.deletedAt,
      createdAt: r.createdAt.toISOString(),
    }));

    const last = pageRows.at(-1);
    const endCursor = last
      ? encodeCursor({
          createdAt: last.createdAt.toISOString(),
          id: String(last.id),
        })
      : null;

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
    if (c.deletedAt) return { ok: true }; // idempotent

    c.deletedAt = new Date();
    await this.commentRepository.save(c);
    return { ok: true };
  }
}
