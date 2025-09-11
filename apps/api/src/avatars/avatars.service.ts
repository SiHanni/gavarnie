import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { User } from '@catarie/entities';
import { AvatarsS3Service } from '../storage/avatars.s3.service';

// --- helpers ---
function guessImageContentType(name?: string, fallback?: string) {
  const ext = (name ? extname(name) : '').toLowerCase();
  if (fallback?.startsWith('image/')) return fallback;
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (d) =>
      chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  // 아바타 전용 설정
  private readonly maxBytes = 2 * 1024 * 1024; // 2MB
  private readonly sizes: number[];
  private readonly cooldownMs = 10_000; // 10초

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly s3: AvatarsS3Service, // presign + S3 I/O 모두 여기서 처리
  ) {
    // 리사이즈 크기
    this.sizes = (this.config.get<string>('AVATAR_SIZES', '256,64') ?? '256,64')
      .split(',')
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => Number.isFinite(n) && n > 0);
  }

  /** presign: 원본 업로드용 URL 발급 (쿨다운 + 용량 가드) */
  async presign(
    userId: string,
    contentType?: string,
    fileSize?: number,
    originalFilename?: string,
  ) {
    // 1) 쿨다운
    const me = await this.users.findOne({
      where: { id: userId },
      select: ['id', 'avatarCooldownUntil'],
    });
    const now = Date.now();
    const until = me?.avatarCooldownUntil?.getTime() ?? 0;
    if (until && now < until) {
      const remainSec = Math.ceil((until - now) / 1000);
      throw new BadRequestException(
        `프로필 이미지는 ${remainSec}초 후에 다시 변경할 수 있습니다.`,
      );
    }

    // 2) 입력 가드
    const ct = guessImageContentType(originalFilename, contentType);
    if (!ct.startsWith('image/')) {
      throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
    }
    if (fileSize != null && fileSize > this.maxBytes) {
      throw new BadRequestException(
        '이미지는 2MB 이하만 업로드할 수 있습니다.',
      );
    }

    // 3) 키 생성
    const ext = extname(originalFilename || '').toLowerCase() || '.jpg';
    const id = uuidv4();
    const key = `raw/${userId}/${id}${ext}`;

    // 4) presign
    const presigned = await this.s3.presignedPut(key, ct);

    // 5) 쿨다운 시작
    const cooldownUntil = new Date(now + this.cooldownMs);
    await this.users.update(
      { id: userId },
      { avatarCooldownUntil: cooldownUntil },
    );

    this.logger.log(
      `[avatars.presign] user=${userId} key=${key} ct=${ct} size=${fileSize} cooldownUntil=${cooldownUntil.toISOString()}`,
    );

    return presigned; // { url, method, headers, key, bucket, publicUrl, expiresIn, driver }
  }

  /** complete: 원본 확인 → 리사이즈 → 이전 public 삭제 → 새 public 저장 → 원본 삭제 → URL 반환 */
  async complete(userId: string, key: string) {
    // 1) 원본 확인/크기
    const head = await this.s3.headObject(key);
    const size = head.ContentLength ?? 0;
    if (!size) throw new BadRequestException('업로드된 파일이 없습니다.');
    if (size > this.maxBytes)
      throw new BadRequestException('이미지 크기 제한(2MB)을 초과했습니다.');

    // 2) 원본 다운로드
    const obj = await this.s3.getObject(key);
    const rawBuf = await streamToBuffer(obj.Body as NodeJS.ReadableStream);

    // 3) 이전 public/* 삭제
    await this.deleteAllPublicVariants(userId);

    // 4) 새 변형 생성 & 업로드
    const outs: string[] = [];
    for (const s of this.sizes) {
      const buf = await sharp(rawBuf)
        .rotate()
        .resize(s, s, { fit: 'cover', position: 'centre' })
        .webp({ quality: 90 })
        .toBuffer();

      const outKey = `public/${userId}/avatar_${s}.webp`;
      await this.s3.putObject({
        key: outKey,
        body: buf,
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      });
      outs.push(outKey);
    }

    // 5) 원본 삭제
    await this.safeDeleteObject(key);

    // 6) 대표 URL + 캐시버스터 (전용 서비스의 publicUrlFor 사용)
    const maxSize = Math.max(...this.sizes);
    const bestKey = `public/${userId}/avatar_${maxSize}.webp`;
    const version = Date.now();
    const bestUrl = `${this.s3.publicUrlFor(bestKey)}?v=${version}`;

    // 7) DB 업데이트
    await this.users.update(
      { id: userId },
      { avatarUrl: bestUrl, avatarUpdatedAt: new Date() },
    );

    return {
      ok: true,
      avatarUrl: bestUrl,
      variants: outs.map((k) => `${this.s3.publicUrlFor(k)}?v=${version}`),
    };
  }

  /** public/{userId}/ 아래 기존 파일 전부 삭제 */
  private async deleteAllPublicVariants(userId: string) {
    const prefix = `public/${userId}/`;
    const keys = await this.s3.listKeys(prefix);
    if (keys.length === 0) return;
    await this.s3.deleteObjects(keys);
  }

  private async safeDeleteObject(key: string) {
    try {
      await this.s3.deleteObject(key);
    } catch (e) {
      this.logger.warn(
        `[avatars] failed to delete raw: ${key} (${(e as Error).message})`,
      );
    }
  }
}
