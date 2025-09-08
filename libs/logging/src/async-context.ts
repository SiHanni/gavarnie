import { AsyncLocalStorage } from 'node:async_hooks';

export type LogContext = {
  requestId?: string;
  traceId?: string;
  userId?: string | number;
};

const als = new AsyncLocalStorage<LogContext>();

export function runWithContext<T>(ctx: LogContext, fn: () => T) {
  return als.run(ctx, fn);
}

export function getContext(): LogContext {
  return als.getStore() ?? {};
}

export function setContext(partial: LogContext) {
  const cur = als.getStore() ?? {};
  Object.assign(cur, partial);
}
