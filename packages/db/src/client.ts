import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type PokerDatabase = ReturnType<typeof createDatabase>['db'];

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}
