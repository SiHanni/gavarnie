import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import * as mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

@Injectable()
export class HealthService {
  async check() {
    let mysqlOk = false;
    try {
      const conn = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT ?? '3306', 10),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB,
      });
      await conn.ping();
      await conn.end();
      mysqlOk = true;
    } catch {}

    let mongoOk = false;
    try {
      // 1) 이미 Mongoose 연결이 열려 있으면 그걸로 ping
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        mongoOk = true;
      } else {
        // 2) 아직이면 공식 드라이버로 1회성 ping
        const uri = process.env.MONGO_URI ?? '';
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1500 });
        await client.connect();
        await client.db().admin().ping();
        await client.close();
        mongoOk = true;
      }
    } catch {
      mongoOk = false;
    }

    let redisOk = false;
    const redis = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      lazyConnect: true,
    });
    try {
      await redis.connect();
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    } catch {
    } finally {
      try {
        await redis.quit();
      } catch {}
    }

    return {
      mysql: mysqlOk ? 'ok' : 'fail',
      mongo: mongoOk ? 'ok' : 'fail',
      redis: redisOk ? 'ok' : 'fail',
      env: process.env.NODE_ENV,
    };
  }
}
