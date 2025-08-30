import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';
import { DataSource } from 'typeorm';

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// repo root: libs/migrations/src → ../../..
const repoRoot = join(__dirname, '../../..');

// ENV_FILE 지정 없으면 루트 .env.db.development 사용
const envFilePath =
  process.env.ENV_FILE ?? join(repoRoot, '.env.db.development');
dotenvConfig({ path: envFilePath });

// 마이그레이션 스크립트 폴더
const scriptsDir = join(repoRoot, 'libs/migrations/scripts');

// 동적 import로 마이그레이션 클래스를 수집
async function loadMigrationClasses(): Promise<any[]> {
  const files = readdirSync(scriptsDir)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .sort(); // 파일명(타임스탬프) 기준 정렬

  const migrations: any[] = [];
  for (const f of files) {
    const abs = join(scriptsDir, f);
    const mod = await import(pathToFileURL(abs).href);
    const Mig = mod.default ?? Object.values(mod)[0];
    if (typeof Mig === 'function') migrations.push(Mig);
  }
  return migrations;
}

export async function getDataSource(): Promise<DataSource> {
  const migrations = await loadMigrationClasses();

  return new DataSource({
    type: 'mysql',
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? '3306'),
    username: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? 'root',
    database: process.env.MYSQL_DB ?? 'gavarnie_core',
    charset: 'utf8mb4',
    synchronize: false,
    logging: true,
    migrationsTableName: 'migrations',
    entities: [],
    migrations,
  });
}
