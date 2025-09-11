import { getDataSource } from '../data-source.js';

(async () => {
  const ds = await getDataSource();
  await ds.initialize();
  try {
    const pending = await ds.showMigrations();
    console.log('[MIGRATE SHOW] has pending?', pending);
    console.log(
      '[MIGRATE SHOW] loaded migrations:',
      ds.migrations.map(m => m.name)
    );
  } finally {
    await ds.destroy();
  }
})();
