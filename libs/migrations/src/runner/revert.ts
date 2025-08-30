import { getDataSource } from '../data-source.js';

type MigRow = { name: string };

(async () => {
  const ds = await getDataSource();
  await ds.initialize();
  try {
    const rows = (await ds.query(
      'SELECT name FROM migrations ORDER BY id DESC LIMIT 1'
    )) as MigRow[];

    const lastName = rows?.[0]?.name ?? '(no migration to revert)';

    await ds.undoLastMigration();

    console.log('[MIGRATE REVERT] reverted:', lastName);
  } finally {
    await ds.destroy();
  }
})();
