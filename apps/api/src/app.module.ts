import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import {
  Comment,
  CommentReaction,
  Media,
  MediaCore,
  MediaReaction,
  User,
  UserFollows,
} from '@gavarnie/entities';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MediaReactionModule } from './media-reaction/media-reaction.module';
import { CommentsModule } from './comments/comments.module';
import { CommentReactionsModule } from './comments-reactions/comment-reactions.module';
import { UserFollowsModule } from './user-follows/follow.module';
import { AvatarsModule } from './avatars/avatars.module';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { ApiRequestContextInterceptor } from './logging/request-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        username: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB,
        entities: [
          Media,
          MediaCore,
          MediaReaction,
          Comment,
          CommentReaction,
          User,
          UserFollows,
        ],
        autoLoadEntities: false,
        synchronize: false,
        logging: true,
      }),
    }),
    HealthModule,
    MediaModule,
    UsersModule,
    AuthModule,
    MediaReactionModule,
    CommentsModule,
    CommentReactionsModule,
    UserFollowsModule,
    AvatarsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiRequestContextInterceptor,
    },
  ],
})
export class AppModule {}
