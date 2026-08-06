import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { and, eq, isNull } from 'drizzle-orm';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, type AutocompleteInteraction, type ButtonInteraction, type ChannelSelectMenuInteraction, type ChatInputCommandInteraction, type ForumChannel, type GuildMember, type ModalSubmitInteraction, type RoleSelectMenuInteraction, type StringSelectMenuInteraction } from 'discord.js';
import { assertTermTransition, assertCanStartTerm, type TermStatus } from '../../domain/term/lifecycle.js';
import { assertSafeKey } from '../../domain/shared/key.js';
import { validateFieldValue } from '../../domain/custom-field/validator.js';
import { ApplicationError, userMessage } from '../../app/errors/application-error.js';
import { ContextBuilder } from '../../app/services/context-builder.js';
import { OrganizationService } from '../../app/services/organization-service.js';
import { PermissionService } from '../../app/services/permission-service.js';
import type { PublicationService } from '../../app/services/publication-service.js';
import type { AppDatabase } from '../database/client.js';
import { auditLogs, classificationOptions, classifications, customFieldDefinitions, customFieldValues, forumPublicationSettings, guildConfigs, organizations, publications, roleBindings, setupSessions, templates, terms } from '../database/schema.js';
import type { Logger } from '../logging/logger.js';
import type { RefreshQueue } from '../scheduler/refresh-queue.js';
import { TemplateRenderer } from '../template/template-renderer.js';
import { ManagementInteractionRouter } from './interactions/router.js';
import { ManagementAutocompleteController } from './interactions/autocomplete.js';

export class InteractionHandler {
  private readonly organizations: OrganizationService;
  private readonly permissions: PermissionService;
  private readonly renderer = new TemplateRenderer();
  private readonly management: ManagementInteractionRouter;
  private readonly autocomplete: ManagementAutocompleteController;
  constructor(private readonly db: AppDatabase, private readonly publicationService: PublicationService, private readonly queue: RefreshQueue, private readonly logger: Logger) {
    this.organizations = new OrganizationService(db); this.permissions = new PermissionService(db);
    this.management = new ManagementInteractionRouter(db, publicationService, queue);
    this.autocomplete = new ManagementAutocompleteController(db);
  }
  async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) { await interaction.respond([]); return; }
    try { await this.autocomplete.handle(interaction); } catch (error) { this.logger.warn({ err: error, guildId: interaction.guildId }, 'autocomplete failed'); await interaction.respond([]).catch(() => undefined); }
  }
  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const correlationId = randomUUID();
    try {
      if (!interaction.inCachedGuild()) throw new ApplicationError('VALIDATION_ERROR', '서버 안에서만 사용할 수 있습니다.');
      if (this.management.supportsCommand(interaction.commandName)) { await this.management.handleCommand(interaction); return; }
      this.permissions.assertAdministrator(interaction.member as GuildMember);
      const subcommand = interaction.options.getSubcommand(); const destructive = subcommand === 'delete' || subcommand === 'remove';
      if (interaction.commandName === 'publication' && subcommand === 'create') {
        const selected = interaction.options.getChannel('channel', true);
        if (selected.type === ChannelType.GuildForum) { await this.beginForumPublication(interaction, selected); return; }
      }
      if (destructive && interaction.options.getBoolean('confirm') === null) {
        const sessionId = randomUUID(); const state = { command: interaction.commandName, organization: interaction.options.getString('organization'), key: interaction.options.getString('key'), classification: interaction.options.getString('classification'), name: interaction.options.getString('name'), publicationId: interaction.options.getInteger('publication_id') };
        this.db.insert(setupSessions).values({ id: sessionId, guildId: interaction.guildId, userId: interaction.user.id, kind: 'confirmation', state, expiresAt: new Date(Date.now() + 5 * 60_000) }).run();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`confirm:${sessionId}:yes`).setLabel('삭제').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`confirm:${sessionId}:no`).setLabel('취소').setStyle(ButtonStyle.Secondary));
        await interaction.reply({ content: '이 작업은 설정을 변경하거나 삭제합니다. 계속하시겠습니까?', components: [row], ephemeral: true }); return;
      }
      if (interaction.commandName === 'template' && ['create', 'edit'].includes(interaction.options.getSubcommand()) && !interaction.options.getString('content')) {
        const org = this.organization(interaction); const sessionId = randomUUID();
        this.db.insert(setupSessions).values({ id: sessionId, guildId: interaction.guildId, userId: interaction.user.id, kind: 'template_modal', state: { organizationId: org.id, action: interaction.options.getSubcommand(), name: interaction.options.getString('name', true), draft: interaction.options.getBoolean('draft') ?? false }, expiresAt: new Date(Date.now() + 15 * 60_000) }).run();
        const input = new TextInputBuilder().setCustomId('content').setLabel('Liquid 템플릿 내용').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
        await interaction.showModal(new ModalBuilder().setCustomId(`template:${sessionId}`).setTitle('템플릿 입력').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))); return;
      }
      if (interaction.commandName === 'org-field' && subcommand === 'set' && !interaction.options.getString('value') && !interaction.options.getRole('role_value') && !interaction.options.getChannel('channel_value')) {
        const org = this.organization(interaction); const key = interaction.options.getString('key', true); const definition = this.db.select().from(customFieldDefinitions).where(and(eq(customFieldDefinitions.organizationId, org.id), eq(customFieldDefinitions.key, key))).get(); if (!definition) throw new ApplicationError('NOT_FOUND', '필드를 찾을 수 없습니다.');
        if (definition.type === 'role' || definition.type === 'channel') throw new ApplicationError('VALIDATION_ERROR', `${definition.type === 'role' ? 'role_value' : 'channel_value'} 선택기를 사용해 값을 선택해 주세요.`);
        const sessionId = randomUUID(); this.db.insert(setupSessions).values({ id: sessionId, guildId: interaction.guildId, userId: interaction.user.id, kind: 'field_input', state: { organizationId: org.id, definitionId: definition.id, termId: interaction.options.getInteger('term_id') }, expiresAt: new Date(Date.now() + 15 * 60_000) }).run();
        if (definition.type === 'select' || definition.type === 'boolean') { const values = definition.type === 'boolean' ? ['true', 'false'] : definition.selectOptions ?? []; if (!values.length || values.length > 25) throw new ApplicationError('VALIDATION_ERROR', '선택 필드는 1~25개의 선택값이 필요합니다.'); const menu = new StringSelectMenuBuilder().setCustomId(`field:${sessionId}`).setPlaceholder(definition.label).addOptions(values.map((value) => new StringSelectMenuOptionBuilder().setLabel(value.slice(0, 100)).setValue(value))); await interaction.reply({ content: `**${definition.label}** 값을 선택하세요.`, components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ephemeral: true }); return; }
        const input = new TextInputBuilder().setCustomId('value').setLabel(definition.label.slice(0, 45)).setStyle(definition.type === 'multiline_text' ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(definition.required).setMaxLength(definition.type === 'multiline_text' ? 4000 : 1000); await interaction.showModal(new ModalBuilder().setCustomId(`field:${sessionId}`).setTitle('필드 값 입력').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))); return;
      }
      await interaction.deferReply({ ephemeral: true });
      const message = await this.dispatch(interaction);
      await interaction.editReply(message);
    } catch (error) {
      this.logger.error({ err: error, correlationId, guildId: interaction.guildId, userId: interaction.user.id, command: interaction.commandName }, 'interaction failed');
      const message = `${userMessage(error)}\n문의 코드: ${correlationId}`;
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message }).catch(() => undefined);
      else await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const correlationId = randomUUID();
    try {
      if (!interaction.inCachedGuild()) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 설정 화면입니다.');
      if (await this.management.handleModal(interaction)) return;
      if (interaction.customId.startsWith('forum:')) { await this.completeForumSettingsModal(interaction); return; }
      if (interaction.customId.startsWith('field:')) { this.permissions.assertAdministrator(interaction.member as GuildMember); const message = this.completeFieldSession(interaction.customId.slice('field:'.length), interaction.guildId, interaction.user.id, interaction.fields.getTextInputValue('value')); await interaction.reply({ content: message, ephemeral: true }); return; }
      if (!interaction.customId.startsWith('template:')) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 설정 화면입니다.');
      this.permissions.assertAdministrator(interaction.member as GuildMember); const sessionId = interaction.customId.slice('template:'.length);
      const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, sessionId)).get();
      if (!session || session.userId !== interaction.user.id || session.guildId !== interaction.guildId || session.expiresAt <= new Date()) throw new ApplicationError('VALIDATION_ERROR', '설정 화면이 만료되었습니다. 명령을 다시 실행해 주세요.');
      const state = session.state; const organizationId = Number(state.organizationId); const name = String(state.name); const action = String(state.action); const draft = Boolean(state.draft); const content = interaction.fields.getTextInputValue('content');
      if (!draft) this.renderer.validate(content); const existing = this.db.select().from(templates).where(and(eq(templates.organizationId, organizationId), eq(templates.name, name))).get();
      if (action === 'create') { if (existing) throw new ApplicationError('DUPLICATE_KEY', '같은 이름의 템플릿이 이미 있습니다.'); this.db.insert(templates).values({ organizationId, name, content, isDraft: draft }).run(); }
      else { if (!existing) throw new ApplicationError('NOT_FOUND', '템플릿을 찾을 수 없습니다.'); this.db.update(templates).set({ content, isDraft: draft }).where(eq(templates.id, existing.id)).run(); }
      this.db.delete(setupSessions).where(eq(setupSessions.id, sessionId)).run(); this.db.insert(auditLogs).values({ guildId: interaction.guildId, organizationId, actorUserId: interaction.user.id, action: 'template.changed', metadata: { name, draft, source: 'modal' } }).run(); this.queueOrganization(organizationId);
      await interaction.reply({ content: `템플릿 **${name}**을 저장했습니다${draft ? ' (초안)' : ''}.`, ephemeral: true });
    } catch (error) { this.logger.error({ err: error, correlationId, guildId: interaction.guildId, userId: interaction.user.id }, 'modal failed'); const content = `${userMessage(error)}\n문의 코드: ${correlationId}`; if (interaction.replied || interaction.deferred) await interaction.editReply(content).catch(() => undefined); else await interaction.reply({ content, ephemeral: true }).catch(() => undefined); }
  }
  async handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const correlationId = randomUUID();
    try {
      if (!interaction.inCachedGuild()) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 선택 요청입니다.');
      if (await this.management.handleComponent(interaction)) return;
      this.permissions.assertAdministrator(interaction.member as GuildMember);
      if (interaction.customId.startsWith('forum-tags:')) { const sessionId = interaction.customId.slice('forum-tags:'.length); const selectedChannel = await interaction.guild.channels.fetch(String(this.forumSession(sessionId, interaction.guildId, interaction.user.id).publication.channelId)); if (!selectedChannel || selectedChannel.type !== ChannelType.GuildForum) throw new ApplicationError('VALIDATION_ERROR', '선택한 채널이 더 이상 포럼 채널이 아닙니다.'); const panel = await this.updateForumTags(sessionId, interaction.guildId, interaction.user.id, interaction.values, selectedChannel); await interaction.update(panel); return; }
      if (!interaction.customId.startsWith('field:')) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 선택 요청입니다.');
      const message = this.completeFieldSession(interaction.customId.slice('field:'.length), interaction.guildId, interaction.user.id, interaction.values[0] ?? ''); await interaction.update({ content: message, components: [] });
    }
    catch (error) { this.logger.error({ err: error, correlationId, guildId: interaction.guildId, userId: interaction.user.id }, 'select failed'); const content = `${userMessage(error)}\n문의 코드: ${correlationId}`; if (interaction.replied || interaction.deferred) await interaction.editReply({ content, components: [] }).catch(() => undefined); else await interaction.reply({ content, ephemeral: true }).catch(() => undefined); }
  }
  async handleRoleSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
    const correlationId = randomUUID();
    try {
      if (!interaction.inCachedGuild()) throw new ApplicationError('VALIDATION_ERROR', '서버 안에서만 사용할 수 있습니다.');
      if (!await this.management.handleComponent(interaction)) throw new ApplicationError('VALIDATION_ERROR', '잘못된 역할 선택입니다.');
    } catch (error) {
      this.logger.error({ err: error, correlationId, guildId: interaction.guildId, userId: interaction.user.id }, 'role select failed');
      const content = `${userMessage(error)}\n문의 코드: ${correlationId}`;
      if (interaction.replied || interaction.deferred) await interaction.editReply({ content, components: [] }).catch(() => undefined);
      else await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
    }
  }
  async handleChannelSelect(interaction: ChannelSelectMenuInteraction): Promise<void> {
    const correlationId = randomUUID();
    try {
      if (!interaction.inCachedGuild()) throw new ApplicationError('VALIDATION_ERROR', '서버 안에서만 사용할 수 있습니다.');
      if (!await this.management.handleComponent(interaction)) throw new ApplicationError('VALIDATION_ERROR', '잘못된 채널 선택입니다.');
    } catch (error) {
      this.logger.error({ err: error, correlationId, guildId: interaction.guildId, userId: interaction.user.id }, 'channel select failed');
      const content = `${userMessage(error)}\n문의 코드: ${correlationId}`;
      if (interaction.replied || interaction.deferred) await interaction.editReply({ content, components: [] }).catch(() => undefined);
      else await interaction.reply({ content, ephemeral: true }).catch(() => undefined);
    }
  }
  private completeFieldSession(sessionId: string, guildId: string, userId: string, rawValue: string): string {
    const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, sessionId)).get(); if (!session || session.kind !== 'field_input' || session.guildId !== guildId || session.userId !== userId || session.expiresAt <= new Date()) throw new ApplicationError('VALIDATION_ERROR', '필드 입력 화면이 만료되었습니다.');
    const definitionId = Number(session.state.definitionId); const organizationId = Number(session.state.organizationId); const rawTermId = session.state.termId; const termId = typeof rawTermId === 'number' ? rawTermId : null; const definition = this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, definitionId)).get(); if (!definition) throw new ApplicationError('NOT_FOUND', '필드 정의를 찾을 수 없습니다.'); if (definition.scope === 'term' && !termId) throw new ApplicationError('VALIDATION_ERROR', '임기 범위 필드에는 term_id가 필요합니다.'); const value = validateFieldValue(definition, rawValue); if (value === null) throw new ApplicationError('INVALID_FIELD_VALUE', '필드 값이 필요합니다.');
    const existing = this.db.select().from(customFieldValues).where(and(eq(customFieldValues.definitionId, definitionId), termId === null ? and(eq(customFieldValues.organizationId, organizationId), isNull(customFieldValues.termId)) : eq(customFieldValues.termId, termId))).get(); this.db.transaction((tx) => { if (existing) tx.update(customFieldValues).set({ value }).where(eq(customFieldValues.id, existing.id)).run(); else tx.insert(customFieldValues).values({ definitionId, organizationId, termId, value }).run(); tx.delete(setupSessions).where(eq(setupSessions.id, sessionId)).run(); tx.insert(auditLogs).values({ guildId, organizationId, actorUserId: userId, action: 'field.value_set', metadata: { definitionId, termId, source: 'component' } }).run(); }); this.queueOrganization(organizationId); return `**${definition.label}** 값을 저장했습니다.`;
  }
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const correlationId = randomUUID();
    try {
      if (!interaction.inCachedGuild()) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 확인 요청입니다.'); this.permissions.assertAdministrator(interaction.member as GuildMember);
      if (await this.management.handleComponent(interaction)) return;
      if (interaction.customId.startsWith('forum:')) { await this.handleForumButton(interaction); return; }
      if (!interaction.customId.startsWith('confirm:')) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 확인 요청입니다.');
      const [, sessionId, decision] = interaction.customId.split(':'); if (!sessionId) throw new ApplicationError('VALIDATION_ERROR', '확인 요청 ID가 없습니다.'); const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, sessionId)).get();
      if (!session || session.kind !== 'confirmation' || session.userId !== interaction.user.id || session.guildId !== interaction.guildId || session.expiresAt <= new Date()) throw new ApplicationError('VALIDATION_ERROR', '확인 요청이 만료되었습니다. 명령을 다시 실행해 주세요.'); this.db.delete(setupSessions).where(eq(setupSessions.id, sessionId)).run();
      if (decision !== 'yes') { await interaction.update({ content: '작업을 취소했습니다.', components: [] }); return; }
      const state = session.state; const command = String(state.command); const orgKey = typeof state.organization === 'string' ? state.organization : null; const org = orgKey ? this.organizations.find(interaction.guildId, orgKey) : null; let result = '삭제했습니다.';
      if (command === 'publication') { const publicationId = Number(state.publicationId); const row = this.db.select().from(publications).where(eq(publications.id, publicationId)).get(); if (!row) throw new ApplicationError('NOT_FOUND', '게시 설정을 찾을 수 없습니다.'); this.db.delete(publications).where(eq(publications.id, publicationId)).run(); this.db.insert(auditLogs).values({ guildId: interaction.guildId, organizationId: row.organizationId, actorUserId: interaction.user.id, action: 'publication.deleted', metadata: { publicationId } }).run(); result = '게시 설정을 삭제했습니다. 기존 Discord 메시지는 보존됩니다.'; }
      else {
        if (!org) throw new ApplicationError('NOT_FOUND', '조직을 찾을 수 없습니다.'); const key = String(state.key ?? '');
        if (command === 'org') { if (this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'active'))).get()) throw new ApplicationError('VALIDATION_ERROR', '활성 임기가 있는 조직은 삭제할 수 없습니다.'); this.db.transaction((tx) => { tx.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, org.id)).run(); tx.update(publications).set({ autoRefresh: false }).where(eq(publications.organizationId, org.id)).run(); tx.insert(auditLogs).values({ guildId: interaction.guildId, organizationId: org.id, actorUserId: interaction.user.id, action: 'organization.deleted', metadata: { key: org.key, softDelete: true } }).run(); }); result = '조직을 삭제 상태로 변경했습니다. 역사 기록은 보존됩니다.'; }
        else if (command === 'org-role') { this.db.delete(roleBindings).where(and(eq(roleBindings.organizationId, org.id), eq(roleBindings.key, key))).run(); result = '역할 연결을 제거했습니다.'; }
        else if (command === 'org-field') { this.db.delete(customFieldDefinitions).where(and(eq(customFieldDefinitions.organizationId, org.id), eq(customFieldDefinitions.key, key))).run(); result = '필드를 제거했습니다.'; }
        else if (command === 'classification') { this.db.delete(classifications).where(and(eq(classifications.organizationId, org.id), eq(classifications.key, key))).run(); result = '분류를 제거했습니다.'; }
        else if (command === 'classification-option') { const classification = this.db.select().from(classifications).where(and(eq(classifications.organizationId, org.id), eq(classifications.key, String(state.classification)))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류를 찾을 수 없습니다.'); this.db.delete(classificationOptions).where(and(eq(classificationOptions.classificationId, classification.id), eq(classificationOptions.key, key))).run(); result = '분류 선택지를 제거했습니다.'; }
        else if (command === 'template') { const template = this.db.select().from(templates).where(and(eq(templates.organizationId, org.id), eq(templates.name, String(state.name)))).get(); if (!template) throw new ApplicationError('NOT_FOUND', '템플릿을 찾을 수 없습니다.'); if (this.db.select().from(publications).where(eq(publications.templateId, template.id)).get()) throw new ApplicationError('VALIDATION_ERROR', '게시 설정에서 사용 중인 템플릿은 삭제할 수 없습니다.'); this.db.delete(templates).where(eq(templates.id, template.id)).run(); result = '템플릿을 삭제했습니다.'; }
        else throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 삭제 작업입니다.');
        if (command !== 'org') { this.db.insert(auditLogs).values({ guildId: interaction.guildId, organizationId: org.id, actorUserId: interaction.user.id, action: `${command}.removed`, metadata: { key } }).run(); this.queueOrganization(org.id); }
      }
      await interaction.update({ content: result, components: [] });
    } catch (error) { this.logger.error({ err: error, correlationId, guildId: interaction.guildId, userId: interaction.user.id }, 'button failed'); const content = `${userMessage(error)}\n문의 코드: ${correlationId}`; if (interaction.replied || interaction.deferred) await interaction.editReply({ content, components: [] }).catch(() => undefined); else await interaction.reply({ content, ephemeral: true }).catch(() => undefined); }
  }

  private async beginForumPublication(interaction: ChatInputCommandInteraction<'cached'>, channel: ForumChannel): Promise<void> {
    const org = this.organization(interaction); const templateName = interaction.options.getString('template', true);
    const template = this.db.select().from(templates).where(and(eq(templates.organizationId, org.id), eq(templates.name, templateName))).get();
    if (!template || template.isDraft) throw new ApplicationError('INVALID_TEMPLATE', '유효한 템플릿을 찾을 수 없습니다.');
    const sessionId = randomUUID(); const autoRefresh = interaction.options.getBoolean('auto_refresh') ?? true;
    const publication = this.db.transaction((tx) => {
      const row = tx.insert(publications).values({ organizationId: org.id, templateId: template.id, name: interaction.options.getString('name', true), channelId: channel.id, autoRefresh: false }).returning().get();
      tx.insert(forumPublicationSettings).values({ publicationId: row.id, titleTemplate: '', appliedTagIdsJson: [], autoArchiveDuration: channel.defaultAutoArchiveDuration ?? 1440, slowmodeSeconds: channel.defaultThreadRateLimitPerUser ?? 0 }).run();
      tx.insert(setupSessions).values({ id: sessionId, guildId: interaction.guildId, userId: interaction.user.id, kind: 'forum_publication', state: { publicationId: row.id, autoRefresh }, expiresAt: new Date(Date.now() + 30 * 60_000) }).run();
      return row;
    });
    this.audit(interaction, org.id, 'publication.draft_created', { publicationId: publication.id, channelType: 'forum' });
    await interaction.reply({ ...(await this.forumPanel(sessionId, channel)), ephemeral: true });
  }

  private forumSession(sessionId: string, guildId: string, userId: string) {
    const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, sessionId)).get();
    if (!session || session.kind !== 'forum_publication' || session.guildId !== guildId || session.userId !== userId || session.expiresAt <= new Date()) throw new ApplicationError('VALIDATION_ERROR', '포럼 게시 설정 화면이 만료되었습니다. /publication create를 다시 실행해 주세요.');
    const publicationId = Number(session.state.publicationId); const publication = this.db.select().from(publications).where(eq(publications.id, publicationId)).get();
    const settings = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, publicationId)).get();
    if (!publication || !settings) throw new ApplicationError('FORUM_SETTINGS_MISSING', '포럼 게시 초안 또는 설정을 찾을 수 없습니다.');
    return { session, publication, settings };
  }

  private async forumPanel(sessionId: string, channel: ForumChannel) {
    const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, sessionId)).get();
    if (!session) throw new ApplicationError('VALIDATION_ERROR', '포럼 게시 설정 화면이 만료되었습니다.');
    const publicationId = Number(session.state.publicationId); const publication = this.db.select().from(publications).where(eq(publications.id, publicationId)).get();
    const settings = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, publicationId)).get();
    if (!publication || !settings) throw new ApplicationError('FORUM_SETTINGS_MISSING', '포럼 게시 설정이 없습니다.');
    const available = new Map(channel.availableTags.map((tag) => [tag.id, tag.name]));
    const selected = settings.appliedTagIdsJson.map((id) => available.get(id) ?? `삭제됨(${id})`);
    const autoRefresh = Boolean(session.state.autoRefresh); const warnings = settings.lockAfterPublish && autoRefresh ? '\n⚠️ 자동 갱신 게시물을 게시 후 잠그면 이후 갱신이 실패합니다.' : '';
    const content = [
      `**포럼 게시 설정 #${publication.id} — ${publication.name}**`,
      `제목 템플릿: ${settings.titleTemplate ? `\`${settings.titleTemplate.slice(0, 120)}\`` : '**미입력 (저장 전 필수)**'}`,
      `선택 태그: ${selected.length ? selected.join(', ') : '없음'}`,
      `자동 보관: ${settings.autoArchiveDuration}분 · 슬로우모드: ${settings.slowmodeSeconds}초`,
      `자동 갱신: ${autoRefresh ? '켜짐' : '꺼짐'} · 게시 후 보관: ${settings.archiveAfterPublish ? '켜짐' : '꺼짐'} · 게시 후 잠금: ${settings.lockAfterPublish ? '켜짐' : '꺼짐'}`,
      `수동 태그 보존: ${settings.preserveManualTags ? '켜짐' : '꺼짐'}${warnings}`
    ].join('\n');
    const components: Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> = [];
    if (channel.availableTags.length) {
      const menu = new StringSelectMenuBuilder().setCustomId(`forum-tags:${sessionId}`).setPlaceholder('적용할 포럼 태그를 선택하세요').setMinValues(0).setMaxValues(Math.min(5, channel.availableTags.length)).addOptions(channel.availableTags.map((tag) => new StringSelectMenuOptionBuilder().setLabel(tag.name.slice(0, 100)).setValue(tag.id).setDefault(settings.appliedTagIdsJson.includes(tag.id))));
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
    }
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`forum:${sessionId}:configure`).setLabel('설정 입력').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`forum:${sessionId}:preview`).setLabel('미리보기').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`forum:${sessionId}:save`).setLabel('저장').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`forum:${sessionId}:cancel`).setLabel('취소').setStyle(ButtonStyle.Danger)
    ));
    return { content, components };
  }

  private async updateForumTags(sessionId: string, guildId: string, userId: string, tagIds: readonly string[], channel: ForumChannel) {
    const { publication } = this.forumSession(sessionId, guildId, userId);
    const availableIds = new Set(channel.availableTags.map((tag) => tag.id));
    if (tagIds.length > 5 || tagIds.some((id) => !availableIds.has(id))) throw new ApplicationError('VALIDATION_ERROR', '유효한 포럼 태그를 최대 5개까지 선택해 주세요.');
    this.db.update(forumPublicationSettings).set({ appliedTagIdsJson: [...tagIds] }).where(eq(forumPublicationSettings.publicationId, publication.id)).run();
    return this.forumPanel(sessionId, channel);
  }

  private async completeForumSettingsModal(interaction: ModalSubmitInteraction<'cached'>): Promise<void> {
    this.permissions.assertAdministrator(interaction.member as GuildMember);
    const parts = interaction.customId.split(':'); const sessionId = parts[1];
    if (!sessionId || parts[2] !== 'settings') throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 포럼 설정 화면입니다.');
    const { publication } = this.forumSession(sessionId, interaction.guildId, interaction.user.id);
    const titleTemplate = interaction.fields.getTextInputValue('title').trim(); this.renderer.validate(titleTemplate);
    const autoArchiveDuration = Number(interaction.fields.getTextInputValue('archive_duration')); const slowmodeSeconds = Number(interaction.fields.getTextInputValue('slowmode'));
    if (![60, 1440, 4320, 10080].includes(autoArchiveDuration)) throw new ApplicationError('VALIDATION_ERROR', '자동 보관 시간은 60, 1440, 4320, 10080분 중 하나여야 합니다.');
    if (!Number.isInteger(slowmodeSeconds) || slowmodeSeconds < 0 || slowmodeSeconds > 21600) throw new ApplicationError('VALIDATION_ERROR', '슬로우모드는 0~21600초의 정수여야 합니다.');
    const flags = new Set(interaction.fields.getTextInputValue('flags').toLowerCase().split(',').map((value) => value.trim()).filter(Boolean));
    const allowedFlags = new Set(['archive', 'lock', 'preserve_manual_tags']); if ([...flags].some((flag) => !allowedFlags.has(flag))) throw new ApplicationError('VALIDATION_ERROR', '게시 후 동작에는 archive, lock, preserve_manual_tags만 쉼표로 입력할 수 있습니다.');
    this.db.update(forumPublicationSettings).set({ titleTemplate, autoArchiveDuration, slowmodeSeconds, archiveAfterPublish: flags.has('archive'), lockAfterPublish: flags.has('lock'), preserveManualTags: flags.has('preserve_manual_tags') }).where(eq(forumPublicationSettings.publicationId, publication.id)).run();
    const channel = await interaction.guild.channels.fetch(publication.channelId); if (!channel || channel.type !== ChannelType.GuildForum) throw new ApplicationError('VALIDATION_ERROR', '선택한 채널이 더 이상 포럼 채널이 아닙니다.');
    await interaction.reply({ ...(await this.forumPanel(sessionId, channel)), ephemeral: true });
  }

  private async handleForumButton(interaction: ButtonInteraction<'cached'>): Promise<void> {
    const [, sessionId, action] = interaction.customId.split(':'); if (!sessionId || !action) throw new ApplicationError('VALIDATION_ERROR', '유효하지 않은 포럼 설정 요청입니다.');
    const { session, publication, settings } = this.forumSession(sessionId, interaction.guildId, interaction.user.id);
    if (action === 'configure') {
      const titleInput = new TextInputBuilder().setCustomId('title').setLabel('포럼 제목 Liquid 템플릿').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1000); if (settings.titleTemplate) titleInput.setValue(settings.titleTemplate);
      const inputs = [
        titleInput,
        new TextInputBuilder().setCustomId('archive_duration').setLabel('자동 보관(60/1440/4320/10080분)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(settings.autoArchiveDuration)),
        new TextInputBuilder().setCustomId('slowmode').setLabel('슬로우모드(0~21600초)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String(settings.slowmodeSeconds)),
        new TextInputBuilder().setCustomId('flags').setLabel('archive, lock, preserve_manual_tags').setStyle(TextInputStyle.Short).setRequired(false).setValue([settings.archiveAfterPublish ? 'archive' : '', settings.lockAfterPublish ? 'lock' : '', settings.preserveManualTags ? 'preserve_manual_tags' : ''].filter(Boolean).join(', '))
      ];
      await interaction.showModal(new ModalBuilder().setCustomId(`forum:${sessionId}:settings`).setTitle('포럼 게시 상세 설정').addComponents(inputs.map((input) => new ActionRowBuilder<TextInputBuilder>().addComponents(input)))); return;
    }
    if (action === 'cancel') { this.db.transaction((tx) => { tx.delete(setupSessions).where(eq(setupSessions.id, sessionId)).run(); tx.delete(publications).where(eq(publications.id, publication.id)).run(); }); await interaction.update({ content: '포럼 게시 초안을 취소하고 삭제했습니다.', components: [] }); return; }
    if (action === 'save') {
      if (!settings.titleTemplate.trim()) throw new ApplicationError('FORUM_TITLE_EMPTY', '최종 저장 전에 포럼 제목 Liquid 템플릿을 입력해 주세요.'); this.renderer.validate(settings.titleTemplate);
      const autoRefresh = Boolean(session.state.autoRefresh); this.db.transaction((tx) => { tx.update(publications).set({ autoRefresh }).where(eq(publications.id, publication.id)).run(); tx.delete(setupSessions).where(eq(setupSessions.id, sessionId)).run(); tx.insert(auditLogs).values({ guildId: interaction.guildId, organizationId: publication.organizationId, actorUserId: interaction.user.id, action: 'publication.created', metadata: { publicationId: publication.id, channelType: 'forum' } }).run(); });
      const warning = settings.lockAfterPublish && autoRefresh ? '\n⚠️ 잠금 후에는 자동 갱신할 수 없습니다. lockAfterPublish 또는 autoRefresh를 끄는 것을 권장합니다.' : '';
      await interaction.update({ content: `포럼 게시 설정 #${publication.id}을 저장했습니다. /publication publish로 게시하세요.${warning}`, components: [] }); return;
    }
    if (action === 'preview') {
      if (!settings.titleTemplate.trim()) throw new ApplicationError('FORUM_TITLE_EMPTY', '미리보기 전에 포럼 제목 Liquid 템플릿을 입력해 주세요.');
      const template = this.db.select().from(templates).where(eq(templates.id, publication.templateId)).get(); if (!template) throw new ApplicationError('NOT_FOUND', '본문 템플릿을 찾을 수 없습니다.');
      const built = await new ContextBuilder(this.db).build(publication.organizationId, interaction.guild); const title = await this.renderer.render(settings.titleTemplate, built.context, { timeZone: built.timeZone, mentions: built.mentions, maxLength: 1000 }); const body = await this.renderer.render(template.content, built.context, { timeZone: built.timeZone, mentions: built.mentions });
      await interaction.reply({ content: `**제목 미리보기**\n${title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)}\n\n**본문 미리보기**\n${body}`, ephemeral: true }); return;
    }
    throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 포럼 설정 작업입니다.');
  }

  private async dispatch(i: ChatInputCommandInteraction): Promise<string> {
    const sub = i.options.getSubcommand();
    switch (i.commandName) {
      case 'org': return this.handleOrg(i, sub);
      case 'org-role': return this.handleRole(i, sub);
      case 'org-field': return this.handleField(i, sub);
      case 'classification': return this.handleClassification(i, sub);
      case 'classification-option': return this.handleClassificationOption(i, sub);
      case 'term': return this.handleTerm(i, sub);
      case 'template': return this.handleTemplate(i, sub);
      case 'publication': return this.handlePublication(i, sub);
      default: throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 명령입니다.');
    }
  }
  private organization(i: ChatInputCommandInteraction) {
    const row = this.organizations.find(i.guildId!, i.options.getString('organization', true));
    if (!row) throw new ApplicationError('NOT_FOUND', '조직을 찾을 수 없습니다.'); return row;
  }
  private audit(i: ChatInputCommandInteraction, organizationId: number | null, action: string, metadata: Record<string, unknown> = {}): void {
    this.db.insert(auditLogs).values({ guildId: i.guildId!, organizationId, actorUserId: i.user.id, action, metadata }).run();
  }
  private queueOrganization(organizationId: number): void { this.db.select({ id: publications.id }).from(publications).where(and(eq(publications.organizationId, organizationId), eq(publications.autoRefresh, true))).all().forEach((row) => this.queue.enqueue(row.id)); }

  private async handleOrg(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    if (sub === 'config') { this.organizations.ensureGuild(i.guildId!); const timeZone = i.options.getString('time_zone'); if (timeZone && !DateTime.local().setZone(timeZone).isValid) throw new ApplicationError('VALIDATION_ERROR', '유효한 IANA 시간대를 입력해 주세요.'); const role = i.options.getRole('administrator_role'); this.db.update(guildConfigs).set({ ...(timeZone ? { timeZone } : {}), ...(i.options.getString('locale') ? { locale: i.options.getString('locale')! } : {}), ...(role ? { administratorRoleId: role.id } : {}) }).where(eq(guildConfigs.guildId, i.guildId!)).run(); this.audit(i, null, 'guild_config.updated', { timeZone, administratorRoleId: role?.id }); return '서버별 봇 설정을 수정했습니다.'; }
    if (sub === 'create') { const row = this.organizations.create({ guildId: i.guildId!, key: i.options.getString('key', true), name: i.options.getString('name', true), foreignName: i.options.getString('foreign_name'), pronunciation: i.options.getString('pronunciation'), description: i.options.getString('description'), actorUserId: i.user.id }); return `조직 **${row.name}**(${row.key})을 생성했습니다.`; }
    if (sub === 'list') { const rows = this.organizations.list(i.guildId!); return rows.length ? rows.map((row) => `• \`${row.key}\` — ${row.name}`).join('\n') : '등록된 조직이 없습니다.'; }
    const org = this.organization(i);
    if (sub === 'show') return `**${org.name}** (\`${org.key}\`)\n${org.foreignName ?? ''}\n${org.description ?? '설명 없음'}`;
    if (sub === 'edit') { const name = i.options.getString('name') ?? org.name; const description = i.options.getString('description') ?? org.description; this.db.update(organizations).set({ name, description }).where(eq(organizations.id, org.id)).run(); this.audit(i, org.id, 'organization.updated', { name }); this.queueOrganization(org.id); return '조직 정보를 수정했습니다.'; }
    if (sub === 'delete') { if (!i.options.getBoolean('confirm', true)) return '삭제가 취소되었습니다.'; const active = this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'active'))).get(); if (active) throw new ApplicationError('VALIDATION_ERROR', '활성 임기가 있는 조직은 삭제할 수 없습니다. 먼저 임기를 종료해 주세요.'); this.db.transaction((tx) => { tx.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, org.id)).run(); tx.update(publications).set({ autoRefresh: false }).where(eq(publications.organizationId, org.id)).run(); tx.insert(auditLogs).values({ guildId: i.guildId!, organizationId: org.id, actorUserId: i.user.id, action: 'organization.deleted', metadata: { key: org.key, softDelete: true } }).run(); }); return '조직을 삭제 상태로 변경했습니다. 임기와 감사 기록은 보존됩니다.'; }
    if (sub === 'inspect') { const built = await new ContextBuilder(this.db).build(org.id, i.guild!); const publicationRows = this.db.select().from(publications).where(eq(publications.organizationId, org.id)).all(); const warnings = [...built.context.warnings, ...publicationRows.filter((row) => row.broken).map((row) => `게시 설정 #${row.id}(${row.name})이 손상되었습니다.`), ...publicationRows.filter((row) => row.lastRenderError).map((row) => `게시 설정 #${row.id} 렌더링 오류: ${row.lastRenderError}`)]; return warnings.length ? `**진단 결과**\n${warnings.map((warning) => `⚠️ ${warning}`).join('\n')}` : '진단 결과 문제가 없습니다.'; }
    throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 조직 작업입니다.');
  }

  private async handleRole(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    const org = this.organization(i); const key = i.options.getString('key');
    if (sub === 'list') { const rows = this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, org.id)).all(); return rows.length ? rows.map((row) => `• \`${row.key}\` ${row.displayName} <@&${row.discordRoleId}> (${row.kind}/${row.cardinality}${row.required ? '/필수' : ''})`).join('\n') : '역할 연결이 없습니다.'; }
    if (!key) throw new ApplicationError('VALIDATION_ERROR', '역할 연결 키가 필요합니다.');
    if (sub === 'add') { const role = i.options.getRole('role', true); this.organizations.addRoleBinding({ organizationId: org.id, key, displayName: i.options.getString('display_name', true), discordRoleId: role.id, kind: i.options.getString('kind', true) as 'office' | 'membership', cardinality: i.options.getString('cardinality', true) as 'one' | 'many', required: i.options.getBoolean('required', true), displayOrder: i.options.getInteger('display_order') ?? 0, guildId: i.guildId!, actorUserId: i.user.id }); this.queueOrganization(org.id); return `역할 연결 \`${key}\`을 추가했습니다.`; }
    const row = this.db.select().from(roleBindings).where(and(eq(roleBindings.organizationId, org.id), eq(roleBindings.key, key))).get(); if (!row) throw new ApplicationError('NOT_FOUND', '역할 연결을 찾을 수 없습니다.');
    if (sub === 'edit') { const selected = i.options.getRole('role'); this.db.update(roleBindings).set({ displayName: i.options.getString('display_name') ?? row.displayName, discordRoleId: selected?.id ?? row.discordRoleId }).where(eq(roleBindings.id, row.id)).run(); this.audit(i, org.id, 'role_binding.updated', { key }); this.queueOrganization(org.id); return '역할 연결을 수정했습니다.'; }
    if (sub === 'remove' && i.options.getBoolean('confirm', true)) { this.db.delete(roleBindings).where(eq(roleBindings.id, row.id)).run(); this.audit(i, org.id, 'role_binding.removed', { key }); this.queueOrganization(org.id); return '역할 연결을 제거했습니다.'; }
    return '작업이 취소되었습니다.';
  }

  private async handleField(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    const org = this.organization(i); const key = i.options.getString('key');
    if (sub === 'list') { const rows = this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.organizationId, org.id)).all(); return rows.length ? rows.map((row) => `• \`${row.key}\` ${row.label} (${row.scope}/${row.type}${row.required ? '/필수' : ''})`).join('\n') : '사용자 정의 필드가 없습니다.'; }
    if (!key) throw new ApplicationError('VALIDATION_ERROR', '필드 키가 필요합니다.');
    if (sub === 'add') { assertSafeKey(key); const options = i.options.getString('select_options')?.split(',').map((value) => value.trim()).filter(Boolean) ?? null; this.db.insert(customFieldDefinitions).values({ organizationId: org.id, key, label: i.options.getString('label', true), scope: i.options.getString('scope', true) as 'organization' | 'term', type: i.options.getString('type', true) as typeof customFieldDefinitions.$inferInsert.type, required: i.options.getBoolean('required', true), selectOptions: options, defaultValue: i.options.getString('default_value') }).run(); this.audit(i, org.id, 'field.created', { key }); return `필드 \`${key}\`을 추가했습니다.`; }
    const definition = this.db.select().from(customFieldDefinitions).where(and(eq(customFieldDefinitions.organizationId, org.id), eq(customFieldDefinitions.key, key))).get(); if (!definition) throw new ApplicationError('NOT_FOUND', '필드를 찾을 수 없습니다.');
    if (sub === 'set') { const rawValue = definition.type === 'role' ? i.options.getRole('role_value')?.id ?? null : definition.type === 'channel' ? i.options.getChannel('channel_value')?.id ?? null : i.options.getString('value'); const value = validateFieldValue(definition, rawValue); if (value === null) throw new ApplicationError('INVALID_FIELD_VALUE', `${definition.type} 형식에 맞는 값을 선택하거나 입력해 주세요.`); const termId = definition.scope === 'term' ? i.options.getInteger('term_id') : null; if (definition.scope === 'term' && !termId) throw new ApplicationError('VALIDATION_ERROR', '임기 범위 필드에는 term_id가 필요합니다.'); const existingValue = this.db.select().from(customFieldValues).where(and(eq(customFieldValues.definitionId, definition.id), termId === null ? and(eq(customFieldValues.organizationId, org.id), isNull(customFieldValues.termId)) : eq(customFieldValues.termId, termId))).get(); if (existingValue) this.db.update(customFieldValues).set({ value }).where(eq(customFieldValues.id, existingValue.id)).run(); else this.db.insert(customFieldValues).values({ definitionId: definition.id, organizationId: org.id, termId, value }).run(); this.audit(i, org.id, 'field.value_set', { key, termId }); this.queueOrganization(org.id); return '필드 값을 저장했습니다.'; }
    if (sub === 'edit') { this.db.update(customFieldDefinitions).set({ label: i.options.getString('label') ?? definition.label }).where(eq(customFieldDefinitions.id, definition.id)).run(); this.audit(i, org.id, 'field.updated', { key }); return '필드 정의를 수정했습니다.'; }
    if (sub === 'remove' && i.options.getBoolean('confirm', true)) { this.db.delete(customFieldDefinitions).where(eq(customFieldDefinitions.id, definition.id)).run(); this.audit(i, org.id, 'field.removed', { key }); this.queueOrganization(org.id); return '필드를 제거했습니다.'; }
    return '작업이 취소되었습니다.';
  }

  private async handleClassification(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    const org = this.organization(i); const key = i.options.getString('key');
    if (sub === 'list') { const rows = this.db.select().from(classifications).where(eq(classifications.organizationId, org.id)).all(); return rows.length ? rows.map((row) => `• \`${row.key}\` ${row.displayName} (기준: \`${row.baseRoleKey}\`)`).join('\n') : '분류가 없습니다.'; }
    if (!key) throw new ApplicationError('VALIDATION_ERROR', '분류 키가 필요합니다.'); assertSafeKey(key);
    if (sub === 'create') { const baseKey = i.options.getString('base_role_key', true); if (!this.db.select().from(roleBindings).where(and(eq(roleBindings.organizationId, org.id), eq(roleBindings.key, baseKey))).get()) throw new ApplicationError('NOT_FOUND', '기준 역할 연결을 찾을 수 없습니다.'); this.db.insert(classifications).values({ organizationId: org.id, key, displayName: i.options.getString('display_name', true), baseRoleKey: baseKey, exclusive: i.options.getBoolean('exclusive', true), allowUnassigned: i.options.getBoolean('allow_unassigned', true), unassignedLabel: i.options.getString('unassigned_label', true), capacityFieldKey: i.options.getString('capacity_field_key') }).run(); this.audit(i, org.id, 'classification.created', { key }); return '분류를 생성했습니다.'; }
    const row = this.db.select().from(classifications).where(and(eq(classifications.organizationId, org.id), eq(classifications.key, key))).get(); if (!row) throw new ApplicationError('NOT_FOUND', '분류를 찾을 수 없습니다.');
    if (sub === 'edit') { this.db.update(classifications).set({ displayName: i.options.getString('display_name', true) }).where(eq(classifications.id, row.id)).run(); this.audit(i, org.id, 'classification.updated', { key }); this.queueOrganization(org.id); return '분류를 수정했습니다.'; }
    if (sub === 'remove' && i.options.getBoolean('confirm', true)) { this.db.delete(classifications).where(eq(classifications.id, row.id)).run(); this.audit(i, org.id, 'classification.removed', { key }); this.queueOrganization(org.id); return '분류를 제거했습니다.'; }
    return '작업이 취소되었습니다.';
  }

  private async handleClassificationOption(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    const org = this.organization(i); const classificationKey = i.options.getString('classification', true); const key = i.options.getString('key', true); assertSafeKey(key);
    const classification = this.db.select().from(classifications).where(and(eq(classifications.organizationId, org.id), eq(classifications.key, classificationKey))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류를 찾을 수 없습니다.');
    if (sub === 'add') { this.db.insert(classificationOptions).values({ classificationId: classification.id, key, displayName: i.options.getString('display_name', true), discordRoleId: i.options.getRole('role', true).id, displayOrder: i.options.getInteger('display_order') ?? 0 }).run(); this.audit(i, org.id, 'classification_option.created', { classificationKey, key }); this.queueOrganization(org.id); return '분류 선택지를 추가했습니다.'; }
    const row = this.db.select().from(classificationOptions).where(and(eq(classificationOptions.classificationId, classification.id), eq(classificationOptions.key, key))).get(); if (!row) throw new ApplicationError('NOT_FOUND', '분류 선택지를 찾을 수 없습니다.');
    if (sub === 'edit') { this.db.update(classificationOptions).set({ displayName: i.options.getString('display_name', true) }).where(eq(classificationOptions.id, row.id)).run(); this.audit(i, org.id, 'classification_option.updated', { key }); this.queueOrganization(org.id); return '분류 선택지를 수정했습니다.'; }
    if (sub === 'remove' && i.options.getBoolean('confirm', true)) { this.db.delete(classificationOptions).where(eq(classificationOptions.id, row.id)).run(); this.audit(i, org.id, 'classification_option.removed', { key }); this.queueOrganization(org.id); return '분류 선택지를 제거했습니다.'; }
    return '작업이 취소되었습니다.';
  }

  private parseDate(value: string | null, fallback: Date | null = null): Date | null {
    if (!value) return fallback; const parsed = DateTime.fromISO(value, { zone: 'Asia/Seoul' });
    if (!parsed.isValid) throw new ApplicationError('VALIDATION_ERROR', `날짜/시간 형식이 올바르지 않습니다: ${value}`); return parsed.toUTC().toJSDate();
  }
  private async handleTerm(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    const org = this.organization(i);
    const active = this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'active'))).get();
    if (sub === 'show') return active ? `**${active.displayName}** (#${active.id})\n상태: ${active.status}\n시작: ${active.startAt.toISOString()}\n예정 종료: ${active.scheduledEndAt?.toISOString() ?? '미정'}` : '활성 임기가 없습니다.';
    if (sub === 'history') { const rows = this.db.select().from(terms).where(eq(terms.organizationId, org.id)).all(); return rows.length ? rows.map((row) => `• #${row.id} ${row.displayName} — ${row.status}`).join('\n') : '임기 기록이 없습니다.'; }
    if (sub === 'start') {
      const closeCurrent = i.options.getBoolean('close_current') ?? false; assertCanStartTerm(active ? 1 : 0, closeCurrent);
      const now = new Date(); const startAt = this.parseDate(i.options.getString('start_at'), now)!; const scheduledEndAt = this.parseDate(i.options.getString('scheduled_end_at'));
      const requiredDefinitions = this.db.select().from(customFieldDefinitions).where(and(eq(customFieldDefinitions.organizationId, org.id), eq(customFieldDefinitions.scope, 'term'), eq(customFieldDefinitions.required, true))).all();
      const supplied = Object.fromEntries((i.options.getString('field_values') ?? '').split(';').map((pair) => pair.split('=', 2).map((part) => part.trim())).filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0])));
      const missing = requiredDefinitions.filter((definition) => !(definition.key in supplied));
      const sessionId = `${i.guildId}:${i.user.id}:term:${org.id}`;
      if (missing.length) { this.db.insert(setupSessions).values({ id: sessionId, guildId: i.guildId!, userId: i.user.id, kind: 'term_start', state: { organizationId: org.id, supplied }, expiresAt: new Date(Date.now() + 15 * 60_000) }).onConflictDoUpdate({ target: setupSessions.id, set: { state: { organizationId: org.id, supplied }, expiresAt: new Date(Date.now() + 15 * 60_000) } }).run(); throw new ApplicationError('VALIDATION_ERROR', `필수 임기 필드가 누락되었습니다: ${missing.map((field) => `${field.key}(${field.label})`).join(', ')}. 15분 안에 field_values에 key=value;key=value 형식으로 입력해 다시 실행하세요.`); }
      const validatedFields = requiredDefinitions.map((definition) => ({ definitionId: definition.id, value: validateFieldValue(definition, supplied[definition.key] ?? null)! }));
      const row = this.db.transaction((tx) => { if (active && closeCurrent) tx.update(terms).set({ status: 'ended', actualEndAt: now, endReason: '새 임기 시작' }).where(eq(terms.id, active.id)).run(); const created = tx.insert(terms).values({ organizationId: org.id, termNumber: i.options.getInteger('number'), displayName: i.options.getString('name', true), startAt, scheduledEndAt, status: startAt > now ? 'scheduled' : 'active' }).returning().get(); if (validatedFields.length) tx.insert(customFieldValues).values(validatedFields.map((field) => ({ ...field, organizationId: org.id, termId: created.id }))).run(); tx.delete(setupSessions).where(eq(setupSessions.id, sessionId)).run(); tx.insert(auditLogs).values({ guildId: i.guildId!, organizationId: org.id, actorUserId: i.user.id, action: 'term.started', metadata: { termId: created.id } }).run(); return created; });
      this.queueOrganization(org.id); return `임기 **${row.displayName}**(#${row.id})을 ${row.status} 상태로 생성했습니다.`;
    }
    if (sub === 'edit') { const id = i.options.getInteger('term_id', true); const row = this.db.select().from(terms).where(and(eq(terms.id, id), eq(terms.organizationId, org.id))).get(); if (!row) throw new ApplicationError('NOT_FOUND', '임기를 찾을 수 없습니다.'); this.db.update(terms).set({ displayName: i.options.getString('name') ?? row.displayName, scheduledEndAt: this.parseDate(i.options.getString('scheduled_end_at'), row.scheduledEndAt) }).where(eq(terms.id, id)).run(); this.audit(i, org.id, 'term.updated', { termId: id }); this.queueOrganization(org.id); return '임기 정보를 수정했습니다.'; }
    const current = sub === 'resume' ? this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'suspended'))).get() : active;
    if (!current) throw new ApplicationError('NOT_FOUND', sub === 'resume' ? '중지된 임기가 없습니다.' : '활성 임기가 없습니다.');
    const targetByCommand: Record<string, TermStatus> = { end: 'ended', dissolve: 'dissolved', suspend: 'suspended', resume: 'active' };
    const target = targetByCommand[sub]; if (!target) throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 임기 작업입니다.');
    const source = current.status as TermStatus; assertTermTransition(source, target);
    const terminal = ['ended', 'dissolved'].includes(target); this.db.update(terms).set({ status: target, actualEndAt: terminal ? new Date() : current.actualEndAt, endReason: i.options.getString('reason') ?? current.endReason }).where(and(eq(terms.id, current.id), eq(terms.status, source))).run(); this.audit(i, org.id, `term.${target}`, { termId: current.id }); this.queueOrganization(org.id); return `임기 상태를 ${target}(으)로 변경했습니다.`;
  }

  private async handleTemplate(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    const org = this.organization(i); const name = i.options.getString('name');
    if (sub === 'list') { const rows = this.db.select().from(templates).where(eq(templates.organizationId, org.id)).all(); return rows.length ? rows.map((row) => `• #${row.id} ${row.name}${row.isDraft ? ' (초안)' : ''}`).join('\n') : '템플릿이 없습니다.'; }
    if (!name) throw new ApplicationError('VALIDATION_ERROR', '템플릿 이름이 필요합니다.');
    const existing = this.db.select().from(templates).where(and(eq(templates.organizationId, org.id), eq(templates.name, name))).get();
    if (sub === 'create' || sub === 'edit' || sub === 'import') {
      let content = i.options.getString('content');
      if (sub === 'import') { const file = i.options.getAttachment('file', true); if (!file.name.toLowerCase().endsWith('.txt') || file.size > 100_000) throw new ApplicationError('VALIDATION_ERROR', '100KB 이하의 .txt 파일만 가져올 수 있습니다.'); const response = await fetch(file.url); if (!response.ok) throw new ApplicationError('VALIDATION_ERROR', '첨부 파일을 내려받을 수 없습니다.'); content = await response.text(); }
      if (!content) throw new ApplicationError('VALIDATION_ERROR', '템플릿 내용이 비어 있습니다.'); const draft = i.options.getBoolean('draft') ?? false;
      if (!draft) this.renderer.validate(content);
      if (sub === 'create' || sub === 'import') { if (existing) throw new ApplicationError('DUPLICATE_KEY', '같은 이름의 템플릿이 이미 있습니다.'); this.db.insert(templates).values({ organizationId: org.id, name, content, isDraft: draft }).run(); }
      else { if (!existing) throw new ApplicationError('NOT_FOUND', '템플릿을 찾을 수 없습니다.'); this.db.update(templates).set({ content, isDraft: draft }).where(eq(templates.id, existing.id)).run(); }
      this.audit(i, org.id, 'template.changed', { name, draft }); this.queueOrganization(org.id); return `템플릿 **${name}**을 저장했습니다${draft ? ' (초안)' : ''}.`;
    }
    if (!existing) throw new ApplicationError('NOT_FOUND', '템플릿을 찾을 수 없습니다.');
    if (sub === 'show') return `**${existing.name}**${existing.isDraft ? ' (초안)' : ''}\n\`\`\`liquid\n${existing.content.slice(0, 1800)}\n\`\`\``;
    if (sub === 'preview') { const built = await new ContextBuilder(this.db).build(org.id, i.guild!); return this.renderer.render(existing.content, built.context, { timeZone: built.timeZone, mentions: built.mentions }); }
    if (sub === 'delete' && i.options.getBoolean('confirm', true)) { const used = this.db.select().from(publications).where(eq(publications.templateId, existing.id)).get(); if (used) throw new ApplicationError('VALIDATION_ERROR', '게시 설정에서 사용 중인 템플릿은 삭제할 수 없습니다.'); this.db.delete(templates).where(eq(templates.id, existing.id)).run(); this.audit(i, org.id, 'template.deleted', { name }); return '템플릿을 삭제했습니다.'; }
    return '작업이 취소되었습니다.';
  }

  private async handlePublication(i: ChatInputCommandInteraction, sub: string): Promise<string> {
    if (sub === 'create' || sub === 'list') {
      const org = this.organization(i);
      if (sub === 'list') { const rows = this.db.select().from(publications).where(eq(publications.organizationId, org.id)).all(); return rows.length ? rows.map((row) => `• #${row.id} ${row.name} <#${row.channelId}>${row.broken ? ' ⚠️ 손상됨' : ''}`).join('\n') : '게시 설정이 없습니다.'; }
      const templateName = i.options.getString('template', true); const template = this.db.select().from(templates).where(and(eq(templates.organizationId, org.id), eq(templates.name, templateName))).get(); if (!template || template.isDraft) throw new ApplicationError('INVALID_TEMPLATE', '유효한 템플릿을 찾을 수 없습니다.');
      const channel = i.options.getChannel('channel', true); const row = this.db.insert(publications).values({ organizationId: org.id, templateId: template.id, name: i.options.getString('name', true), channelId: channel.id, autoRefresh: i.options.getBoolean('auto_refresh') ?? true }).returning().get(); this.audit(i, org.id, 'publication.created', { publicationId: row.id }); return `게시 설정 #${row.id}을 생성했습니다. /publication publish로 최초 메시지를 게시하세요.`;
    }
    const id = i.options.getInteger('publication_id', true); const row = this.db.select().from(publications).where(eq(publications.id, id)).get(); if (!row) throw new ApplicationError('NOT_FOUND', '게시 설정을 찾을 수 없습니다.');
    if (sub === 'publish') { if (row.messageId) throw new ApplicationError('VALIDATION_ERROR', '이미 게시된 메시지가 있습니다. refresh를 사용하세요.'); const result = await this.publicationService.refresh(id); this.audit(i, row.organizationId, 'publication.published', { publicationId: id, diagnostics: result.diagnostics.map((diagnostic) => diagnostic.code) }); return `게시물을 생성하고 메시지 ID를 저장했습니다.${this.formatPublicationDiagnostics(result.diagnostics)}`; }
    if (sub === 'refresh') { const result = await this.publicationService.refresh(id); return `기존 게시물을 갱신했습니다.${this.formatPublicationDiagnostics(result.diagnostics)}`; }
    if (sub === 'repair') { const result = await this.publicationService.refresh(id, true); this.audit(i, row.organizationId, 'publication.repaired', { publicationId: id, diagnostics: result.diagnostics.map((diagnostic) => diagnostic.code) }); return `대체 메시지를 만들고 게시 설정을 복구했습니다.${this.formatPublicationDiagnostics(result.diagnostics)}`; }
    if (sub === 'preview') { const template = this.db.select().from(templates).where(eq(templates.id, row.templateId)).get(); if (!template) throw new ApplicationError('NOT_FOUND', '템플릿을 찾을 수 없습니다.'); const built = await new ContextBuilder(this.db).build(row.organizationId, i.guild!); const body = await this.renderer.render(template.content, built.context, { timeZone: built.timeZone, mentions: built.mentions }); const forum = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, row.id)).get(); if (!forum) return body; if (!forum.titleTemplate.trim()) throw new ApplicationError('FORUM_TITLE_EMPTY', '포럼 제목 템플릿이 비어 있습니다.'); const title = await this.renderer.render(forum.titleTemplate, built.context, { timeZone: built.timeZone, mentions: built.mentions, maxLength: 1000 }); return `**포럼 제목**\n${title.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)}\n\n**본문**\n${body}`; }
    if (sub === 'delete' && i.options.getBoolean('confirm', true)) { this.db.delete(publications).where(eq(publications.id, id)).run(); this.audit(i, row.organizationId, 'publication.deleted', { publicationId: id }); return '게시 설정을 삭제했습니다. 기존 Discord 메시지는 보존됩니다.'; }
    return '작업이 취소되었습니다.';
  }

  private formatPublicationDiagnostics(diagnostics: ReadonlyArray<{ code: string; message: string }>): string {
    return diagnostics.length ? `\n\n**진단**\n${diagnostics.map((diagnostic) => `⚠️ [${diagnostic.code}] ${diagnostic.message}`).join('\n')}` : '';
  }
}
