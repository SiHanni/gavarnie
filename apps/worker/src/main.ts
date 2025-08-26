// ===== [ENV BOOTSTRAP] 최상단 고정 =====
import * as path from 'path';
import * as fs from 'fs';
import { config as dotenv } from 'dotenv';

const candidates = [
  path.resolve(__dirname, '../.env.development'), // apps/worker/.env.development (ts-node 실행/빌드 실행 모두 커버)
  path.resolve(process.cwd(), 'apps/worker/.env.development'),
  path.resolve(process.cwd(), '.env'),
];
const envPath = candidates.find((p) => fs.existsSync(p));
if (envPath) {
  dotenv({ path: envPath });
  const mask = (v?: string) => (v ? v.slice(0, 4) + '…' : '(empty)');
  console.log('[worker env] loaded:', envPath);
  console.log(
    '[worker env] STORAGE_ENDPOINT =',
    process.env.STORAGE_ENDPOINT || '(unset)',
  );
  console.log(
    '[worker env] STORAGE_ACCESS_KEY =',
    mask(process.env.STORAGE_ACCESS_KEY),
  );
  console.log(
    '[worker env] STORAGE_SECRET_KEY =',
    mask(process.env.STORAGE_SECRET_KEY),
  );
  console.log('[worker env] REDIS_URL =', process.env.REDIS_URL || '(unset)');
  console.log('[worker env] MYSQL_HOST =', process.env.MYSQL_HOST || '(unset)');
} else {
  console.warn('[worker env] NO .env found. Tried:', candidates);
}

// ===== [BullMQ 워커 기동] =====
// 기존 BullMQ 워커 초기화 파일을 import 하면 즉시 실행됩니다.
import './worker';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const port = parseInt(process.env.PORT ?? '3001', 10); // 워커 헬스/메트릭 서버 포트
  await app.listen(port);
  console.log(`[WORKER] health server listening on http://localhost:${port}`);
}
bootstrap();
