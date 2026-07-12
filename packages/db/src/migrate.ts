import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from './client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const { db, client } = createDatabase(databaseUrl);

try {
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  console.log('Database migrations completed');
} finally {
  await client.end();
}
