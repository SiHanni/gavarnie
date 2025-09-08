import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Comment,
  Media,
  MediaCore,
  MediaReaction,
  User,
  UserFollows,
} from '@catarie/entities';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Media,
      MediaCore,
      User,
      MediaReaction,
      Comment,
      UserFollows,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
