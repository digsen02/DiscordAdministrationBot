import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date())
};

export const guildConfigs = sqliteTable('guild_configs', {
  guildId: text('guild_id').primaryKey(),
  timeZone: text('time_zone').notNull().default('Asia/Seoul'),
  locale: text('locale').notNull().default('ko-KR'),
  administratorRoleId: text('administrator_role_id'),
  ...timestamps
});

export const organizations = sqliteTable('organizations', {
  id: integer('id').primaryKey({ autoIncrement: true }), guildId: text('guild_id').notNull().references(() => guildConfigs.guildId),
  key: text('key').notNull(), name: text('name').notNull(), foreignName: text('foreign_name'), pronunciation: text('pronunciation'), description: text('description'), deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }), ...timestamps
}, (t) => [uniqueIndex('org_guild_key_uq').on(t.guildId, t.key), index('org_guild_idx').on(t.guildId)]);

export const roleBindings = sqliteTable('role_bindings', {
  id: integer('id').primaryKey({ autoIncrement: true }), organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), displayName: text('display_name').notNull(), discordRoleId: text('discord_role_id').notNull(), kind: text('kind', { enum: ['office', 'membership'] }).notNull(),
  cardinality: text('cardinality', { enum: ['one', 'many'] }).notNull(), required: integer('required', { mode: 'boolean' }).notNull().default(false), displayOrder: integer('display_order').notNull().default(0), ...timestamps
}, (t) => [uniqueIndex('binding_org_key_uq').on(t.organizationId, t.key), index('binding_org_idx').on(t.organizationId), index('binding_role_idx').on(t.discordRoleId)]);

export const classifications = sqliteTable('classifications', {
  id: integer('id').primaryKey({ autoIncrement: true }), organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), displayName: text('display_name').notNull(), baseRoleKey: text('base_role_key').notNull(), exclusive: integer('exclusive', { mode: 'boolean' }).notNull().default(true),
  allowUnassigned: integer('allow_unassigned', { mode: 'boolean' }).notNull().default(true), unassignedLabel: text('unassigned_label').notNull().default('미지정'), capacityFieldKey: text('capacity_field_key'), displayOrder: integer('display_order').notNull().default(0), ...timestamps
}, (t) => [uniqueIndex('classification_org_key_uq').on(t.organizationId, t.key), index('classification_org_idx').on(t.organizationId)]);

export const classificationOptions = sqliteTable('classification_options', {
  id: integer('id').primaryKey({ autoIncrement: true }), classificationId: integer('classification_id').notNull().references(() => classifications.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), displayName: text('display_name').notNull(), discordRoleId: text('discord_role_id').notNull(), displayOrder: integer('display_order').notNull().default(0), customIconUrl: text('custom_icon_url'), ...timestamps
}, (t) => [uniqueIndex('classification_option_key_uq').on(t.classificationId, t.key), index('classification_option_role_idx').on(t.discordRoleId)]);

export const customFieldDefinitions = sqliteTable('custom_field_definitions', {
  id: integer('id').primaryKey({ autoIncrement: true }), organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), label: text('label').notNull(), scope: text('scope', { enum: ['organization', 'term'] }).notNull(),
  type: text('type', { enum: ['text', 'multiline_text', 'number', 'date', 'datetime', 'boolean', 'select', 'role', 'channel'] }).notNull(), required: integer('required', { mode: 'boolean' }).notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0), selectOptions: text('select_options', { mode: 'json' }).$type<string[]>(), defaultValue: text('default_value'), ...timestamps
}, (t) => [uniqueIndex('field_org_key_uq').on(t.organizationId, t.key), index('field_org_idx').on(t.organizationId)]);

export const terms = sqliteTable('terms', {
  id: integer('id').primaryKey({ autoIncrement: true }), organizationId: integer('organization_id').notNull().references(() => organizations.id), termNumber: integer('term_number'), displayName: text('display_name').notNull(),
  startAt: integer('start_at', { mode: 'timestamp_ms' }).notNull(), scheduledEndAt: integer('scheduled_end_at', { mode: 'timestamp_ms' }), actualEndAt: integer('actual_end_at', { mode: 'timestamp_ms' }),
  status: text('status', { enum: ['scheduled', 'active', 'expired', 'ended', 'dissolved', 'suspended'] }).notNull(), endReason: text('end_reason'), ...timestamps
}, (t) => [index('term_org_idx').on(t.organizationId), index('term_active_end_idx').on(t.status, t.scheduledEndAt)]);

export const customFieldValues = sqliteTable('custom_field_values', {
  id: integer('id').primaryKey({ autoIncrement: true }), definitionId: integer('definition_id').notNull().references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }), termId: integer('term_id').references(() => terms.id), value: text('value').notNull(), ...timestamps
}, (t) => [uniqueIndex('field_value_org_target_uq').on(t.definitionId, t.organizationId).where(sql`${t.termId} is null`), uniqueIndex('field_value_term_target_uq').on(t.definitionId, t.termId).where(sql`${t.termId} is not null`), index('field_value_org_idx').on(t.organizationId), index('field_value_term_idx').on(t.termId)]);

export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }), organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), content: text('content').notNull(), isDraft: integer('is_draft', { mode: 'boolean' }).notNull().default(false), ...timestamps
}, (t) => [uniqueIndex('template_org_name_uq').on(t.organizationId, t.name), index('template_org_idx').on(t.organizationId)]);

export const publications = sqliteTable('publications', {
  id: integer('id').primaryKey({ autoIncrement: true }), organizationId: integer('organization_id').notNull().references(() => organizations.id), templateId: integer('template_id').notNull().references(() => templates.id),
  name: text('name').notNull(), channelId: text('channel_id').notNull(), messageId: text('message_id'), autoRefresh: integer('auto_refresh', { mode: 'boolean' }).notNull().default(true),
  broken: integer('broken', { mode: 'boolean' }).notNull().default(false), lastRenderedAt: integer('last_rendered_at', { mode: 'timestamp_ms' }), lastRenderError: text('last_render_error'), ...timestamps
}, (t) => [index('publication_org_idx').on(t.organizationId), index('publication_channel_message_idx').on(t.channelId, t.messageId)]);

export const forumPublicationSettings = sqliteTable('forum_publication_settings', {
  publicationId: integer('publication_id').primaryKey().references(() => publications.id, { onDelete: 'cascade' }),
  titleTemplate: text('title_template').notNull(),
  appliedTagIdsJson: text('applied_tag_ids_json', { mode: 'json' }).$type<string[]>().notNull().default([]),
  autoArchiveDuration: integer('auto_archive_duration').notNull().default(1440),
  slowmodeSeconds: integer('slowmode_seconds').notNull().default(0),
  archiveAfterPublish: integer('archive_after_publish', { mode: 'boolean' }).notNull().default(false),
  lockAfterPublish: integer('lock_after_publish', { mode: 'boolean' }).notNull().default(false),
  preserveManualTags: integer('preserve_manual_tags', { mode: 'boolean' }).notNull().default(false),
  threadId: text('thread_id'),
  ...timestamps
});

export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }), guildId: text('guild_id').notNull(), organizationId: integer('organization_id').references(() => organizations.id), actorUserId: text('actor_user_id').notNull(),
  action: text('action').notNull(), metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull(), createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
}, (t) => [index('audit_guild_idx').on(t.guildId), index('audit_org_idx').on(t.organizationId)]);

export const setupSessions = sqliteTable('setup_sessions', {
  id: text('id').primaryKey(), guildId: text('guild_id').notNull(), userId: text('user_id').notNull(), kind: text('kind').notNull(), state: text('state', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(), createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date())
}, (t) => [index('session_expiry_idx').on(t.expiresAt), index('session_owner_idx').on(t.guildId, t.userId)]);

export type Organization = typeof organizations.$inferSelect;
export type RoleBinding = typeof roleBindings.$inferSelect;
export type Classification = typeof classifications.$inferSelect;
export type ClassificationOption = typeof classificationOptions.$inferSelect;
export type Term = typeof terms.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type ForumPublicationSettings = typeof forumPublicationSettings.$inferSelect;
