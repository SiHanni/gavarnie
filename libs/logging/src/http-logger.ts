import type { Handler, Request, Response } from 'express';
import { createLogger } from './pino.options';
import { runWithContext, setContext } from './async-context';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http'; // esModuleInterop=true 가정

export function httpLoggerMiddleware(service: string): Handler {
  const logger = createLogger(service);

  const http = pinoHttp<Request, Response>({
    logger,

    // ✅ 요청/응답을 우리가 정한 최소 형태로 직렬화
    serializers: {
      req(req) {
        return {
          id: (req as any).id,
          method: req.method,
          url: (req as any).originalUrl ?? req.url,
          ip: (req as any).ip ?? (req.socket?.remoteAddress || undefined),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
      err(err) {
        return {
          type: err.name,
          message: err.message,
          stack: err.stack,
        };
      },
    },

    // 성공/에러 메시지는 짧게
    customSuccessMessage(_req, _res) {
      return 'request completed';
    },
    customErrorMessage(_req, res, _err) {
      return `request errored (${res.statusCode})`;
    },

    // 과다 로그 방지: 헬스체크 제외
    autoLogging: {
      ignore: req =>
        (req as any).path === '/health' ||
        req.url === '/health' ||
        (req as any).path === '/livez' ||
        req.url === '/livez',
    },

    // 요청 ID 생성 + 응답 헤더로 반사
    genReqId(req, res) {
      const id = req.headers['x-request-id']?.toString() ?? randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },

    // 요청 컨텍스트(ALS) 주입
    customProps(req, _res) {
      const traceId =
        (
          req.headers['x-trace-id'] || req.headers['x-correlation-id']
        )?.toString() ?? undefined;

      const userId =
        (req as any).user?.id ??
        (req.headers['x-user-id']
          ? String(req.headers['x-user-id'])
          : undefined);

      // pino-http가 req.id를 넣어줍니다.
      setContext({
        requestId: (req as any).id,
        traceId,
        userId,
      });

      return {};
    },
  });

  // ALS로 요청 단위 트레이싱
  return (req, res, next) => {
    const ctx = {
      requestId: req.headers['x-request-id']?.toString(),
      traceId: (
        req.headers['x-trace-id'] || req.headers['x-correlation-id']
      )?.toString(),
      userId:
        (req as any).user?.id ??
        (req.headers['x-user-id']
          ? String(req.headers['x-user-id'])
          : undefined),
    };
    runWithContext(ctx, () => http(req, res, next));
  };
}
