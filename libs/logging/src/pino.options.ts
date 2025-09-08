import pino, { TransportTargetOptions } from 'pino';
import { getContext } from './async-context';

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

const redactKeys = [
  'password',
  'authorization',
  'cookie',
  'access_token',
  'refresh_token',
  'token',
  'headers.authorization',
  'headers.cookie',
  "headers['set-cookie']",
  "['set-cookie']",
];

export function buildPinoOptions(service: string) {
  const base: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (isDev() ? 'debug' : 'info'),
    redact: { paths: redactKeys, censor: '[REDACTED]' },
    base: {
      service,
      env: process.env.NODE_ENV ?? 'development',
      version: process.env.APP_VERSION ?? 'v1',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      // NOTE: transport를 쓰지 않을 때만 허용됨
      level(label: string) {
        return { level: label };
      },
      log(obj: Record<string, unknown>) {
        return { ...getContext(), ...obj };
      },
    },
  };

  const targets: TransportTargetOptions[] = [];

  // (A) 개발에서만 pretty (PINO_PRETTY=1)
  const wantPretty = isDev() && process.env.PINO_PRETTY === '1';
  if (wantPretty) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require.resolve('pino-pretty');
      targets.push({
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: false,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
        level: process.env.LOG_LEVEL ?? 'debug',
      });
    } catch {
      // pino-pretty 미설치 시 조용히 무시
    }
  }

  // (B) 파일 복제 (LOG_DIR 설정 시)
  const logDir = process.env.LOG_DIR;
  if (logDir) {
    targets.push({
      target: 'pino/file',
      options: {
        destination: `${logDir}/${service}.ndjson`,
        mkdir: true,
        append: true,
      },
      level: process.env.LOG_LEVEL ?? 'info',
    });
  }

  // transport 사용 시 level 포매터 제거 (pino 제약)
  if (targets.length > 0) {
    const { formatters, ...rest } = base;
    const { level: _omitLevel, ...fmtWithoutLevel } = formatters ?? {};
    return {
      ...rest,
      // level formatter 제거된 formatters 유지 (log formatter는 그대로)
      formatters: fmtWithoutLevel,
      transport: { targets },
    } as pino.LoggerOptions & {
      transport: { targets: TransportTargetOptions[] };
    };
  }

  return base;
}

export function createLogger(service: string) {
  return pino(buildPinoOptions(service));
}
