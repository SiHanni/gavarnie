import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './media.entity';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { S3Module } from '../storage/s3.module';
import { S3Service } from '../storage/s3.service';
import { QueueModule } from '../queue/queue.module';
import { PublicMediaController } from './public/public-media.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Media]), S3Module, QueueModule],
  providers: [MediaService, S3Service, PublicMediaController],
  controllers: [MediaController, PublicMediaController],
  exports: [MediaService],
})
export class MediaModule {}
