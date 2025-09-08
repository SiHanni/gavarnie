import { Injectable } from '@nestjs/common';
import IORedis from 'ioredis';
import * as mysql from 'mysql2/promise';

@Injectable()
export class HealthService {
  async check() {
    // MySQL ping
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

    // Redis ping
    let redisOk = false;
    const redis = new IORedis(
      process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      {
        lazyConnect: true,
      },
    );
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
      redis: redisOk ? 'ok' : 'fail',
      env: process.env.NODE_ENV,
    };
  }
}
