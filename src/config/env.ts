import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN이 비어 있습니다.'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID가 비어 있습니다.'),
  DISCORD_DEV_GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().min(1).default('./data/bot.db'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info')
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`환경 설정이 올바르지 않습니다:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
