import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { TRANSCODE_QUEUE } from './queue/queue.module';
import type { Queue } from 'bullmq';
// BullMQ UI
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { join } from 'path';
import { readFileSync } from 'fs';

import { httpLoggerMiddleware } from '@libs/logging';
import pino from 'pino';
import { createLogger } from '@libs/logging';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(httpLoggerMiddleware('api'));

  const logger: pino.Logger = createLogger('api');
  app.useLogger({
    log: (msg) => logger.info(msg),
    error: (msg, trace) => logger.error({ trace }, msg),
    warn: (msg) => logger.warn(msg),
    debug: (msg) => logger.debug(msg),
    verbose: (msg) => logger.debug(msg),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3100', // local dev web port
      'http://127.0.0.1:3100',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-file-size',
    ],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: false,
  });

  const enableSwagger =
    process.env.SWAGGER !== 'false' && process.env.NODE_ENV !== 'production';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Catarie API')
      .setDescription('')
      .setVersion('0.1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addServer('http://localhost:3000', 'Local')
      .build();
    const document = SwaggerModule.createDocument(app, config);

    const appIconPath = join(
      __dirname,
      '..',
      '..',
      '..',
      'images',
      'appIcon.png',
    );
    const appIconBase64 = readFileSync(appIconPath).toString('base64');

    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'Catarie Docs',
      customCss: `
        .swagger-ui .topbar .link img { display: none !important; }
        .swagger-ui .topbar .link {
          display: inline-flex !important;
          align-items: center !important;
        }
        .swagger-ui .topbar .link::before {
          content: '' !important;
          display: inline-block !important;
          width: 55px !important;
          height: 55px !important;
          margin-right: 8px !important;
          background: url('data:image/png;base64,${appIconBase64}') no-repeat center center !important;
          background-size: contain !important;
        }
      `,
    });
  }

  // -- Bull Board --
  const transcodeQueue = app.get<Queue>(TRANSCODE_QUEUE);
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/queues');

  createBullBoard({
    queues: [new BullMQAdapter(transcodeQueue)],
    serverAdapter,
  });

  const express = app.getHttpAdapter().getInstance();
  express.use('/queues', serverAdapter.getRouter());

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);

  logger.info({ port }, 'API listening');
}
bootstrap();
