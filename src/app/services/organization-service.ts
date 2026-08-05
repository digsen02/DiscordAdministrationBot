import { and, eq, isNull } from 'drizzle-orm';
import { assertSafeKey } from '../../domain/shared/key.js';
import type { AppDatabase } from '../../infrastructure/database/client.js';
import { auditLogs, guildConfigs, organizations, roleBindings } from '../../infrastructure/database/schema.js';
import { ApplicationError } from '../errors/application-error.js';

export interface CreateOrganizationInput { guildId: string; key: string; name: string; actorUserId: string; foreignName?: string | null; pronunciation?: string | null; description?: string | null }

export class OrganizationService {
  constructor(private readonly db: AppDatabase) {}
  ensureGuild(guildId: string): void { this.db.insert(guildConfigs).values({ guildId }).onConflictDoNothing().run(); }
  create(input: CreateOrganizationInput) {
    assertSafeKey(input.key); this.ensureGuild(input.guildId);
    try {
      return this.db.transaction((tx) => {
        const organization = tx.insert(organizations).values({ guildId: input.guildId, key: input.key, name: input.name, foreignName: input.foreignName ?? null, pronunciation: input.pronunciation ?? null, description: input.description ?? null }).returning().get();
        tx.insert(auditLogs).values({ guildId: input.guildId, organizationId: organization.id, actorUserId: input.actorUserId, action: 'organization.created', metadata: { key: input.key, name: input.name } }).run();
        return organization;
      });
    } catch (error) { if (error instanceof Error && error.message.includes('UNIQUE')) throw new ApplicationError('DUPLICATE_KEY', '같은 내부 키를 가진 조직이 이미 있습니다.'); throw error; }
  }
  find(guildId: string, key: string) { return this.db.select().from(organizations).where(and(eq(organizations.guildId, guildId), eq(organizations.key, key), isNull(organizations.deletedAt))).get(); }
  list(guildId: string) { return this.db.select().from(organizations).where(and(eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).all(); }
  addRoleBinding(input: { organizationId: number; key: string; displayName: string; discordRoleId: string; kind: 'office' | 'membership'; cardinality: 'one' | 'many'; required: boolean; displayOrder: number; guildId: string; actorUserId: string }) {
    assertSafeKey(input.key);
    try { return this.db.transaction((tx) => { const row = tx.insert(roleBindings).values(input).returning().get(); tx.insert(auditLogs).values({ guildId: input.guildId, organizationId: input.organizationId, actorUserId: input.actorUserId, action: 'role_binding.created', metadata: { key: input.key, roleId: input.discordRoleId } }).run(); return row; }); }
    catch (error) { if (error instanceof Error && error.message.includes('UNIQUE')) throw new ApplicationError('DUPLICATE_KEY', '같은 내부 키를 가진 역할 연결이 이미 있습니다.'); throw error; }
  }
}
