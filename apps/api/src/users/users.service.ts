import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  Comment,
  Media,
  MediaCore,
  MediaReaction,
  User,
} from '@gavarnie/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UserMediaQueryDto,
  UserMediaResponseDto,
  UserMediaNodeDto,
} from './dto/user-media.dto';

function encodeCursor(v: { createdAt: string; id: string }) {
  return Buffer.from(JSON.stringify(v), 'utf8').toString('base64');
}
function decodeCursor(cur?: string | null) {
  if (!cur) return null;
  try {
    const s = Buffer.from(cur, 'base64').toString('utf8');
    const o = JSON.parse(s);
    if (!o?.createdAt || !o?.id) return null;
    return o as { createdAt: string; id: string };
  } catch {
    return null;
  }
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(MediaCore)
    private readonly mediaCoreRepository: Repository<MediaCore>,
    @InjectRepository(MediaReaction)
    private readonly reactionRepository: Repository<MediaReaction>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  async create(email: string, password: string, displayName: string) {
    const exists = await this.userRepository.findOne({ where: { email } });
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.userRepository.create({
      email,
      passwordHash,
      displayName: displayName?.trim(),
    });
    return this.userRepository.save(user);
  }

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async validate(email: string, password: string) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'displayName',
        'statusMessage',
        'userGrade',
        'avatarUrl',
        'createdAt',
      ],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** 내 프로필 수정 */
  async updateMe(userId: string, dto: UpdateProfileDto) {
    const u = await this.userRepository.findOne({
      where: { id: userId as any },
    });
    if (!u) throw new NotFoundException('User not found');

    if (typeof dto.displayName === 'string') {
      const trimmed = dto.displayName.trim();
      if (trimmed.length > 0) u.displayName = trimmed.slice(0, 50);
    }
    if (dto.avatarUrl !== undefined) {
      u.avatarUrl = dto.avatarUrl ? String(dto.avatarUrl).trim() : null;
    }
    if (dto.statusMessage !== undefined) {
      const v = dto.statusMessage?.trim() ?? '';
      u.statusMessage = v.length > 0 ? v.slice(0, 50) : null;
    }

    await this.userRepository.save(u);

    return {
      id: String(u.id),
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl ?? null,
      statusMessage: u.statusMessage ?? null,
    };
  }

  /** 공개 프로필 */
  async getPublicProfile(targetUserId: string) {
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: String(user.id),
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      statusMessage: user.statusMessage,
    };
  }

  /** 특정 사용자읭 공개 미디어 (READY) */
  async getUserMedia(
    ownerId: string,
    dto: UserMediaQueryDto,
  ): Promise<UserMediaResponseDto> {
    const limit = dto.limit ?? 20;
    const cursor = decodeCursor(dto.cursor);

    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .innerJoin('media.core', 'core')
      .innerJoin('core.owner', 'owner')
      .where('media.status = :ready', { ready: 'READY' })
      .andWhere('media.hlsKey IS NOT NULL')
      .andWhere('core.owner_id = :oid', { oid: ownerId })
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

        'media.thumbnail_key      AS m_thumbnail_key',
        'media.thumbnail_width    AS m_thumbnail_width',
        'media.thumbnail_height   AS m_thumbnail_height',
        'media.thumbnail_version  AS m_thumbnail_version',

        'core.id                  AS mc_id',
        'core.title               AS mc_title',

        'owner.id                 AS owner_id',
        'owner.display_name       AS owner_display_name',
        'owner.avatar_url         AS owner_avatar_url',
      ]);

    if (cursor) {
      const cd = new Date(cursor.createdAt);
      qb.andWhere(
        '(media.created_at < :cd) OR (media.created_at = :cd AND media.id < :cid)',
        { cd, cid: cursor.id },
      );
    }

    const raw = await qb.getRawMany<{
      m_id: string;
      m_hls_key: string | null;
      m_original_filename: string;
      m_content_type: string;
      m_size: string | number | null;
      m_created_at: Date;

      m_thumbnail_key: string | null;
      m_thumbnail_width: number | null;
      m_thumbnail_height: number | null;
      m_thumbnail_version: number | null;

      mc_id: string;
      mc_title: string;
      owner_id: string;
      owner_display_name: string;
      owner_avatar_url: string | null;
    }>();

    const hasNextPage = raw.length > limit;
    const pageRows = hasNextPage ? raw.slice(0, limit) : raw;
    if (pageRows.length === 0) {
      return { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    const mcIds = pageRows.map((r) => String(r.mc_id));

    const likeRows = await this.reactionRepository
      .createQueryBuilder('r')
      .select('r.media_core_id', 'mcid')
      .addSelect('SUM(CASE WHEN r.is_active = 1 THEN 1 ELSE 0 END)', 'cnt')
      .where('r.media_core_id IN (:...ids)', { ids: mcIds })
      .groupBy('r.media_core_id')
      .getRawMany<{ mcid: string; cnt: string }>();
    const likeMap = new Map(
      likeRows.map((r) => [String(r.mcid), Number(r.cnt)]),
    );

    const cmtRows = await this.commentRepository
      .createQueryBuilder('c')
      .select('c.media_id', 'mcid')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.media_id IN (:...ids)', { ids: mcIds })
      .andWhere('c.deleted_at IS NULL')
      .groupBy('c.media_id')
      .getRawMany<{ mcid: string; cnt: string }>();
    const cmtMap = new Map(cmtRows.map((r) => [String(r.mcid), Number(r.cnt)]));

    const nodes: UserMediaNodeDto[] = pageRows.map((r) => ({
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
      },
      likeCount: likeMap.get(String(r.mc_id)) ?? 0,
      commentCount: cmtMap.get(String(r.mc_id)) ?? 0,
      thumbnailKey: r.m_thumbnail_key ?? null,
      thumbnailWidth: r.m_thumbnail_width ?? null,
      thumbnailHeight: r.m_thumbnail_height ?? null,
      thumbnailVersion: r.m_thumbnail_version ?? 1,
    }));

    const last = pageRows.at(-1)!;
    const endCursor = encodeCursor({
      createdAt: new Date(last.m_created_at).toISOString(),
      id: last.m_id,
    });

    return { nodes, pageInfo: { hasNextPage, endCursor } };
  }
}
