import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../../infrastructure/database/client.js';
import { guildConfigs } from '../../infrastructure/database/schema.js';
import { ApplicationError } from '../errors/application-error.js';

export class PermissionService {
  constructor(private readonly db: AppDatabase) {}
  assertAdministrator(member: GuildMember): void {
    const config = this.db.select().from(guildConfigs).where(eq(guildConfigs.guildId, member.guild.id)).get();
    const allowed = member.permissions.has(PermissionFlagsBits.ManageGuild) || (config?.administratorRoleId ? member.roles.cache.has(config.administratorRoleId) : false);
    if (!allowed) throw new ApplicationError('MISSING_PERMISSION', '서버 관리 권한 또는 설정된 관리자 역할이 필요합니다.');
  }
}
