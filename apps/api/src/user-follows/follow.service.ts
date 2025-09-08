import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserFollows } from '@catarie/entities';

export type FollowActionResult = {
  following: boolean;
  alreadyExisted: boolean;
};

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserFollows)
    private readonly userFollowsRepository: Repository<UserFollows>,
  ) {}

  private async ensureTargetExistsOrThrow(targetUserId: string) {
    const u = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!u) throw new NotFoundException('user not found');
  }

  private ensureNotSelf(meId: string, targetId: string) {
    if (String(meId) === String(targetId)) {
      throw new BadRequestException('CANNOT_FOLLOW_SELF');
    }
  }

  /** 팔로우(멱등)
   * - 없으면 생성(is_active=1)
   * - 있으면 is_active=1로
   * - UNIQUE(followerId, followeeId)
   */
  async follow(
    targetUserId: string,
    meId: string,
  ): Promise<FollowActionResult> {
    this.ensureNotSelf(meId, targetUserId);
    await this.ensureTargetExistsOrThrow(targetUserId);

    const existing = await this.userFollowsRepository.findOne({
      where: { followerId: meId, followeeId: targetUserId },
    });

    if (!existing) {
      const entity = this.userFollowsRepository.create({
        followerId: meId,
        followeeId: targetUserId,
        isActive: true,
      });

      try {
        await this.userFollowsRepository.insert(entity);
        return { following: true, alreadyExisted: false };
      } catch (e: any) {
        // 동시 삽입 경합(UNIQUE 충돌) → UPDATE로 수습
        // MySQL: errno 1062 / code 'ER_DUP_ENTRY'
        if (e?.errno === 1062 || e?.code === 'ER_DUP_ENTRY') {
          await this.userFollowsRepository.update(
            { followerId: meId, followeeId: targetUserId },
            { isActive: true },
          );
          return { following: true, alreadyExisted: false };
        }
        throw e;
      }
    }

    if (!existing.isActive) {
      await this.userFollowsRepository.update(
        { followerId: meId, followeeId: targetUserId },
        { isActive: true },
      );
      return { following: true, alreadyExisted: false };
    }

    // 이미 활성
    return { following: true, alreadyExisted: true };
  }

  /** 언팔로우(멱등)
   * - 행이 있으면 is_active=0
   * - 없으면 no-op
   */
  async unfollow(
    targetUserId: string,
    meId: string,
  ): Promise<FollowActionResult> {
    this.ensureNotSelf(meId, targetUserId);
    await this.ensureTargetExistsOrThrow(targetUserId);

    const existing = await this.userFollowsRepository.findOne({
      where: { followerId: meId, followeeId: targetUserId },
    });
    if (!existing) {
      return { following: false, alreadyExisted: false };
    }

    if (existing.isActive) {
      await this.userFollowsRepository.update(
        { followerId: meId, followeeId: targetUserId },
        { isActive: false },
      );
      return { following: false, alreadyExisted: false };
    }

    // 이미 비활성
    return { following: false, alreadyExisted: true };
  }

  /** 팔로우 상태 조회 */
  async isFollowing(targetUserId: string, meId: string) {
    const found = await this.userFollowsRepository.findOne({
      where: { followerId: meId, followeeId: targetUserId, isActive: true },
      select: ['id'],
    });
    return { following: !!found };
  }

  /** 카운트(프로필 표시에 사용): follower = 나를 팔로우하는 수 / following = 내가 팔로우 중인 수 */
  async counts(userId: string) {
    const followerCount = await this.userFollowsRepository.count({
      where: { followeeId: userId, isActive: true },
    });
    const followingCount = await this.userFollowsRepository.count({
      where: { followerId: userId, isActive: true },
    });
    return { followerCount, followingCount };
  }
}
