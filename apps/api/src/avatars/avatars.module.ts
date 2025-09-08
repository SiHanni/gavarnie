import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvatarsController } from './avatars.controller';
import { AvatarsService } from './avatars.service';
import { AvatarChange, User } from '@catarie/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, AvatarChange])],
  controllers: [AvatarsController],
  providers: [AvatarsService],
  exports: [AvatarsService],
})
export class AvatarsModule {}
