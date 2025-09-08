import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { setContext } from './async-context';
import type { Request } from 'express';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const userId = (req as any)?.user?.id;
    if (userId) setContext({ userId });
    return next.handle().pipe(
      tap({
        error: err => {
          // 여기에 특정 에러 메타를 넣고 싶으면 setContext로 보강 가능
        },
      })
    );
  }
}
