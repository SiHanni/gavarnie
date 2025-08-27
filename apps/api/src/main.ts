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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: false,
  });

  const enableSwagger =
    process.env.SWAGGER !== 'false' && process.env.NODE_ENV !== 'production';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Gavarnie API')
      .setDescription('Upload → Transcode(HLS) → Stream pipeline')
      .setVersion('0.1.0')
      .addServer('http://localhost:3000', 'Local')
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
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
  console.log(`[API] listening on http://localhost:${port}`);
}
bootstrap();
