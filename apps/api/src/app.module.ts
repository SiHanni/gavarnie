import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { Media, MediaCore } from '@gavarnie/entities';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

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
        entities: [Media, MediaCore],
        autoLoadEntities: true,
        synchronize: false,
        logging: true,
      }),
    }),
    TypeOrmModule.forFeature([Media, MediaCore]),
    MongooseModule.forRoot(process.env.MONGO_URI || ''),
    HealthModule,
    MediaModule,
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}
