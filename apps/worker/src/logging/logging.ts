import pino from 'pino';
import { createLogger, runWithContext } from '@libs/logging';

export const logger: pino.Logger = createLogger('worker');

/** 잡 컨텍스트(ALS)에 job.id를 requestId/traceId로 심고 실행 */
export function withJobContext<T>(jobId: string, fn: () => T) {
  const id = String(jobId);
  return runWithContext({ requestId: id, traceId: id }, fn);
}

/** 잡별 child 로거 (jobId 필드 자동 포함) */
export function jobLogger(jobId: string) {
  return logger.child({ jobId: String(jobId) });
}
