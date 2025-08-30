import { getDataSource } from '../data-source.js';

(async () => {
  const ds = await getDataSource();
  await ds.initialize();
  try {
    const pending = await ds.showMigrations();
    console.log('[MIGRATE SHOW] has pending?', pending);
  } finally {
    await ds.destroy();
  }
})();
