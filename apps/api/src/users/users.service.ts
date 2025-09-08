import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  Comment,
  Media,
  MediaCore,
  MediaReaction,
  User,
} from '@catarie/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  UserMediaQueryDto,
  UserMediaResponseDto,
  UserMediaNodeDto,
} from './dto/user-media.dto';
import { MEDIA_CORE_STATUS } from '../media/media.constants';
import { randomBytes } from 'node:crypto';

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

const RESERVED = new Set([
  'home',
  'about',
  'login',
  'logout',
  'signup',
  'signin',
  'me',
  'api',
  'admin',
  'catarie',
  'cdn',
  'static',
  'assets',
  'terms',
  'privacy',
  'help',
]);

function normalizeHandle(input: string): string {
  let v = (input || '').toLowerCase().trim();
  v = v.replace(/[^a-z0-9._]/g, '');
  v = v.replace(/[._]{2,}/g, (m) => m[0]);
  v = v.replace(/^[._]+/, '').replace(/[._]+$/, '');
  if (v.length < 3) v = v.padEnd(3, 'x');
  if (v.length > 30) v = v.slice(0, 30);
  if (/^[0-9]+$/.test(v)) v = `u${v}`; // 숫자-only 방지
  return v;
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

    // handle 값 생성
    const basePart = email.split('@')[0].slice(0, 10);
    const rand = randomBytes(3).toString('base64url'); // 예: "a9Xf"
    const base = `${basePart}_${rand}`;
    // allocateUniqueHandle로 중복 보정
    const candidate = await this.allocateUniqueHandle(base);

    const user = this.userRepository.create({
      email,
      passwordHash,
      displayName: displayName?.trim(),
      handle: candidate,
    });

    return this.userRepository.save(user);
  }

  /** 유니크 핸들 할당(예약어/중복 회피) */
  private async allocateUniqueHandle(seed: string): Promise<string> {
    let base = normalizeHandle(seed);
    if (!base || RESERVED.has(base)) base = `user${Date.now()}`;

    let candidate = base;
    let suffix = 0;
    while (
      (await this.userRepository.exist({ where: { handle: candidate } })) ||
      RESERVED.has(candidate)
    ) {
      suffix += 1;
      const suf = String(suffix);
      const maxBase = Math.max(1, 30 - suf.length);
      candidate = `${base.slice(0, maxBase)}${suf}`;
    }
    return candidate;
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
        'handle',
      ],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByHandle(handle: string): Promise<User> {
    const norm = normalizeHandle(handle);
    const user = await this.userRepository.findOne({
      where: { handle: norm },
      select: [
        'id',
        'email',
        'displayName',
        'statusMessage',
        'userGrade',
        'avatarUrl',
        'createdAt',
        'handle',
      ],
    });
    if (!user) throw new NotFoundException('User not found');
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

    // @handle 변경 (선택적)
    if (typeof dto.handle === 'string' && dto.handle.trim().length > 0) {
      const norm = normalizeHandle(dto.handle);
      if (RESERVED.has(norm))
        throw new BadRequestException('handle is reserved');

      const dup = await this.userRepository.findOne({
        where: { handle: norm, id: Not(userId as any) },
        select: ['id'],
      });
      if (dup) throw new ConflictException('handle already in use');

      u.handle = norm;
      // (선택) 핸들 변경 쿨다운/이력 테이블은 추후 확장 가능
    }

    await this.userRepository.save(u);

    return {
      id: String(u.id),
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl ?? null,
      statusMessage: u.statusMessage ?? null,
      handle: u.handle,
    };
  }

  /** 공개 프로필 */
  async getPublicProfileByHandle(handle: string) {
    const user = await this.findByHandle(handle);
    return {
      id: String(user.id),
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      statusMessage: user.statusMessage,
      handle: user.handle,
    };
  }

  /** 특정 사용자읭 공개 미디어 (READY) */
  private async getUserMediaByOwnerId(
    ownerId: string,
    dto: UserMediaQueryDto,
  ): Promise<UserMediaResponseDto> {
    const limit = Math.min(Math.max(dto.limit ?? 20, 1), 50);
    const cursor = decodeCursor(dto.cursor);

    const qb = this.mediaRepository
      .createQueryBuilder('media')
      .innerJoin('media.core', 'core')
      .innerJoin('core.owner', 'owner')
      .where('media.status = :ready', { ready: 'READY' })
      .andWhere('media.hlsKey IS NOT NULL')
      .andWhere('core.owner_id = :oid', { oid: ownerId })
      .andWhere('core.status = :status', {
        status: MEDIA_CORE_STATUS.PUBLISHED,
      })
      .andWhere('media.deleted_at IS NULL')
      .andWhere('core.deleted_at IS NULL')
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
        'owner.handle             AS owner_handle',
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
      owner_handle: string;
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
        handle: r.owner_handle,
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

  /** 특정 사용자의 공개 미디어 (READY) — by handle */
  async getUserMediaByHandle(
    handle: string,
    dto: UserMediaQueryDto,
  ): Promise<UserMediaResponseDto> {
    const user = await this.findByHandle(handle);
    return this.getUserMediaByOwnerId(String(user.id), dto);
  }
}
