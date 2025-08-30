import { getDataSource } from '../data-source.js';

(async () => {
  const ds = await getDataSource();
  await ds.initialize();
  try {
    console.log(
      '[DEBUG] loaded migrations:',
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
