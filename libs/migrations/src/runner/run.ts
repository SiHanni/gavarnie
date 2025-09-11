import { getDataSource } from '../data-source.js'; // ← .js 제거(또는 .ts 명시 OK)

(async () => {
  const ds = await getDataSource();
  await ds.initialize();
  try {
    console.log(
      '[MIGRATE RUN] loaded migrations:',
      ds.migrations.map(m => m.name)
    );
    const res = await ds.runMigrations();
    console.log(
      '[MIGRATE RUN] executed:',
      res.map(m => m.name)
    );
  } finally {
    await ds.destroy();
  }
})();
