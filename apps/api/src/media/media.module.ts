import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Comment,
  Media,
  MediaCore,
  MediaReaction,
  User,
} from '@gavarnie/entities';
import { MediaService } from './media.service';
import { UploadsController } from './uploads/uploads.controller';
import { S3Module } from '../storage/s3.module';
import { S3Service } from '../storage/s3.service';
import { QueueModule } from '../queue/queue.module';
import { PublicMediaController } from './public/public-media.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Media, MediaCore, User, MediaReaction, Comment]),
    S3Module,
    QueueModule,
  ],
  providers: [MediaService, S3Service],
  controllers: [UploadsController, PublicMediaController],
  exports: [MediaService],
})
export class MediaModule {}
