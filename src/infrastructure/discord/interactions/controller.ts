import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, ModalBuilder,
  RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type ChatInputCommandInteraction, type GuildMember, type ModalSubmitInteraction,
  type RoleSelectMenuInteraction, type StringSelectMenuInteraction
} from 'discord.js';
import { assertCanStartTerm, assertTermTransition } from '../../../domain/term/lifecycle.js';
import { validateFieldValue } from '../../../domain/custom-field/validator.js';
import { ApplicationError } from '../../../app/errors/application-error.js';
import { ContextBuilder } from '../../../app/services/context-builder.js';
import { OrganizationService } from '../../../app/services/organization-service.js';
import { PermissionService } from '../../../app/services/permission-service.js';
import type { PublicationService } from '../../../app/services/publication-service.js';
import type { AppDatabase } from '../../database/client.js';
import { auditLogs, classificationOptions, classifications, customFieldDefinitions, customFieldValues, forumPublicationSettings, organizations, publications, roleBindings, setupSessions, templates, terms } from '../../database/schema.js';
import type { RefreshQueue } from '../../scheduler/refresh-queue.js';
import { TemplateRenderer } from '../../template/template-renderer.js';
import { assertOwner, customId, parseCustomId, type ParsedCustomId } from './core/custom-id.js';
import { pageOf, truncateMessage } from './core/pagination.js';
import { organizationPanel } from './org/panel.js';
import { publicationPanel } from './publication/panel.js';
import { templatePanel } from './template/panel.js';
import { termPanel } from './term/panel.js';

type ComponentInteraction = ButtonInteraction<'cached'> | StringSelectMenuInteraction<'cached'> | RoleSelectMenuInteraction<'cached'>;

export class ManagementInteractionController {
  private readonly organizations: OrganizationService;
  private readonly permissions: PermissionService;
  private readonly renderer = new TemplateRenderer();
  constructor(private readonly db: AppDatabase, private readonly publicationService: PublicationService, private readonly queue: RefreshQueue) {
    this.organizations = new OrganizationService(db); this.permissions = new PermissionService(db);
  }

  supportsCommand(name: string): boolean { return ['org', 'term', 'template', 'publication', 'diagnose', 'help'].includes(name); }

  async handleCommand(i: ChatInputCommandInteraction<'cached'>): Promise<void> {
    this.authorize(i.member as GuildMember);
    const sub = ['diagnose', 'help'].includes(i.commandName) ? '' : i.options.getSubcommand();
    if (i.commandName === 'org') return this.handleOrg(i, sub);
    if (i.commandName === 'term') return this.handleTerm(i, sub);
    if (i.commandName === 'template') return this.handleTemplate(i, sub);
    if (i.commandName === 'publication') return this.handlePublication(i, sub);
    if (i.commandName === 'diagnose') return this.handleDiagnose(i);
    return this.handleHelp(i);
  }

  async handleComponent(i: ComponentInteraction): Promise<boolean> {
    if (!/^(org|term|tpl|pub|diag|help):v1:/.test(i.customId)) return false;
    const parsed = parseCustomId(i.customId); assertOwner(parsed, i.user.id); this.authorize(i.member as GuildMember);
    if (i.isRoleSelectMenu()) await this.handleRoleSelect(i, parsed);
    else if (i.isStringSelectMenu()) await this.handleStringSelect(i, parsed);
    else await this.handleButton(i, parsed);
    return true;
  }

  async handleModal(i: ModalSubmitInteraction<'cached'>): Promise<boolean> {
    if (!/^(org|term|tpl|pub):v1:/.test(i.customId)) return false;
    const parsed = parseCustomId(i.customId); assertOwner(parsed, i.user.id); this.authorize(i.member as GuildMember);
    if (parsed.area === 'tpl') await this.templateModal(i, parsed);
    else if (parsed.area === 'org') await this.organizationModal(i, parsed);
    else if (parsed.area === 'term') await this.termModal(i, parsed);
    else await this.publicationModal(i, parsed);
    return true;
  }

  private authorize(member: GuildMember): void { this.permissions.assertAdministrator(member); }
  private organization(guildId: string, key: string) {
    const row = this.organizations.find(guildId, key); if (!row) throw new ApplicationError('NOT_FOUND', '이 서버에서 조직을 찾을 수 없습니다.'); return row;
  }
  private organizationById(guildId: string, id: number) {
    const row = this.db.select().from(organizations).where(and(eq(organizations.id, id), eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).get();
    if (!row) throw new ApplicationError('NOT_FOUND', '조직이 삭제되었거나 다른 서버에 속합니다.'); return row;
  }
  private publication(guildId: string, id: number) {
    const row = this.db.select({ publication: publications }).from(publications).innerJoin(organizations, eq(organizations.id, publications.organizationId)).where(and(eq(publications.id, id), eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).get()?.publication;
    if (!row) throw new ApplicationError('NOT_FOUND', '게시 설정이 삭제되었거나 다른 서버에 속합니다.'); return row;
  }
  private template(guildId: string, id: number) {
    const row = this.db.select({ template: templates }).from(templates).innerJoin(organizations, eq(organizations.id, templates.organizationId)).where(and(eq(templates.id, id), eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).get()?.template;
    if (!row) throw new ApplicationError('NOT_FOUND', '템플릿이 삭제되었거나 다른 서버에 속합니다.'); return row;
  }
  private audit(guildId: string, userId: string, organizationId: number | null, action: string, metadata: Record<string, unknown> = {}) {
    this.db.insert(auditLogs).values({ guildId, actorUserId: userId, organizationId, action, metadata }).run();
  }
  private refreshOrganization(organizationId: number) {
    for (const row of this.db.select({ id: publications.id }).from(publications).where(and(eq(publications.organizationId, organizationId), eq(publications.autoRefresh, true))).all()) this.queue.enqueue(row.id);
  }

  private orgPanel(org: typeof organizations.$inferSelect, owner: string) {
    const active = this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'active'))).get();
    return organizationPanel(org, owner, {
      roles: this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, org.id)).all().length,
      classifications: this.db.select().from(classifications).where(eq(classifications.organizationId, org.id)).all().length,
      fields: this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.organizationId, org.id)).all().length,
      publications: this.db.select().from(publications).where(eq(publications.organizationId, org.id)).all().length,
      ...(active ? { term: active.displayName } : {})
    });
  }

  private async handleOrg(i: ChatInputCommandInteraction<'cached'>, sub: string) {
    if (sub === 'create') {
      const org = this.organizations.create({ guildId: i.guildId, actorUserId: i.user.id, name: i.options.getString('name', true), key: i.options.getString('key', true), description: i.options.getString('description') });
      await i.reply({ ...this.orgPanel(org, i.user.id), ephemeral: true }); return;
    }
    if (sub === 'manage') { const org = this.organization(i.guildId, i.options.getString('organization', true)); await i.reply({ ...this.orgPanel(org, i.user.id), ephemeral: true }); return; }
    const rows = this.organizations.list(i.guildId); const page = pageOf(rows, 0, 5);
    const embeds = [new EmbedBuilder().setTitle('조직 목록').setDescription(page.items.length ? page.items.map((org) => {
      const active = this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'active'))).get();
      const roles = this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, org.id)).all().length;
      const pubs = this.db.select().from(publications).where(eq(publications.organizationId, org.id)).all();
      return `**${org.name}** (\`${org.key}\`) · 임기 ${active?.displayName ?? '없음'} · 역할 ${roles} · 게시물 ${pubs.length} · ${pubs.some((p) => p.broken) ? '⚠️ 점검 필요' : '✅ 정상'}`;
    }).join('\n') : '등록된 조직이 없습니다.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지` })];
    const components = page.items.map((org) => new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'open', org.id, i.user.id)).setLabel(`${org.name} 관리`).setStyle(ButtonStyle.Primary)));
    await i.reply({ embeds, components, ephemeral: true });
  }

  private parseDate(value: string | null, fallback = new Date()): Date {
    if (!value) return fallback; const result = new Date(value); if (Number.isNaN(result.getTime())) throw new ApplicationError('VALIDATION_ERROR', '날짜는 ISO 8601 형식이어야 합니다.'); return result;
  }
  private currentTerm(orgId: number) { return this.db.select().from(terms).where(and(eq(terms.organizationId, orgId), eq(terms.status, 'active'))).get(); }
  private async handleTerm(i: ChatInputCommandInteraction<'cached'>, sub: string) {
    const org = this.organization(i.guildId, i.options.getString('organization', true));
    if (sub === 'start') {
      const current = this.currentTerm(org.id); assertCanStartTerm(current ? 1 : 0, false);
      const startAt = this.parseDate(i.options.getString('start_at')); const endValue = i.options.getString('scheduled_end_at'); const scheduledEndAt = endValue ? this.parseDate(endValue) : null;
      const term = this.db.insert(terms).values({ organizationId: org.id, displayName: i.options.getString('name', true), startAt, scheduledEndAt, status: startAt > new Date() ? 'scheduled' : 'active' }).returning().get();
      this.audit(i.guildId, i.user.id, org.id, 'term.started', { termId: term.id }); await i.reply({ ...termPanel(org.name, org.id, term, i.user.id), ephemeral: true }); return;
    }
    if (sub === 'manage') { await i.reply({ ...termPanel(org.name, org.id, this.currentTerm(org.id), i.user.id), ephemeral: true }); return; }
    const history = pageOf(this.db.select().from(terms).where(eq(terms.organizationId, org.id)).orderBy(asc(terms.startAt)).all().reverse(), 0);
    await i.reply({ embeds: [new EmbedBuilder().setTitle(`${org.name} 임기 기록`).setDescription(history.items.length ? history.items.map((term) => `**${term.displayName}** · #${term.termNumber ?? '-'} · ${term.startAt.toISOString()} → ${term.actualEndAt?.toISOString() ?? term.scheduledEndAt?.toISOString() ?? '-'} · ${term.status}`).join('\n') : '임기 기록이 없습니다.').setFooter({ text: `${history.page + 1}/${history.pages} 페이지` })], ephemeral: true });
  }

  private async handleTemplate(i: ChatInputCommandInteraction<'cached'>, sub: string) {
    if (sub === 'create') {
      const org = this.organization(i.guildId, i.options.getString('organization', true)); const name = i.options.getString('name', true);
      const file = i.options.getAttachment('file');
      if (file) {
        if (!file.name.toLowerCase().endsWith('.txt') || file.size > 100_000) throw new ApplicationError('VALIDATION_ERROR', 'UTF-8 .txt 파일은 최대 100KB까지 가져올 수 있습니다.');
        const response = await fetch(file.url); if (!response.ok) throw new ApplicationError('VALIDATION_ERROR', '첨부 파일을 내려받을 수 없습니다.'); const bytes = new Uint8Array(await response.arrayBuffer());
        let content: string; try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new ApplicationError('VALIDATION_ERROR', '파일이 올바른 UTF-8 텍스트가 아닙니다.'); }
        this.renderer.validate(content); const tpl = this.db.insert(templates).values({ organizationId: org.id, name, content, isDraft: false }).returning().get(); this.audit(i.guildId, i.user.id, org.id, 'template.created', { templateId: tpl.id, source: 'attachment' });
        await i.reply({ ...templatePanel(tpl, org.name, i.user.id), ephemeral: true }); return;
      }
      const target = `${org.id}-${Buffer.from(name).toString('base64url').slice(0, 16)}`;
      this.db.insert(setupSessions).values({ id: `tpl-${randomUUID()}`, guildId: i.guildId, userId: i.user.id, kind: 'template_create', state: { organizationId: org.id, name, token: target }, expiresAt: new Date(Date.now() + 15 * 60_000) }).run();
      const b = (label: string, action: string) => new ButtonBuilder().setCustomId(customId('tpl', action, target, i.user.id)).setLabel(label).setStyle(action === 'cancel' ? ButtonStyle.Secondary : ButtonStyle.Primary);
      await i.reply({ content: `**${name}** 템플릿의 입력 방식을 선택하세요.`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(b('직접 입력', 'create'), b('파일 가져오기', 'import'), b('기존 템플릿 복제', 'copy'), b('취소', 'cancel'))], ephemeral: true }); return;
    }
    const tpl = this.template(i.guildId, Number(i.options.getString('template', true)));
    if (sub === 'manage') { const org = this.organizationById(i.guildId, tpl.organizationId); await i.reply({ ...templatePanel(tpl, org.name, i.user.id), ephemeral: true }); return; }
    await i.deferReply({ ephemeral: true }); await i.editReply(await this.previewTemplate(i, tpl));
  }

  private async previewTemplate(i: { guild: NonNullable<ChatInputCommandInteraction<'cached'>['guild']> }, tpl: typeof templates.$inferSelect) {
    try { const built = await new ContextBuilder(this.db).build(tpl.organizationId, i.guild); const output = await this.renderer.render(tpl.content, built.context, { timeZone: built.timeZone, mentions: built.mentions }); return truncateMessage(`**렌더링 결과**\n${output}\n\n**경고**\n없음\n**렌더 오류**\n없음\n**메시지 길이**\n${output.length}/2000`); }
    catch (error) { return truncateMessage(`**렌더링 결과**\n없음\n\n**렌더 오류**\n${error instanceof Error ? error.message : String(error)}\n**메시지 길이**\n0/2000`); }
  }

  private async handlePublication(i: ChatInputCommandInteraction<'cached'>, sub: string) {
    if (sub === 'create') {
      const org = this.organization(i.guildId, i.options.getString('organization', true)); const templateKey = i.options.getString('template', true);
      const tpl = /^\d+$/.test(templateKey) ? this.template(i.guildId, Number(templateKey)) : this.db.select().from(templates).where(and(eq(templates.organizationId, org.id), eq(templates.name, templateKey))).get();
      if (!tpl || tpl.organizationId !== org.id || tpl.isDraft) throw new ApplicationError('INVALID_TEMPLATE', '이 조직에서 사용할 수 있는 템플릿을 찾을 수 없습니다.');
      const channel = i.options.getChannel('channel', true); const pub = this.db.insert(publications).values({ organizationId: org.id, templateId: tpl.id, channelId: channel.id, name: i.options.getString('name') ?? `${tpl.name} 게시`, autoRefresh: i.options.getBoolean('auto_refresh') ?? true }).returning().get();
      if (channel.type === ChannelType.GuildForum) this.db.insert(forumPublicationSettings).values({ publicationId: pub.id, titleTemplate: tpl.name, appliedTagIdsJson: [] }).run();
      this.audit(i.guildId, i.user.id, org.id, 'publication.created', { publicationId: pub.id, type: channel.type === ChannelType.GuildForum ? 'forum' : 'message' });
      await i.reply({ ...publicationPanel(pub, i.user.id, channel.type === ChannelType.GuildForum), ephemeral: true }); return;
    }
    const pub = this.publication(i.guildId, Number(i.options.getString('publication', true)));
    if (sub === 'refresh') { await i.deferReply({ ephemeral: true }); const result = await this.publicationService.refresh(pub.id); const fresh = this.publication(i.guildId, pub.id); await i.editReply(`✅ 갱신했습니다. ${fresh.messageId ? `메시지: ${fresh.messageId}` : ''}${this.diagnosticsText(result.diagnostics)}`); return; }
    const forum = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, pub.id)).get();
    await i.reply({ ...publicationPanel(pub, i.user.id, Boolean(forum), forum?.threadId), ephemeral: true });
  }

  private async handleDiagnose(i: ChatInputCommandInteraction<'cached'>) {
    const scope = i.options.getString('scope', true); const target = i.options.getString('target'); const findings: string[] = [];
    let orgs = this.organizations.list(i.guildId);
    if (scope === 'organization') { if (!target) throw new ApplicationError('VALIDATION_ERROR', 'organization 범위에는 target 조직 키가 필요합니다.'); orgs = [this.organization(i.guildId, target)]; }
    if (scope === 'publication') {
      if (!target) throw new ApplicationError('VALIDATION_ERROR', 'publication 범위에는 target 게시 설정 ID가 필요합니다.'); const pub = this.publication(i.guildId, Number(target)); orgs = [this.organizationById(i.guildId, pub.organizationId)];
    }
    for (const org of orgs) {
      for (const role of this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, org.id)).all()) if (!i.guild.roles.cache.has(role.discordRoleId)) findings.push(`[DELETED_DISCORD_ROLE] ${org.name}: ${role.displayName}`);
      for (const option of this.db.select({ option: classificationOptions }).from(classificationOptions).innerJoin(classifications, eq(classifications.id, classificationOptions.classificationId)).where(eq(classifications.organizationId, org.id)).all()) if (!i.guild.roles.cache.has(option.option.discordRoleId)) findings.push(`[INVALID_CLASSIFICATION_MAPPING] ${org.name}: ${option.option.displayName}`);
      for (const pub of this.db.select().from(publications).where(eq(publications.organizationId, org.id)).all()) {
        if (!i.guild.channels.cache.has(pub.channelId)) findings.push(`[MISSING_CHANNEL] ${pub.name}`);
        if (pub.broken || pub.lastRenderError) findings.push(`[PUBLICATION_REFRESH_FAILURE] ${pub.name}: ${pub.lastRenderError ?? '오류 상태'}`);
        const forum = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, pub.id)).get();
        if (forum?.threadId && !i.guild.channels.cache.has(forum.threadId)) findings.push(`[FORUM_THREAD_MISSING] ${pub.name}`);
      }
    }
    await i.reply({ embeds: [new EmbedBuilder().setTitle('통합 진단').setDescription(truncateMessage(findings.length ? findings.join('\n') : '✅ 발견된 문제가 없습니다.'))], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('diag', 'rerun', scope === 'guild' ? 'guild' : target!, i.user.id)).setLabel('진단 다시 실행').setStyle(ButtonStyle.Primary))], ephemeral: true });
  }

  private async handleHelp(i: ChatInputCommandInteraction<'cached'>) {
    const actions = [['조직 만들기', 'org'], ['역할 연결하기', 'roles'], ['임기 시작하기', 'term'], ['양식 만들기', 'template'], ['게시물 만들기', 'publication'], ['문제 해결', 'diagnose']] as const;
    await i.reply({ embeds: [new EmbedBuilder().setTitle('무엇을 하시겠어요?').setDescription('세부 설정은 명령을 여러 번 입력하지 않고 관리 패널에서 진행합니다.')], components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(...actions.slice(0, 5).map(([label, action]) => new ButtonBuilder().setCustomId(customId('help', action, 'guide', i.user.id)).setLabel(label).setStyle(ButtonStyle.Primary))),
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('help', 'diagnose', 'guide', i.user.id)).setLabel('문제 해결').setStyle(ButtonStyle.Secondary))
    ], ephemeral: true });
  }

  private async handleButton(i: ButtonInteraction<'cached'>, p: ParsedCustomId) {
    if (p.area === 'help') { const guides: Record<string, string> = { org: '`/org create`로 조직을 만든 뒤 열린 패널에서 설정하세요.', roles: '`/org manage` → **역할**에서 Discord 역할을 연결하세요.', term: '`/term start`로 시작하고 `/term manage`에서 상태를 관리하세요.', template: '`/template create`에서 직접 입력·파일·복제를 선택하세요.', publication: '`/publication create`에서 채널을 선택한 뒤 미리보기하고 게시하세요.', diagnose: '`/diagnose`에서 범위와 대상을 선택하세요.' }; await i.reply({ content: guides[p.action] ?? '도움말 항목을 찾을 수 없습니다.', ephemeral: true }); return; }
    if (p.area === 'org') return this.orgButton(i, p);
    if (p.area === 'term') return this.termButton(i, p);
    if (p.area === 'tpl') return this.templateButton(i, p);
    if (p.area === 'pub') return this.publicationButton(i, p);
    await i.reply({ content: '진단 결과가 오래되었습니다. `/diagnose`를 다시 실행하세요.', ephemeral: true });
  }

  private async orgButton(i: ButtonInteraction<'cached'>, p: ParsedCustomId) {
    if (['roledelete', 'roleeditmodal', 'rolereordermodal'].includes(p.action)) throw new ApplicationError('VALIDATION_ERROR', '입력 화면을 다시 열어 주세요.');
    if (p.action === 'roledeleteyes') { const binding = this.db.select().from(roleBindings).where(eq(roleBindings.id, Number(p.target))).get(); if (!binding) throw new ApplicationError('NOT_FOUND', '역할 연결이 이미 삭제되었습니다.'); const org = this.organizationById(i.guildId, binding.organizationId); this.db.delete(roleBindings).where(eq(roleBindings.id, binding.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'role_binding.deleted', { bindingId: binding.id }); this.refreshOrganization(org.id); await i.update({ content: '역할 연결을 제거했습니다. Discord 역할은 그대로 유지됩니다.', components: [] }); return; }
    if (p.action === 'optionadd') { const classification = this.db.select().from(classifications).where(eq(classifications.id, Number(p.target))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); this.organizationById(i.guildId, classification.organizationId); await i.reply({ content: '분류 선택지에 매핑할 Discord 역할을 선택하세요.', components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(customId('org', 'optionrole', classification.id, i.user.id)).setPlaceholder('Discord 역할'))], ephemeral: true }); return; }
    if (p.action === 'optiondeleteyes') { const option = this.db.select().from(classificationOptions).where(eq(classificationOptions.id, Number(p.target))).get(); if (!option) throw new ApplicationError('NOT_FOUND', '선택지가 이미 삭제되었습니다.'); const classification = this.db.select().from(classifications).where(eq(classifications.id, option.classificationId)).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); const org = this.organizationById(i.guildId, classification.organizationId); this.db.delete(classificationOptions).where(eq(classificationOptions.id, option.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'classification_option.deleted', { optionId: option.id }); this.refreshOrganization(org.id); await i.update({ content: '분류 선택지를 삭제했습니다.', components: [] }); return; }
    if (['optionedit', 'optionremove', 'optionreorder'].includes(p.action)) { const classification = this.db.select().from(classifications).where(eq(classifications.id, Number(p.target))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); this.organizationById(i.guildId, classification.organizationId); const rows = this.db.select().from(classificationOptions).where(eq(classificationOptions.classificationId, classification.id)).orderBy(asc(classificationOptions.displayOrder)).all().slice(0, 25); if (!rows.length) throw new ApplicationError('NOT_FOUND', '관리할 선택지가 없습니다.'); await i.reply({ content: '대상 선택지를 고르세요.', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId('org', `${p.action}selected`, classification.id, i.user.id)).addOptions(rows.map((row) => new StringSelectMenuOptionBuilder().setLabel(row.displayName.slice(0, 100)).setValue(String(row.id)))))], ephemeral: true }); return; }
    const org = this.organizationById(i.guildId, Number(p.target));
    if (p.action === 'open') { await i.update(this.orgPanel(org, i.user.id)); return; }
    if (p.action === 'roles') {
      const roles = this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, org.id)).orderBy(asc(roleBindings.displayOrder)).all();
      await i.update({ content: `**${org.name} · 역할**\n${roles.length ? roles.map((r) => `• ${r.displayName} (<@&${r.discordRoleId}>) · ${r.kind}/${r.cardinality}${r.required ? ' · 필수' : ''}`).join('\n') : '연결된 역할이 없습니다.'}`, embeds: [], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'roleadd', org.id, i.user.id)).setLabel('추가').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(customId('org', 'roleedit', org.id, i.user.id)).setLabel('편집').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(customId('org', 'roleremove', org.id, i.user.id)).setLabel('제거').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(customId('org', 'rolereorder', org.id, i.user.id)).setLabel('순서 변경').setStyle(ButtonStyle.Secondary))] }); return;
    }
    if (p.action === 'roleadd') { await i.reply({ content: '연결할 Discord 역할을 선택하세요.', components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(customId('org', 'roleselected', org.id, i.user.id)).setPlaceholder('Discord 역할'))], ephemeral: true }); return; }
    if (['roleedit', 'roleremove', 'rolereorder'].includes(p.action)) {
      const rows = this.db.select().from(roleBindings).where(eq(roleBindings.organizationId, org.id)).orderBy(asc(roleBindings.displayOrder)).all().slice(0, 25); if (!rows.length) throw new ApplicationError('NOT_FOUND', '관리할 역할 연결이 없습니다.');
      await i.reply({ content: '대상 역할 연결을 선택하세요.', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId('org', `${p.action}selected`, org.id, i.user.id)).addOptions(rows.map((row) => new StringSelectMenuOptionBuilder().setLabel(row.displayName.slice(0, 100)).setDescription(`${row.kind}/${row.cardinality} · 순서 ${row.displayOrder}`).setValue(String(row.id)))))], ephemeral: true }); return;
    }
    if (p.action === 'classes') {
      const rows = pageOf(this.db.select().from(classifications).where(eq(classifications.organizationId, org.id)).orderBy(asc(classifications.displayOrder)).all(), 0);
      await i.reply({ content: `**${org.name} · 분류**\n${rows.items.length ? rows.items.map((row) => `• ${row.displayName} (\`${row.key}\`)`).join('\n') : '분류가 없습니다.'}`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'classcreate', org.id, i.user.id)).setLabel('분류 만들기').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(customId('org', 'options', org.id, i.user.id)).setLabel('선택지 관리').setStyle(ButtonStyle.Secondary))], ephemeral: true }); return;
    }
    if (p.action === 'classcreate') { const fields = [new TextInputBuilder().setCustomId('key').setLabel('분류 키').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('name').setLabel('표시 이름').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('base').setLabel('기준 역할 연결 키').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('settings').setLabel('exclusive, allow_unassigned').setPlaceholder('true, true').setStyle(TextInputStyle.Short).setRequired(true)]; await i.showModal(new ModalBuilder().setCustomId(customId('org', 'classmodal', org.id, i.user.id)).setTitle('분류 만들기').addComponents(...fields.map((field) => new ActionRowBuilder<TextInputBuilder>().addComponents(field)))); return; }
    if (p.action === 'options') { const rows = this.db.select().from(classifications).where(eq(classifications.organizationId, org.id)).all().slice(0, 25); if (!rows.length) throw new ApplicationError('NOT_FOUND', '먼저 분류를 만들어 주세요.'); await i.reply({ content: '선택지를 관리할 분류를 고르세요.', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId('org', 'classselected', org.id, i.user.id)).addOptions(rows.map((row) => new StringSelectMenuOptionBuilder().setLabel(row.displayName.slice(0, 100)).setValue(String(row.id)))))], ephemeral: true }); return; }
    if (p.action === 'fields') {
      const rows = pageOf(this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.organizationId, org.id)).orderBy(asc(customFieldDefinitions.displayOrder)).all(), 0);
      await i.reply({ content: `**${org.name} · 사용자 정의 필드**\n${rows.items.length ? rows.items.map((row) => `• ${row.label} (\`${row.key}\`) · ${row.scope}/${row.type}`).join('\n') : '필드가 없습니다.'}`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'fieldcreate', org.id, i.user.id)).setLabel('필드 만들기').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(customId('org', 'fieldset', org.id, i.user.id)).setLabel('값 설정·지우기').setStyle(ButtonStyle.Secondary))], ephemeral: true }); return;
    }
    if (p.action === 'fieldcreate') { const fields = [new TextInputBuilder().setCustomId('key').setLabel('필드 키').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('label').setLabel('표시 이름').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('scope').setLabel('범위: organization | term').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('type').setLabel('필드 형식').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('settings').setLabel('필수, 순서, select 값(선택)').setPlaceholder('false, 0, 값1|값2').setStyle(TextInputStyle.Short).setRequired(true)]; await i.showModal(new ModalBuilder().setCustomId(customId('org', 'fieldmodal', org.id, i.user.id)).setTitle('사용자 정의 필드 만들기').addComponents(...fields.map((field) => new ActionRowBuilder<TextInputBuilder>().addComponents(field)))); return; }
    if (p.action === 'fieldset') { const fields = this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.organizationId, org.id)).orderBy(asc(customFieldDefinitions.displayOrder)).all().slice(0, 25); if (!fields.length) throw new ApplicationError('NOT_FOUND', '값을 설정할 필드가 없습니다.'); await i.reply({ content: '값을 설정하거나 지울 필드를 선택하세요.', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId('org', 'fieldselected', org.id, i.user.id)).addOptions(fields.map((field) => new StringSelectMenuOptionBuilder().setLabel(field.label.slice(0, 100)).setDescription(`${field.scope}/${field.type}`).setValue(String(field.id)))))], ephemeral: true }); return; }
    if (p.action === 'publications') { const rows = pageOf(this.db.select().from(publications).where(eq(publications.organizationId, org.id)).all(), 0); await i.reply({ content: `**${org.name} · 게시물**\n${rows.items.length ? rows.items.map((row) => `• #${row.id} ${row.name} · ${row.messageId ? '게시됨' : '초안'}`).join('\n') : '게시 설정이 없습니다.'}`, ephemeral: true }); return; }
    if (p.action === 'term') { await i.reply({ ...termPanel(org.name, org.id, this.currentTerm(org.id), i.user.id), ephemeral: true }); return; }
    if (p.action === 'delete') { await i.update({ content: `**${org.name}** 조직을 삭제할까요? 관련 설정에 영향을 줍니다.`, embeds: [], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'deleteyes', org.id, i.user.id)).setLabel('삭제 확인').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(customId('org', 'open', org.id, i.user.id)).setLabel('취소').setStyle(ButtonStyle.Secondary))] }); return; }
    if (p.action === 'deleteyes') { this.db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, org.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'organization.deleted'); await i.update({ content: '조직을 삭제했습니다.', embeds: [], components: [] }); return; }
    await i.reply({ content: '이 관리 작업은 현재 패널에서 선택 항목을 먼저 지정해야 합니다.', ephemeral: true });
  }

  private async handleRoleSelect(i: RoleSelectMenuInteraction<'cached'>, p: ParsedCustomId) {
    if (p.area === 'org' && p.action === 'optionrole') { const classification = this.db.select().from(classifications).where(eq(classifications.id, Number(p.target))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); this.organizationById(i.guildId, classification.organizationId); const sessionId = `o${randomUUID().replaceAll('-', '').slice(0, 23)}`; this.db.insert(setupSessions).values({ id: sessionId, guildId: i.guildId, userId: i.user.id, kind: 'classification_option_add', state: { classificationId: classification.id, discordRoleId: i.values[0] }, expiresAt: new Date(Date.now() + 10 * 60_000) }).run(); const inputs = [new TextInputBuilder().setCustomId('key').setLabel('선택지 키').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('name').setLabel('표시 이름').setStyle(TextInputStyle.Short).setRequired(true), new TextInputBuilder().setCustomId('order').setLabel('표시 순서').setStyle(TextInputStyle.Short).setValue('0').setRequired(true)]; await i.showModal(new ModalBuilder().setCustomId(customId('org', 'optionmodal', sessionId, i.user.id)).setTitle('분류 선택지 추가').addComponents(...inputs.map((input) => new ActionRowBuilder<TextInputBuilder>().addComponents(input)))); return; }
    if (p.area !== 'org' || p.action !== 'roleselected') throw new ApplicationError('VALIDATION_ERROR', '잘못된 역할 선택입니다.'); const org = this.organizationById(i.guildId, Number(p.target));
    const sessionId = `r${randomUUID().replaceAll('-', '').slice(0, 23)}`; this.db.insert(setupSessions).values({ id: sessionId, guildId: i.guildId, userId: i.user.id, kind: 'role_add', state: { organizationId: org.id, discordRoleId: i.values[0] }, expiresAt: new Date(Date.now() + 10 * 60_000) }).run();
    const inputs = [
      new TextInputBuilder().setCustomId('key').setLabel('내부 키').setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId('name').setLabel('표시 이름').setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId('settings').setLabel('종류, 개수, 필수, 순서').setPlaceholder('office, one, true, 0').setStyle(TextInputStyle.Short).setRequired(true)
    ];
    await i.showModal(new ModalBuilder().setCustomId(customId('org', 'roleaddmodal', sessionId, i.user.id)).setTitle('역할 연결 추가').addComponents(...inputs.map((x) => new ActionRowBuilder<TextInputBuilder>().addComponents(x))));
  }
  private async handleStringSelect(i: StringSelectMenuInteraction<'cached'>, p: ParsedCustomId) {
    if (p.area === 'org' && ['roleeditselected', 'roleremoveselected', 'rolereorderselected'].includes(p.action)) {
      const org = this.organizationById(i.guildId, Number(p.target)); const binding = this.db.select().from(roleBindings).where(and(eq(roleBindings.id, Number(i.values[0])), eq(roleBindings.organizationId, org.id))).get(); if (!binding) throw new ApplicationError('NOT_FOUND', '역할 연결이 삭제되었습니다.');
      if (p.action === 'roleremoveselected') { await i.update({ content: `**${binding.displayName}** 역할 연결을 제거할까요? Discord 역할 자체는 삭제하지 않습니다.`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'roledeleteyes', binding.id, i.user.id)).setLabel('제거 확인').setStyle(ButtonStyle.Danger))] }); return; }
      const action = p.action === 'roleeditselected' ? 'roleeditmodal' : 'rolereordermodal'; const inputs = p.action === 'roleeditselected' ? [new TextInputBuilder().setCustomId('name').setLabel('표시 이름').setStyle(TextInputStyle.Short).setValue(binding.displayName).setRequired(true), new TextInputBuilder().setCustomId('order').setLabel('표시 순서').setStyle(TextInputStyle.Short).setValue(String(binding.displayOrder)).setRequired(true)] : [new TextInputBuilder().setCustomId('order').setLabel('새 표시 순서').setStyle(TextInputStyle.Short).setValue(String(binding.displayOrder)).setRequired(true)];
      await i.showModal(new ModalBuilder().setCustomId(customId('org', action, binding.id, i.user.id)).setTitle(p.action === 'roleeditselected' ? '역할 연결 편집' : '역할 순서 변경').addComponents(...inputs.map((input) => new ActionRowBuilder<TextInputBuilder>().addComponents(input)))); return;
    }
    if (p.area === 'org' && p.action === 'fieldselected') { const org = this.organizationById(i.guildId, Number(p.target)); const definition = this.db.select().from(customFieldDefinitions).where(and(eq(customFieldDefinitions.id, Number(i.values[0])), eq(customFieldDefinitions.organizationId, org.id))).get(); if (!definition) throw new ApplicationError('NOT_FOUND', '필드가 삭제되었습니다.'); const current = definition.scope === 'term' ? this.currentTerm(org.id) : undefined; if (definition.scope === 'term' && !current) throw new ApplicationError('VALIDATION_ERROR', '현재 임기가 없어 임기 필드 값을 설정할 수 없습니다.'); const input = new TextInputBuilder().setCustomId('value').setLabel(`${definition.label} (${definition.type})`.slice(0, 45)).setStyle(definition.type === 'multiline_text' ? TextInputStyle.Paragraph : TextInputStyle.Short).setPlaceholder('비워서 제출하면 값을 지웁니다.').setRequired(false).setMaxLength(definition.type === 'multiline_text' ? 4000 : 1000); await i.showModal(new ModalBuilder().setCustomId(customId('org', 'fieldvaluemodal', definition.id, i.user.id)).setTitle('필드 값 설정·지우기').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))); return; }
    if (p.area === 'org' && p.action === 'classselected') { const org = this.organizationById(i.guildId, Number(p.target)); const classification = this.db.select().from(classifications).where(and(eq(classifications.id, Number(i.values[0])), eq(classifications.organizationId, org.id))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); const rows = pageOf(this.db.select().from(classificationOptions).where(eq(classificationOptions.classificationId, classification.id)).orderBy(asc(classificationOptions.displayOrder)).all(), 0); const button = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(customId('org', action, classification.id, i.user.id)).setLabel(label).setStyle(style); await i.update({ content: `**${classification.displayName} · 선택지**\n${rows.items.length ? rows.items.map((row) => `• ${row.displayName} (<@&${row.discordRoleId}>) · 순서 ${row.displayOrder}`).join('\n') : '선택지가 없습니다.'}`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button('추가', 'optionadd', ButtonStyle.Primary), button('편집', 'optionedit'), button('삭제', 'optionremove', ButtonStyle.Danger), button('순서 변경', 'optionreorder'))] }); return; }
    if (p.area === 'org' && ['optioneditselected', 'optionremoveselected', 'optionreorderselected'].includes(p.action)) { const classification = this.db.select().from(classifications).where(eq(classifications.id, Number(p.target))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); this.organizationById(i.guildId, classification.organizationId); const option = this.db.select().from(classificationOptions).where(and(eq(classificationOptions.id, Number(i.values[0])), eq(classificationOptions.classificationId, classification.id))).get(); if (!option) throw new ApplicationError('NOT_FOUND', '선택지가 삭제되었습니다.'); if (p.action === 'optionremoveselected') { await i.update({ content: `**${option.displayName}** 선택지를 삭제할까요?`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('org', 'optiondeleteyes', option.id, i.user.id)).setLabel('삭제 확인').setStyle(ButtonStyle.Danger))] }); return; } const action = p.action === 'optioneditselected' ? 'optioneditmodal' : 'optionreordermodal'; const inputs = p.action === 'optioneditselected' ? [new TextInputBuilder().setCustomId('name').setLabel('표시 이름').setStyle(TextInputStyle.Short).setValue(option.displayName).setRequired(true), new TextInputBuilder().setCustomId('order').setLabel('표시 순서').setStyle(TextInputStyle.Short).setValue(String(option.displayOrder)).setRequired(true)] : [new TextInputBuilder().setCustomId('order').setLabel('표시 순서').setStyle(TextInputStyle.Short).setValue(String(option.displayOrder)).setRequired(true)]; await i.showModal(new ModalBuilder().setCustomId(customId('org', action, option.id, i.user.id)).setTitle('분류 선택지 편집').addComponents(...inputs.map((input) => new ActionRowBuilder<TextInputBuilder>().addComponents(input)))); return; }
    if (p.area === 'tpl' && p.action === 'copyselected') {
      const session = this.templateSession(i.guildId, i.user.id, p.target); const source = this.template(i.guildId, Number(i.values[0])); const orgId = Number(session.state.organizationId);
      if (source.organizationId !== orgId) throw new ApplicationError('MISSING_PERMISSION', '다른 조직의 템플릿은 이 흐름에서 복제할 수 없습니다.');
      const copy = this.db.insert(templates).values({ organizationId: orgId, name: String(session.state.name), content: source.content, isDraft: true }).returning().get();
      this.db.delete(setupSessions).where(eq(setupSessions.id, session.id)).run(); this.audit(i.guildId, i.user.id, orgId, 'template.duplicated', { sourceId: source.id, templateId: copy.id });
      await i.update({ ...templatePanel(copy, this.organizationById(i.guildId, orgId).name, i.user.id), content: '기존 템플릿을 초안으로 복제했습니다.' }); return;
    }
    if (p.area === 'pub' && p.action === 'tagsselected') { const pub = this.publication(i.guildId, Number(p.target)); const settings = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, pub.id)).get(); if (!settings) throw new ApplicationError('VALIDATION_ERROR', '포럼 게시 설정이 아닙니다.'); this.db.update(forumPublicationSettings).set({ appliedTagIdsJson: i.values.slice(0, 5) }).where(eq(forumPublicationSettings.publicationId, pub.id)).run(); await i.update({ content: `태그 ID ${i.values.join(', ') || '없음'}을 저장했습니다.`, components: [] }); return; }
    throw new ApplicationError('VALIDATION_ERROR', '잘못된 선택 메뉴입니다.');
  }

  private async organizationModal(i: ModalSubmitInteraction<'cached'>, p: ParsedCustomId) {
    if (p.action === 'optioneditmodal' || p.action === 'optionreordermodal') { const option = this.db.select().from(classificationOptions).where(eq(classificationOptions.id, Number(p.target))).get(); if (!option) throw new ApplicationError('NOT_FOUND', '선택지가 삭제되었습니다.'); const classification = this.db.select().from(classifications).where(eq(classifications.id, option.classificationId)).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); const org = this.organizationById(i.guildId, classification.organizationId); const displayOrder = Number(i.fields.getTextInputValue('order')); if (!Number.isInteger(displayOrder)) throw new ApplicationError('VALIDATION_ERROR', '표시 순서는 정수여야 합니다.'); this.db.update(classificationOptions).set({ displayOrder, ...(p.action === 'optioneditmodal' ? { displayName: i.fields.getTextInputValue('name') } : {}) }).where(eq(classificationOptions.id, option.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'classification_option.updated', { optionId: option.id }); this.refreshOrganization(org.id); await i.reply({ content: '분류 선택지를 수정했습니다.', ephemeral: true }); return; }
    if (p.action === 'optionmodal') { const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, p.target)).get(); if (!session || session.kind !== 'classification_option_add' || session.userId !== i.user.id || session.guildId !== i.guildId || session.expiresAt <= new Date()) throw new ApplicationError('VALIDATION_ERROR', '선택지 추가 화면이 만료되었습니다.'); const classification = this.db.select().from(classifications).where(eq(classifications.id, Number(session.state.classificationId))).get(); if (!classification) throw new ApplicationError('NOT_FOUND', '분류가 삭제되었습니다.'); const org = this.organizationById(i.guildId, classification.organizationId); const row = this.db.insert(classificationOptions).values({ classificationId: classification.id, key: i.fields.getTextInputValue('key'), displayName: i.fields.getTextInputValue('name'), discordRoleId: String(session.state.discordRoleId), displayOrder: Number(i.fields.getTextInputValue('order')) || 0 }).returning().get(); this.db.delete(setupSessions).where(eq(setupSessions.id, session.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'classification_option.created', { optionId: row.id, discordRoleId: row.discordRoleId }); this.refreshOrganization(org.id); await i.reply({ content: `선택지 **${row.displayName}**을 Discord 역할 ID로 매핑했습니다.`, ephemeral: true }); return; }
    if (p.action === 'fieldvaluemodal') { const definition = this.db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.id, Number(p.target))).get(); if (!definition) throw new ApplicationError('NOT_FOUND', '필드가 삭제되었습니다.'); const org = this.organizationById(i.guildId, definition.organizationId); const term = definition.scope === 'term' ? this.currentTerm(org.id) : undefined; if (definition.scope === 'term' && !term) throw new ApplicationError('VALIDATION_ERROR', '현재 임기가 없습니다.'); const condition = and(eq(customFieldValues.definitionId, definition.id), definition.scope === 'term' ? eq(customFieldValues.termId, term!.id) : and(eq(customFieldValues.organizationId, org.id), isNull(customFieldValues.termId))); const existing = this.db.select().from(customFieldValues).where(condition).get(); const raw = i.fields.getTextInputValue('value'); if (!raw.trim()) { if (definition.required) throw new ApplicationError('INVALID_FIELD_VALUE', '필수 필드는 지울 수 없습니다.'); if (existing) this.db.delete(customFieldValues).where(eq(customFieldValues.id, existing.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'field.value_cleared', { definitionId: definition.id, termId: term?.id }); this.refreshOrganization(org.id); await i.reply({ content: `**${definition.label}** 값을 지웠습니다.`, ephemeral: true }); return; } const value = validateFieldValue(definition, raw); if (value === null) throw new ApplicationError('INVALID_FIELD_VALUE', '유효한 필드 값이 필요합니다.'); if (existing) this.db.update(customFieldValues).set({ value }).where(eq(customFieldValues.id, existing.id)).run(); else this.db.insert(customFieldValues).values({ definitionId: definition.id, organizationId: org.id, termId: term?.id ?? null, value }).run(); this.audit(i.guildId, i.user.id, org.id, 'field.value_set', { definitionId: definition.id, termId: term?.id }); this.refreshOrganization(org.id); await i.reply({ content: `**${definition.label}** 값을 저장했습니다.`, ephemeral: true }); return; }
    if (p.action === 'roleeditmodal' || p.action === 'rolereordermodal') { const binding = this.db.select().from(roleBindings).where(eq(roleBindings.id, Number(p.target))).get(); if (!binding) throw new ApplicationError('NOT_FOUND', '역할 연결이 삭제되었습니다.'); const org = this.organizationById(i.guildId, binding.organizationId); const displayOrder = Number(i.fields.getTextInputValue('order')); if (!Number.isInteger(displayOrder)) throw new ApplicationError('VALIDATION_ERROR', '표시 순서는 정수여야 합니다.'); this.db.update(roleBindings).set({ displayOrder, ...(p.action === 'roleeditmodal' ? { displayName: i.fields.getTextInputValue('name') } : {}) }).where(eq(roleBindings.id, binding.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'role_binding.updated', { bindingId: binding.id }); this.refreshOrganization(org.id); await i.reply({ content: '역할 연결을 수정했습니다.', ephemeral: true }); return; }
    if (p.action === 'classmodal') { const org = this.organizationById(i.guildId, Number(p.target)); const settings = i.fields.getTextInputValue('settings').split(',').map((v) => v.trim().toLowerCase()); const row = this.db.insert(classifications).values({ organizationId: org.id, key: i.fields.getTextInputValue('key'), displayName: i.fields.getTextInputValue('name'), baseRoleKey: i.fields.getTextInputValue('base'), exclusive: settings[0] !== 'false', allowUnassigned: settings[1] !== 'false' }).returning().get(); this.audit(i.guildId, i.user.id, org.id, 'classification.created', { classificationId: row.id }); this.refreshOrganization(org.id); await i.reply({ content: `분류 **${row.displayName}**을 만들었습니다.`, ephemeral: true }); return; }
    if (p.action === 'fieldmodal') { const org = this.organizationById(i.guildId, Number(p.target)); const scope = i.fields.getTextInputValue('scope').trim(); const type = i.fields.getTextInputValue('type').trim(); const validTypes = ['text', 'multiline_text', 'number', 'date', 'datetime', 'boolean', 'select', 'role', 'channel'] as const; if (!['organization', 'term'].includes(scope) || !validTypes.includes(type as typeof validTypes[number])) throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 범위 또는 필드 형식입니다.'); const settings = i.fields.getTextInputValue('settings').split(',').map((v) => v.trim()); const selectOptions = type === 'select' ? (settings[2] ?? '').split('|').map((v) => v.trim()).filter(Boolean) : null; const row = this.db.insert(customFieldDefinitions).values({ organizationId: org.id, key: i.fields.getTextInputValue('key'), label: i.fields.getTextInputValue('label'), scope: scope as 'organization' | 'term', type: type as typeof validTypes[number], required: settings[0]?.toLowerCase() === 'true', displayOrder: Number(settings[1] ?? 0) || 0, selectOptions }).returning().get(); this.audit(i.guildId, i.user.id, org.id, 'field.created', { definitionId: row.id, type: row.type }); this.refreshOrganization(org.id); await i.reply({ content: `**${row.label}** 필드를 ${row.type} 형식으로 만들었습니다.`, ephemeral: true }); return; }
    if (p.action !== 'roleaddmodal') throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 조직 입력입니다.');
    const session = this.db.select().from(setupSessions).where(eq(setupSessions.id, p.target)).get(); if (!session || session.kind !== 'role_add' || session.userId !== i.user.id || session.guildId !== i.guildId || session.expiresAt <= new Date()) throw new ApplicationError('VALIDATION_ERROR', '역할 추가 화면이 만료되었습니다.');
    const org = this.organizationById(i.guildId, Number(session.state.organizationId)); const values = i.fields.getTextInputValue('settings').split(',').map((v) => v.trim().toLowerCase());
    const kind = values[0]; const cardinality = values[1]; if (!['office', 'membership'].includes(kind!) || !['one', 'many'].includes(cardinality!)) throw new ApplicationError('VALIDATION_ERROR', '종류는 office|membership, 개수는 one|many여야 합니다.');
    this.organizations.addRoleBinding({ organizationId: org.id, key: i.fields.getTextInputValue('key'), displayName: i.fields.getTextInputValue('name'), discordRoleId: String(session.state.discordRoleId), kind: kind as 'office' | 'membership', cardinality: cardinality as 'one' | 'many', required: values[2] === 'true', displayOrder: Number(values[3] ?? 0) || 0, guildId: i.guildId, actorUserId: i.user.id });
    this.db.delete(setupSessions).where(eq(setupSessions.id, session.id)).run(); await i.reply({ content: '기존 조직 서비스를 통해 역할 연결을 추가했습니다.', ephemeral: true });
  }

  private async termButton(i: ButtonInteraction<'cached'>, p: ParsedCustomId) {
    const org = this.organizationById(i.guildId, Number(p.target)); const current = p.action === 'resume' ? this.db.select().from(terms).where(and(eq(terms.organizationId, org.id), eq(terms.status, 'suspended'))).get() : this.currentTerm(org.id);
    if (p.action === 'end') { if (!current) throw new ApplicationError('NOT_FOUND', '현재 임기가 없습니다.'); await i.update({ content: `**${current.displayName}** 임기를 종료할까요? 되돌릴 수 없습니다.`, embeds: [], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('term', 'endyes', org.id, i.user.id)).setLabel('종료 확인').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(customId('term', 'history', org.id, i.user.id)).setLabel('취소').setStyle(ButtonStyle.Secondary))] }); return; }
    const targets = { pause: 'suspended', resume: 'active', endyes: 'ended' } as const; const target = targets[p.action as keyof typeof targets];
    if (target) { if (!current) throw new ApplicationError('NOT_FOUND', '전환할 임기가 없습니다.'); assertTermTransition(current.status, target); this.db.update(terms).set({ status: target, actualEndAt: target === 'ended' ? new Date() : current.actualEndAt }).where(and(eq(terms.id, current.id), eq(terms.status, current.status))).run(); this.audit(i.guildId, i.user.id, org.id, `term.${target}`, { termId: current.id }); await i.update({ ...termPanel(org.name, org.id, target === 'active' ? { ...current, status: target } : undefined, i.user.id), content: `임기를 ${target}(으)로 변경했습니다.` }); return; }
    await i.reply({ content: p.action === 'start' ? `새 임기는 \`/term start organization:${org.key}\`로 시작하세요.` : `임기 상세 작업은 \`/term manage organization:${org.key}\`에서 계속할 수 있습니다.`, ephemeral: true });
  }
  private async termModal(_i: ModalSubmitInteraction<'cached'>, _p: ParsedCustomId) { throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 임기 입력입니다.'); }

  private templateSession(guildId: string, userId: string, token: string) {
    const row = this.db.select().from(setupSessions).where(and(eq(setupSessions.guildId, guildId), eq(setupSessions.userId, userId), eq(setupSessions.kind, 'template_create'))).all().find((s) => s.state.token === token && s.expiresAt > new Date());
    if (!row) throw new ApplicationError('VALIDATION_ERROR', '템플릿 생성 화면이 만료되었습니다.'); return row;
  }
  private async templateButton(i: ButtonInteraction<'cached'>, p: ParsedCustomId) {
    if (['create', 'import', 'copy', 'cancel'].includes(p.action)) {
      const session = this.templateSession(i.guildId, i.user.id, p.target); if (p.action === 'cancel') { this.db.delete(setupSessions).where(eq(setupSessions.id, session.id)).run(); await i.update({ content: '템플릿 만들기를 취소했습니다.', components: [] }); return; }
      if (p.action === 'import') { await i.update({ content: 'Discord 모달에는 파일 필드가 없습니다. `/template create`를 다시 열고 선택 입력인 `file`에 UTF-8 .txt 파일(최대 100KB)을 첨부하세요. 이름과 조직 선택은 그대로 사용할 수 있습니다.', components: [] }); return; }
      if (p.action === 'copy') { const candidates = this.db.select().from(templates).where(eq(templates.organizationId, Number(session.state.organizationId))).all().slice(0, 25); if (!candidates.length) throw new ApplicationError('NOT_FOUND', '복제할 기존 템플릿이 없습니다.'); await i.update({ content: '복제할 템플릿을 선택하세요.', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId('tpl', 'copyselected', p.target, i.user.id)).addOptions(candidates.map((t) => new StringSelectMenuOptionBuilder().setLabel(t.name.slice(0, 100)).setValue(String(t.id)))))] }); return; }
      const input = new TextInputBuilder().setCustomId('content').setLabel('Liquid 템플릿 내용').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true); await i.showModal(new ModalBuilder().setCustomId(customId('tpl', 'createmodal', p.target, i.user.id)).setTitle('템플릿 직접 입력').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))); return;
    }
    const tpl = this.template(i.guildId, Number(p.target));
    if (p.action === 'preview') { await i.reply({ content: await this.previewTemplate(i, tpl), ephemeral: true }); return; }
    if (p.action === 'draft') { this.db.update(templates).set({ isDraft: !tpl.isDraft }).where(eq(templates.id, tpl.id)).run(); await i.update(templatePanel({ ...tpl, isDraft: !tpl.isDraft }, this.organizationById(i.guildId, tpl.organizationId).name, i.user.id)); return; }
    if (p.action === 'duplicate') { let name = `${tpl.name} 복사본`; let n = 2; while (this.db.select().from(templates).where(and(eq(templates.organizationId, tpl.organizationId), eq(templates.name, name))).get()) name = `${tpl.name} 복사본 ${n++}`; const copy = this.db.insert(templates).values({ organizationId: tpl.organizationId, name, content: tpl.content, isDraft: true }).returning().get(); this.audit(i.guildId, i.user.id, tpl.organizationId, 'template.duplicated', { sourceId: tpl.id, templateId: copy.id }); await i.reply({ ...templatePanel(copy, this.organizationById(i.guildId, tpl.organizationId).name, i.user.id), ephemeral: true }); return; }
    if (p.action === 'export') { await i.reply({ files: [new AttachmentBuilder(Buffer.from(tpl.content, 'utf8'), { name: `${tpl.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.txt` })], ephemeral: true }); return; }
    if (p.action === 'delete') { await i.update({ content: `**${tpl.name}** 템플릿을 삭제할까요?`, embeds: [], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('tpl', 'deleteyes', tpl.id, i.user.id)).setLabel('삭제 확인').setStyle(ButtonStyle.Danger))] }); return; }
    if (p.action === 'deleteyes') { if (this.db.select().from(publications).where(eq(publications.templateId, tpl.id)).get()) throw new ApplicationError('VALIDATION_ERROR', '게시 설정에서 사용하는 템플릿은 삭제할 수 없습니다.'); this.db.delete(templates).where(eq(templates.id, tpl.id)).run(); await i.update({ content: '템플릿을 삭제했습니다.', embeds: [], components: [] }); return; }
    if (p.action === 'edit') { const input = new TextInputBuilder().setCustomId('content').setLabel('Liquid 템플릿 내용').setStyle(TextInputStyle.Paragraph).setValue(tpl.content.slice(0, 4000)).setMaxLength(4000).setRequired(true); await i.showModal(new ModalBuilder().setCustomId(customId('tpl', 'editmodal', tpl.id, i.user.id)).setTitle('템플릿 편집').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))); return; }
    if (p.action === 'rename') { const input = new TextInputBuilder().setCustomId('name').setLabel('새 템플릿 이름').setStyle(TextInputStyle.Short).setValue(tpl.name).setMaxLength(100).setRequired(true); await i.showModal(new ModalBuilder().setCustomId(customId('tpl', 'renamemodal', tpl.id, i.user.id)).setTitle('템플릿 이름 변경').addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))); return; }
    await i.reply({ content: '이 작업은 선택 메뉴 또는 편집 화면에서 계속됩니다.', ephemeral: true });
  }
  private async templateModal(i: ModalSubmitInteraction<'cached'>, p: ParsedCustomId) {
    if (p.action === 'renamemodal') { const tpl = this.template(i.guildId, Number(p.target)); const name = i.fields.getTextInputValue('name').trim(); if (!name) throw new ApplicationError('VALIDATION_ERROR', '템플릿 이름은 비울 수 없습니다.'); this.db.update(templates).set({ name }).where(eq(templates.id, tpl.id)).run(); this.audit(i.guildId, i.user.id, tpl.organizationId, 'template.renamed', { templateId: tpl.id, name }); await i.reply({ content: '템플릿 이름을 변경했습니다.', ephemeral: true }); return; }
    const content = i.fields.getTextInputValue('content'); this.renderer.validate(content);
    if (p.action === 'createmodal') { const session = this.templateSession(i.guildId, i.user.id, p.target); const org = this.organizationById(i.guildId, Number(session.state.organizationId)); const tpl = this.db.insert(templates).values({ organizationId: org.id, name: String(session.state.name), content, isDraft: false }).returning().get(); this.db.delete(setupSessions).where(eq(setupSessions.id, session.id)).run(); this.audit(i.guildId, i.user.id, org.id, 'template.created', { templateId: tpl.id, source: 'modal' }); await i.reply({ ...templatePanel(tpl, org.name, i.user.id), ephemeral: true }); return; }
    if (p.action === 'editmodal') { const tpl = this.template(i.guildId, Number(p.target)); this.db.update(templates).set({ content }).where(eq(templates.id, tpl.id)).run(); this.audit(i.guildId, i.user.id, tpl.organizationId, 'template.updated', { templateId: tpl.id }); await i.reply({ content: '템플릿 내용을 저장했습니다.', ephemeral: true }); return; }
    throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 템플릿 입력입니다.');
  }

  private async publicationButton(i: ButtonInteraction<'cached'>, p: ParsedCustomId) {
    const pub = this.publication(i.guildId, Number(p.target)); const forum = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, pub.id)).get();
    if (p.action === 'preview') { const tpl = this.template(i.guildId, pub.templateId); await i.reply({ content: await this.previewTemplate(i, tpl), ephemeral: true }); return; }
    if (p.action === 'publish' || p.action === 'repair') { await i.deferReply({ ephemeral: true }); const result = await this.publicationService.refresh(pub.id, p.action === 'repair'); const fresh = this.publication(i.guildId, pub.id); this.audit(i.guildId, i.user.id, pub.organizationId, p.action === 'repair' ? 'publication.repaired' : 'publication.published', { publicationId: pub.id }); await i.editReply(`✅ ${p.action === 'repair' ? '복구·재연결' : fresh.messageId === pub.messageId ? '갱신' : '게시'}했습니다.${this.diagnosticsText(result.diagnostics)}`); return; }
    if (p.action === 'autorefresh') { this.db.update(publications).set({ autoRefresh: !pub.autoRefresh }).where(eq(publications.id, pub.id)).run(); await i.update(publicationPanel({ ...pub, autoRefresh: !pub.autoRefresh }, i.user.id, Boolean(forum), forum?.threadId)); return; }
    if (p.action === 'forumtags') { const channel = await i.guild.channels.fetch(pub.channelId); if (!forum || channel?.type !== ChannelType.GuildForum) throw new ApplicationError('VALIDATION_ERROR', '포럼 게시 설정이 아닙니다.'); const options = channel.availableTags.slice(0, 25).map((tag) => new StringSelectMenuOptionBuilder().setLabel(tag.name.slice(0, 100)).setValue(tag.id).setDefault(forum.appliedTagIdsJson.includes(tag.id))); if (!options.length) throw new ApplicationError('VALIDATION_ERROR', '선택할 수 있는 포럼 태그가 없습니다.'); await i.reply({ content: '태그를 최대 5개 선택하세요. 태그 이름이 아닌 Discord 태그 ID로 저장됩니다.', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId('pub', 'tagsselected', pub.id, i.user.id)).setMinValues(0).setMaxValues(Math.min(5, options.length)).addOptions(options))], ephemeral: true }); return; }
    if (p.action === 'forumsettings') { if (!forum) throw new ApplicationError('VALIDATION_ERROR', '포럼 게시 설정이 아닙니다.'); const fields = [new TextInputBuilder().setCustomId('title').setLabel('Liquid 제목 템플릿').setStyle(TextInputStyle.Short).setValue(forum.titleTemplate.slice(0, 100)).setRequired(true), new TextInputBuilder().setCustomId('archive').setLabel('자동 보관(60|1440|4320|10080)').setStyle(TextInputStyle.Short).setValue(String(forum.autoArchiveDuration)).setRequired(true), new TextInputBuilder().setCustomId('slowmode').setLabel('slowmode 초').setStyle(TextInputStyle.Short).setValue(String(forum.slowmodeSeconds)).setRequired(true), new TextInputBuilder().setCustomId('flags').setLabel('archive, lock, preserve_manual_tags').setStyle(TextInputStyle.Short).setValue([forum.archiveAfterPublish && 'archive', forum.lockAfterPublish && 'lock', forum.preserveManualTags && 'preserve_manual_tags'].filter(Boolean).join(', ')).setRequired(false)]; await i.showModal(new ModalBuilder().setCustomId(customId('pub', 'forumsettingsmodal', pub.id, i.user.id)).setTitle('포럼 스레드 설정').addComponents(...fields.map((field) => new ActionRowBuilder<TextInputBuilder>().addComponents(field)))); return; }
    if (p.action === 'edit') { const fields = [new TextInputBuilder().setCustomId('name').setLabel('게시 설정 이름').setStyle(TextInputStyle.Short).setValue(pub.name).setRequired(true), new TextInputBuilder().setCustomId('auto').setLabel('자동 갱신: true | false').setStyle(TextInputStyle.Short).setValue(String(pub.autoRefresh)).setRequired(true)]; await i.showModal(new ModalBuilder().setCustomId(customId('pub', 'editmodal', pub.id, i.user.id)).setTitle('게시 설정 편집').addComponents(...fields.map((field) => new ActionRowBuilder<TextInputBuilder>().addComponents(field)))); return; }
    if (p.action === 'delete') { await i.update({ content: '게시 설정만 삭제합니다. 기존 Discord 메시지나 포럼 글은 삭제하지 않습니다. 계속할까요?', embeds: [], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(customId('pub', 'deleteyes', pub.id, i.user.id)).setLabel('설정 삭제 확인').setStyle(ButtonStyle.Danger))] }); return; }
    if (p.action === 'deleteyes') { this.db.delete(publications).where(eq(publications.id, pub.id)).run(); this.audit(i.guildId, i.user.id, pub.organizationId, 'publication.deleted', { publicationId: pub.id, discordContentPreserved: true }); await i.update({ content: '게시 설정을 삭제했습니다. 기존 Discord 콘텐츠는 보존했습니다.', embeds: [], components: [] }); return; }
    if (p.action === 'open') { const url = forum?.threadId ? `https://discord.com/channels/${i.guildId}/${forum.threadId}` : `https://discord.com/channels/${i.guildId}/${pub.channelId}/${pub.messageId ?? ''}`; await i.reply({ content: url, ephemeral: true }); return; }
    await i.reply({ content: '설정 편집 화면은 기존 값을 보존한 채 열립니다.', ephemeral: true });
  }
  private async publicationModal(i: ModalSubmitInteraction<'cached'>, p: ParsedCustomId) {
    const pub = this.publication(i.guildId, Number(p.target));
    if (p.action === 'editmodal') { const auto = i.fields.getTextInputValue('auto').trim().toLowerCase(); if (!['true', 'false'].includes(auto)) throw new ApplicationError('VALIDATION_ERROR', '자동 갱신 값은 true 또는 false여야 합니다.'); this.db.update(publications).set({ name: i.fields.getTextInputValue('name').trim(), autoRefresh: auto === 'true' }).where(eq(publications.id, pub.id)).run(); this.audit(i.guildId, i.user.id, pub.organizationId, 'publication.updated', { publicationId: pub.id }); await i.reply({ content: '게시 설정을 수정했습니다.', ephemeral: true }); return; }
    if (p.action === 'forumsettingsmodal') { const forum = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, pub.id)).get(); if (!forum) throw new ApplicationError('VALIDATION_ERROR', '포럼 게시 설정이 아닙니다.'); const archive = Number(i.fields.getTextInputValue('archive')); const slowmode = Number(i.fields.getTextInputValue('slowmode')); if (![60, 1440, 4320, 10080].includes(archive) || !Number.isInteger(slowmode) || slowmode < 0 || slowmode > 21600) throw new ApplicationError('VALIDATION_ERROR', '자동 보관 시간 또는 slowmode 값이 Discord 범위를 벗어났습니다.'); const flags = new Set(i.fields.getTextInputValue('flags').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)); this.db.update(forumPublicationSettings).set({ titleTemplate: i.fields.getTextInputValue('title'), autoArchiveDuration: archive, slowmodeSeconds: slowmode, archiveAfterPublish: flags.has('archive'), lockAfterPublish: flags.has('lock'), preserveManualTags: flags.has('preserve_manual_tags') }).where(eq(forumPublicationSettings.publicationId, pub.id)).run(); this.audit(i.guildId, i.user.id, pub.organizationId, 'publication.forum_settings_updated', { publicationId: pub.id }); await i.reply({ content: '포럼 제목과 스레드 설정을 저장했습니다.', ephemeral: true }); return; }
    throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 게시 설정 입력입니다.');
  }
  private diagnosticsText(rows: ReadonlyArray<{ code: string; message: string }>) { return rows.length ? `\n\n**진단**\n${rows.map((r) => `⚠️ [${r.code}] ${r.message}`).join('\n')}` : '\n진단: 정상'; }
}
