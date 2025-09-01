import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment, CommentReaction } from '@gavarnie/entities';

@Injectable()
export class CommentReactionsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(CommentReaction)
    private readonly reactRepo: Repository<CommentReaction>,
  ) {}

  private async ensureComment(commentId: string) {
    const c = await this.commentRepo.findOne({ where: { id: commentId } });
    if (!c) throw new BadRequestException('comment not found');
  }

  /** 좋아요(멱등) */
  async like(commentId: string, userId: string) {
    await this.ensureComment(commentId);

    // upsert: (commentId, userId) 유니크 키에 대해 isActive=true 로 설정
    await this.reactRepo.upsert({ commentId, userId, isActive: true }, [
      'commentId',
      'userId',
    ]);

    const likeCount = await this.reactRepo.count({
      where: { commentId, isActive: true },
    });
    return { liked: true, likeCount };
  }

  /** 좋아요 취소(멱등) */
  async unlike(commentId: string, userId: string) {
    await this.ensureComment(commentId);

    await this.reactRepo.update({ commentId, userId }, { isActive: false });

    const likeCount = await this.reactRepo.count({
      where: { commentId, isActive: true },
    });
    return { liked: false, likeCount };
  }

  /** 좋아요 개수 반환(비로그인 허용) */
  async count(commentId: string) {
    await this.ensureComment(commentId);

    const likeCount = await this.reactRepo.count({
      where: { commentId, isActive: true },
    });
    return { likeCount };
  }
}
