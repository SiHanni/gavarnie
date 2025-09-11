import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvatarsController } from './avatars.controller';
import { AvatarsService } from './avatars.service';
import { AvatarChange, User } from '@catarie/entities';
import { AvatarsS3Service } from '../storage/avatars.s3.service';
import { S3Module } from '../storage/s3.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, AvatarChange]), S3Module],
  controllers: [AvatarsController],
  providers: [AvatarsService, AvatarsS3Service],
  exports: [AvatarsService],
})
export class AvatarsModule {}
