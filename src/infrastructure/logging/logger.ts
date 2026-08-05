import pino from 'pino';

export function createLogger(level: string) {
  return pino({ level, base: { service: 'discord-organization-manager' } });
}

export type Logger = ReturnType<typeof createLogger>;
