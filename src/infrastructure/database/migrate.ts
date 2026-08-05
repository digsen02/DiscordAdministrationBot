import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDatabase } from './client.js';

const path = resolve(process.env.DATABASE_URL ?? './data/bot.db');
mkdirSync(dirname(path), { recursive: true });
const { db, sqlite } = createDatabase(path);
migrate(db, { migrationsFolder: resolve('./drizzle') });
sqlite.close();
