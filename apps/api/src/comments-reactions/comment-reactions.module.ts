import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment, CommentReaction } from '@catarie/entities';
import { CommentReactionsController } from './comment-reactions.controller';
import { CommentReactionsService } from './comment-reactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, CommentReaction])],
  controllers: [CommentReactionsController],
  providers: [CommentReactionsService],
  exports: [CommentReactionsService],
})
export class CommentReactionsModule {}
