import { Global, Module } from '@nestjs/common';
import pino from 'pino';
import { createLogger } from '@libs/logging';

@Global()
@Module({
  providers: [
    {
      provide: 'LOGGER',
      useFactory: (): pino.Logger => createLogger('api'),
    },
  ],
  exports: ['LOGGER'],
})
export class LoggerModule {}
