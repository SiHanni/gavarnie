import { Global, Module } from '@nestjs/common';
import pino from 'pino';
import { createLogger } from '@catarie/logging';

@Global()
@Module({
  providers: [
    {
      provide: 'LOGGER',
      useFactory: (): pino.Logger => createLogger('worker'),
    },
  ],
  exports: ['LOGGER'],
})
export class LoggerModule {}
