import { Injectable, NestMiddleware } from '@nestjs/common';
import { httpLoggerMiddleware } from '@libs/logging';

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly handler = httpLoggerMiddleware('api');
  use(req: any, res: any, next: (error?: any) => void) {
    this.handler(req, res, next);
  }
}
