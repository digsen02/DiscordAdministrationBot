import { Events, type Client } from 'discord.js';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppDatabase } from '../database/client.js';
import { classificationOptions, classifications, organizations, publications, roleBindings } from '../database/schema.js';
import type { Logger } from '../logging/logger.js';
import type { RefreshQueue } from '../scheduler/refresh-queue.js';
import type { InteractionHandler } from './interaction-handler.js';

export function installDiscordEvents(client: Client, db: AppDatabase, handler: InteractionHandler, queue: RefreshQueue, logger: Logger): void {
  const enqueueAffected = (guildId: string, roleIds: readonly string[]) => {
    if (!roleIds.length) return;
    const organizationIds = new Set<number>();
    db.select({ organizationId: roleBindings.organizationId }).from(roleBindings).innerJoin(organizations, eq(organizations.id, roleBindings.organizationId)).where(and(eq(organizations.guildId, guildId), inArray(roleBindings.discordRoleId, roleIds))).all().forEach((row) => organizationIds.add(row.organizationId));
    db.select({ organizationId: classifications.organizationId }).from(classificationOptions).innerJoin(classifications, eq(classifications.id, classificationOptions.classificationId)).innerJoin(organizations, eq(organizations.id, classifications.organizationId)).where(and(eq(organizations.guildId, guildId), inArray(classificationOptions.discordRoleId, roleIds))).all().forEach((row) => organizationIds.add(row.organizationId));
    for (const organizationId of organizationIds) db.select({ id: publications.id }).from(publications).where(and(eq(publications.organizationId, organizationId), eq(publications.autoRefresh, true))).all().forEach((row) => queue.enqueue(row.id));
  };
  client.on(Events.InteractionCreate, (interaction) => { if (interaction.isChatInputCommand()) void handler.handle(interaction); else if (interaction.isModalSubmit()) void handler.handleModal(interaction); else if (interaction.isButton()) void handler.handleButton(interaction); else if (interaction.isStringSelectMenu()) void handler.handleSelect(interaction); });
  client.on(Events.GuildMemberUpdate, (before, after) => {
    const oldRoles = new Set(before.roles.cache.keys()); const newRoles = new Set(after.roles.cache.keys());
    const changed = [...new Set([...oldRoles, ...newRoles])].filter((id) => oldRoles.has(id) !== newRoles.has(id)); enqueueAffected(after.guild.id, changed);
  });
  client.on(Events.GuildRoleDelete, (role) => { enqueueAffected(role.guild.id, [role.id]); });
  client.on(Events.GuildRoleUpdate, (before, after) => { if (before.name !== after.name) enqueueAffected(after.guild.id, [after.id]); });
  client.once(Events.ClientReady, (readyClient) => {
    logger.info({ user: readyClient.user.tag }, 'Discord bot ready');
    db.select({ id: publications.id }).from(publications).where(eq(publications.autoRefresh, true)).all().forEach((row) => queue.enqueue(row.id));
  });
}
