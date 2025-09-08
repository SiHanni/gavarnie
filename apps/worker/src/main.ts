// ===== [ENV BOOTSTRAP] 최상단 고정 =====
import * as path from 'path';
import * as fs from 'fs';
import { config as dotenv } from 'dotenv';

import pino from 'pino';
import { createLogger } from '@libs/logging';

const candidates = [
  path.resolve(__dirname, '../.env.development'), // apps/worker/.env.development (ts-node 실행/빌드 실행 모두 커버)
  path.resolve(process.cwd(), 'apps/worker/.env.development'),
  path.resolve(process.cwd(), '.env'),
];
const envPath = candidates.find((p) => fs.existsSync(p));
if (envPath) {
  dotenv({ path: envPath });
} else {
  console.warn('[worker env] NO .env found. Tried:', candidates);
}

// ===== [BullMQ 워커 기동] =====
// 기존 BullMQ 워커 초기화 파일을 import 하면 즉시 실행됩니다.
import './worker';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const logger: pino.Logger = createLogger('worker');

  app.useLogger({
    log: (msg) => logger.info(msg),
    error: (msg, trace) => logger.error({ trace }, msg),
    warn: (msg) => logger.warn(msg),
    debug: (msg) => logger.debug(msg),
    verbose: (msg) => logger.debug(msg),
  });

  const port = parseInt(process.env.PORT ?? '3001', 10); // 워커 헬스/메트릭 서버 포트
  await app.listen(port);
  logger.info('Worker service started');
}
bootstrap();
