import type { Guild } from 'discord.js';
import { and, asc, eq } from 'drizzle-orm';
import { calculateClassification } from '../../domain/classification/calculator.js';
import { resolveRoleBinding, type MemberSnapshot } from '../../domain/role-binding/resolver.js';
import type { AppDatabase } from '../../infrastructure/database/client.js';
import { classificationOptions, classifications, customFieldDefinitions, customFieldValues, guildConfigs, organizations, roleBindings, terms } from '../../infrastructure/database/schema.js';
import { ApplicationError } from '../errors/application-error.js';

export class ContextBuilder {
  constructor(private readonly db: AppDatabase) {}
  async build(organizationId: number, guild: Guild) {
    const organization = this.db.select().from(organizations).where(eq(organizations.id, organizationId)).get();
    if (!organization) throw new ApplicationError('NOT_FOUND', '조직을 찾을 수 없습니다.');
    const guildConfig = this.db.select().from(guildConfigs).where(eq(guildConfigs.guildId, organization.guildId)).get();
    await guild.members.fetch();
    const members: MemberSnapshot[] = guild.members.cache.map((member) => ({ id: member.id, displayName: member.displayName, roleIds: new Set(member.roles.cache.keys()) }));
    const bindings = this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, organizationId)).orderBy(asc(roleBindings.displayOrder)).all();
    const resolvedRoles = Object.fromEntries(bindings.map((binding) => [binding.key, resolveRoleBinding(binding, guild.roles.cache.has(binding.discordRoleId), members)]));
    const activeTerm = this.db.select().from(terms).where(and(eq(terms.organizationId, organizationId), eq(terms.status, 'active'))).get() ?? null;
    const definitions = this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.organizationId, organizationId)).all();
    const values = this.db.select().from(customFieldValues).where(eq(customFieldValues.organizationId, organizationId)).all();
    const fields: Record<string, unknown> = {};
    for (const definition of definitions) {
      const value = values.find((candidate) => candidate.definitionId === definition.id && (definition.scope === 'organization' ? candidate.termId === null : candidate.termId === activeTerm?.id));
      fields[definition.key] = value?.value ?? definition.defaultValue ?? null;
    }
    const classificationRows = this.db.select().from(classifications).where(eq(classifications.organizationId, organizationId)).orderBy(asc(classifications.displayOrder)).all();
    const resolvedClassifications: Record<string, ReturnType<typeof calculateClassification>> = {};
    for (const classification of classificationRows) {
      const base = bindings.find((binding) => binding.key === classification.baseRoleKey);
      if (!base) continue;
      const options = this.db.select().from(classificationOptions).where(eq(classificationOptions.classificationId, classification.id)).orderBy(asc(classificationOptions.displayOrder)).all();
      const rawCapacity = classification.capacityFieldKey ? fields[classification.capacityFieldKey] : null;
      const capacity = rawCapacity === null || rawCapacity === undefined || rawCapacity === '' ? null : Number(rawCapacity);
      resolvedClassifications[classification.key] = calculateClassification({ ...classification, baseRoleId: base.discordRoleId, capacity: Number.isFinite(capacity) ? capacity : null, options }, members);
    }
    const history = this.db.select().from(terms).where(eq(terms.organizationId, organizationId)).orderBy(asc(terms.startAt)).all();
    const warnings = [...Object.values(resolvedRoles).flatMap((role) => role.warnings), ...Object.values(resolvedClassifications).flatMap((classification) => classification.warnings)];
    return {
      context: { organization: { key: organization.key, name: organization.name, foreignName: organization.foreignName, pronunciation: organization.pronunciation, description: organization.description },
        term: activeTerm ? { number: activeTerm.termNumber, name: activeTerm.displayName, status: activeTerm.status, startDate: activeTerm.startAt, scheduledEndDate: activeTerm.scheduledEndAt, actualEndDate: activeTerm.actualEndAt, endReason: activeTerm.endReason } : null,
        fields, roles: resolvedRoles, classifications: resolvedClassifications,
        history: { terms: history.map((term) => ({ number: term.termNumber, name: term.displayName, status: term.status, startDate: term.startAt, endDate: term.actualEndAt })) }, warnings },
      mentions: { userIds: new Set(members.filter((member) => bindings.some((binding) => member.roleIds.has(binding.discordRoleId))).map((member) => member.id)), roleIds: new Set([...bindings.map((binding) => binding.discordRoleId), ...Object.values(resolvedClassifications).flatMap((value) => value.groups.map((group) => group.roleId))]) },
      timeZone: guildConfig?.timeZone ?? 'Asia/Seoul'
    };
  }
}
