import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@catarie/entities';
import { MediaReaction } from '@catarie/entities';
import { MediaCore } from '@catarie/entities';
import { MediaReactionService } from './media-reaction.service';
import { MediaReactionController } from './media-reaction.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MediaReaction, MediaCore, User])],
  providers: [MediaReactionService],
  controllers: [MediaReactionController],
  exports: [MediaReactionService],
})
export class MediaReactionModule {}
