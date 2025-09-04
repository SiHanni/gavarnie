import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { User, UserFollows } from '@gavarnie/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFollows])],
  controllers: [FollowController],
  providers: [FollowService],
  exports: [FollowService],
})
export class UserFollowsModule {}
