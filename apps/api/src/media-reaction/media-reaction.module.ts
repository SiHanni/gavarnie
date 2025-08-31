import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@gavarnie/entities';
import { MediaReaction } from '@gavarnie/entities';
import { MediaCore } from '@gavarnie/entities';
import { MediaReactionService } from './media-reaction.service';
import { MediaReactionController } from './media-reaction.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MediaReaction, MediaCore, User])],
  providers: [MediaReactionService],
  controllers: [MediaReactionController],
  exports: [MediaReactionService],
})
export class MediaReactionModule {}
