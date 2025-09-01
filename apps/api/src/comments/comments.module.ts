import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Comment,
  CommentReaction,
  Media,
  MediaCore,
  User,
} from '@gavarnie/entities';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comment,
      Media,
      MediaCore,
      User,
      CommentReaction,
    ]),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
