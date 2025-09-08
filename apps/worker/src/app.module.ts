import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import path from 'path';
import { WorkerRunner } from './worker.runner';
import {
  Comment,
  Media,
  MediaCore,
  MediaReaction,
  User,
} from '@catarie/entities';

const ENV = process.env.NODE_ENV || 'development';
const envFilePath = [
  path.join(__dirname, '..', '..', '..', `.env.common.${ENV}`), // 루트 공통
  path.join(__dirname, '..', `.env.${ENV}`), // apps/api 전용
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306', 10),
        username: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB,
        entities: [User, Media, MediaCore, MediaReaction, Comment],
        autoLoadEntities: false,
        synchronize: false,
      }),
    }),
    HealthModule,
  ],
  providers: [WorkerRunner],
})
export class AppModule {}
