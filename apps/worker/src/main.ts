import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggerService } from '@nestjs/common';
import pino from 'pino';
import { createLogger } from '@libs/logging';

// Pino → Nest Logger 어댑터
const pinoLogger: pino.Logger = createLogger('worker');
const nestLogger: LoggerService = {
  log: (msg: any) => pinoLogger.info(msg),
  error: (msg: any, trace?: string) => pinoLogger.error({ trace }, msg),
  warn: (msg: any) => pinoLogger.warn(msg),
  debug: (msg: any) => pinoLogger.debug(msg),
  verbose: (msg: any) => pinoLogger.debug(msg),
};

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: nestLogger,
  });

  pinoLogger.info(
    { env: process.env.NODE_ENV },
    'Worker context started (Nest DI mode)',
  );

  // 그레이스풀 셧다운: WorkerRunner.onModuleDestroy가 호출되어 자원 정리됨
  const shutdown = async () => {
    try {
      await app.close();
      pinoLogger.info('Worker context closed');
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  pinoLogger.error(
    { err: err?.message || String(err) },
    'Fatal bootstrap error',
  );
  process.exit(1);
});
