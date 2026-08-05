import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Client, GatewayIntentBits } from 'discord.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { loadConfig } from './config/env.js';
import { PublicationService } from './app/services/publication-service.js';
import { createDatabase } from './infrastructure/database/client.js';
import { installDiscordEvents } from './infrastructure/discord/events.js';
import { InteractionHandler } from './infrastructure/discord/interaction-handler.js';
import { createLogger } from './infrastructure/logging/logger.js';
import { RefreshQueue } from './infrastructure/scheduler/refresh-queue.js';
import { TermScheduler } from './infrastructure/scheduler/term-scheduler.js';

if (existsSync('.env')) loadEnvFile('.env');
const config = loadConfig(); const logger = createLogger(config.LOG_LEVEL);
const databasePath = resolve(config.DATABASE_URL); mkdirSync(dirname(databasePath), { recursive: true });
const { db, sqlite } = createDatabase(databasePath); migrate(db, { migrationsFolder: resolve('./drizzle') });
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const publications = new PublicationService(db, client);
const queue = new RefreshQueue(async (id) => { const result = await publications.refresh(id); if (result.diagnostics.length) logger.warn({ publicationId: id, diagnostics: result.diagnostics }, 'automatic publication refresh diagnostics'); }, 5_000, (error, publicationId) => logger.error({ err: error, publicationId }, 'automatic publication refresh failed'));
const handler = new InteractionHandler(db, publications, queue, logger);
const scheduler = new TermScheduler(db, queue, (error) => logger.error({ err: error }, 'term scheduler failed')); installDiscordEvents(client, db, handler, queue, logger); scheduler.start();

const shutdown = async () => { scheduler.stop(); queue.cancelAll(); await client.destroy(); sqlite.close(); };
process.once('SIGINT', () => { void shutdown().finally(() => process.exit(0)); });
process.once('SIGTERM', () => { void shutdown().finally(() => process.exit(0)); });
await client.login(config.DISCORD_TOKEN);
