import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaCore } from '@gavarnie/entities';
import { MediaReaction } from '@gavarnie/entities';

@Injectable()
export class MediaReactionService {
  constructor(
    @InjectRepository(MediaCore)
    private readonly mediaCoreRepository: Repository<MediaCore>,
    @InjectRepository(MediaReaction)
    private readonly mediaReactionRepository: Repository<MediaReaction>,
  ) {}

  /** UUID → media_core.id 변환 */
  private async toCoreIdOrThrow(mediaUuid: string): Promise<string> {
    const core = await this.mediaCoreRepository.findOne({
      where: { mediaId: mediaUuid },
    });
    if (!core) throw new NotFoundException('media not found');
    return core.id;
  }

  /** 좋아요(멱등성)
   * - 없으면 생성(is_active=1)
   * - 있으면 is_active=1로
   * - UNIQUE(mediaUuid, userId) */
  async like(mediaUuid: string, userId: string) {
    const coreId = await this.toCoreIdOrThrow(mediaUuid);
    const existing = await this.mediaReactionRepository.findOne({
      where: { mediaCoreId: coreId, userId },
    });

    if (!existing) {
      const entity = this.mediaReactionRepository.create({
        mediaCoreId: coreId,
        userId,
        isActive: true,
      });

      try {
        await this.mediaReactionRepository.insert(entity);
        return { liked: true, alreadyExisted: false };
      } catch (e: any) {
        // 동시 삽입 경합(UNIQUE 충돌) → UPDATE로 수습
        // MySQL: errno 1062 / code 'ER_DUP_ENTRY'
        if (e?.errno === 1062 || e?.code === 'ER_DUP_ENTRY') {
          await this.mediaReactionRepository.update(
            { mediaCoreId: coreId, userId },
            { isActive: true },
          );
          return { liked: true, alreadyExisted: false };
        }
        throw e;
      }
    }

    if (!existing.isActive) {
      await this.mediaReactionRepository.update(
        { mediaCoreId: coreId, userId },
        { isActive: true },
      );
      return { liked: true, alreadyExisted: false };
    }

    // 이미 활성 좋아요
    return { liked: true, alreadyExisted: true };
  }

  /** 좋아요 취소(멱등성)
   * - 행이 있으면 is_active=0
   * - 없으면 no-op */
  async unlike(mediaUuid: string, userId: string) {
    const coreId = await this.toCoreIdOrThrow(mediaUuid);
    const existing = await this.mediaReactionRepository.findOne({
      where: { mediaCoreId: coreId, userId },
    });
    if (!existing) {
      // 행이 없어도 결과는 취소 상태
      return { liked: false, alreadyExisted: false };
    }

    if (existing.isActive) {
      await this.mediaReactionRepository.update(
        { mediaCoreId: coreId, userId },
        { isActive: false },
      );
      return { liked: false, alreadyExisted: false };
    }

    // 이미 비활성
    return { liked: false, alreadyExisted: true };
  }

  /** 좋아요 수: is_active=1만 카운트 */
  async count(mediaUuid: string) {
    const coreId = await this.toCoreIdOrThrow(mediaUuid);
    const total = await this.mediaReactionRepository.count({
      where: { mediaCoreId: coreId, isActive: true },
    });
    return { count: total };
  }
}
