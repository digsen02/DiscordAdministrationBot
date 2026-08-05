import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { REST, Routes } from 'discord.js';
import { loadConfig } from '../../config/env.js';
import { commands } from './commands.js';

if (existsSync('.env')) loadEnvFile('.env');

const config = loadConfig();

const rest = new REST().setToken(config.DISCORD_TOKEN);
const route = config.DISCORD_DEV_GUILD_ID ? Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_DEV_GUILD_ID) : Routes.applicationCommands(config.DISCORD_CLIENT_ID);
await rest.put(route, { body: commands });
process.stdout.write(`${commands.length}개 명령 그룹을 등록했습니다.\n`);
