import {
  ChannelFlags,
  ChannelType,
  DiscordAPIError,
  type Client,
  type ForumChannel,
  type ThreadAutoArchiveDuration,
  type ThreadChannel
} from 'discord.js';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../../infrastructure/database/client.js';
import { forumPublicationSettings, publications, templates } from '../../infrastructure/database/schema.js';
import { TemplateRenderer } from '../../infrastructure/template/template-renderer.js';
import { ApplicationError, type ErrorCode } from '../errors/application-error.js';
import { ContextBuilder } from './context-builder.js';

export interface PublicationDiagnostic {
  code: Extract<ErrorCode,
    'FORUM_TAG_MISSING' | 'FORUM_TAG_LIMIT_EXCEEDED' | 'FORUM_REQUIRES_TAG' |
    'FORUM_TITLE_EMPTY' | 'FORUM_SETTINGS_MISSING' | 'FORUM_THREAD_LOCKED' |
    'FORUM_SETTING_UPDATE_FAILED'>;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface PublicationRefreshResult { diagnostics: PublicationDiagnostic[] }

const VALID_ARCHIVE_DURATIONS = new Set([60, 1440, 4320, 10080]);

export class PublicationService {
  private readonly renderer = new TemplateRenderer();
  private readonly contexts: ContextBuilder;
  constructor(private readonly db: AppDatabase, private readonly client: Client) { this.contexts = new ContextBuilder(db); }

  async refresh(publicationId: number, repair = false): Promise<PublicationRefreshResult> {
    const publication = this.db.select().from(publications).where(eq(publications.id, publicationId)).get();
    if (!publication) throw new ApplicationError('NOT_FOUND', '게시 설정을 찾을 수 없습니다.');
    const template = this.db.select().from(templates).where(eq(templates.id, publication.templateId)).get();
    if (!template || template.isDraft) throw new ApplicationError('INVALID_TEMPLATE', '게시할 수 있는 유효한 템플릿이 없습니다.');
    const guild = this.client.guilds.cache.find((candidate) => candidate.channels.cache.has(publication.channelId));
    if (!guild) throw new ApplicationError('NOT_FOUND', '게시 대상 서버를 찾을 수 없습니다.');
    const channel = await guild.channels.fetch(publication.channelId);
    if (!channel) throw new ApplicationError('NOT_FOUND', '게시 대상 채널을 찾을 수 없습니다.');
    const built = await this.contexts.build(publication.organizationId, guild);
    const diagnostics: PublicationDiagnostic[] = [];
    try {
      const content = await this.renderer.render(template.content, built.context, { timeZone: built.timeZone, mentions: built.mentions });
      const allowedMentions = { parse: [] as never[], users: [...built.mentions.userIds], roles: [...built.mentions.roleIds], repliedUser: false };
      if (channel.type === ChannelType.GuildForum) {
        await this.refreshForum(channel, publication, content, allowedMentions, built.context, built.timeZone, built.mentions, repair, diagnostics);
      } else {
        if (!channel.isSendable()) throw new ApplicationError('VALIDATION_ERROR', '선택한 채널에는 메시지를 게시할 수 없습니다.');
        let messageId = publication.messageId;
        if (!messageId || repair) {
          const message = await channel.send({ content, allowedMentions }); messageId = message.id;
        } else {
          const message = await channel.messages.fetch(messageId);
          if (message.author.id !== this.client.user?.id) throw new ApplicationError('MISSING_PERMISSION', '다른 사용자 또는 봇이 작성한 메시지는 수정할 수 없습니다.');
          await message.edit({ content, allowedMentions });
        }
        this.db.update(publications).set({ messageId }).where(eq(publications.id, publicationId)).run();
      }
      this.db.update(publications).set({ broken: false, lastRenderedAt: new Date(), lastRenderError: diagnostics.length ? diagnostics.map((d) => `[${d.code}] ${d.message}`).join('\n') : null }).where(eq(publications.id, publicationId)).run();
      return { diagnostics };
    } catch (error) {
      const deleted = error instanceof DiscordAPIError && (error.code === 10008 || error.code === 10003);
      this.db.update(publications).set({ broken: deleted || publication.broken, lastRenderError: error instanceof Error ? error.message : String(error) }).where(eq(publications.id, publicationId)).run();
      if (deleted) throw new ApplicationError('PUBLICATION_DELETED', '게시 메시지 또는 포럼 스레드가 삭제되었습니다. /publication repair로 복구해 주세요.');
      throw error;
    }
  }

  private async refreshForum(
    channel: ForumChannel,
    publication: typeof publications.$inferSelect,
    content: string,
    allowedMentions: { parse: never[]; users: string[]; roles: string[]; repliedUser: boolean },
    context: Readonly<Record<string, unknown>>,
    timeZone: string,
    mentions: { userIds: ReadonlySet<string>; roleIds: ReadonlySet<string> },
    repair: boolean,
    diagnostics: PublicationDiagnostic[]
  ): Promise<void> {
    const settings = this.db.select().from(forumPublicationSettings).where(eq(forumPublicationSettings.publicationId, publication.id)).get();
    if (!settings) throw new ApplicationError('FORUM_SETTINGS_MISSING', '포럼 게시 설정이 없습니다. /publication create로 다시 구성해 주세요.');
    const renderedTitle = await this.renderer.render(settings.titleTemplate, context, { timeZone, mentions, maxLength: 1000 });
    const title = this.sanitizeForumTitle(renderedTitle);
    if (!title) throw new ApplicationError('FORUM_TITLE_EMPTY', '포럼 제목 템플릿의 렌더링 결과가 비어 있습니다. 제목 템플릿을 수정해 주세요.');
    const configuredIds = [...new Set(settings.appliedTagIdsJson)];
    if (configuredIds.length > 5) diagnostics.push({ code: 'FORUM_TAG_LIMIT_EXCEEDED', message: 'Discord 제한에 따라 포럼 태그는 최대 5개만 적용했습니다.', details: { configuredCount: configuredIds.length } });
    const availableIds = new Set(channel.availableTags.map((tag) => tag.id));
    const missingIds = configuredIds.filter((id) => !availableIds.has(id));
    if (missingIds.length) diagnostics.push({ code: 'FORUM_TAG_MISSING', message: `삭제되었거나 사용할 수 없는 포럼 태그 ${missingIds.length}개를 제외했습니다.`, details: { tagIds: missingIds } });
    const validConfiguredIds = configuredIds.filter((id) => availableIds.has(id)).slice(0, 5);
    if (channel.flags.has(ChannelFlags.RequireTag) && validConfiguredIds.length === 0) {
      throw new ApplicationError('FORUM_REQUIRES_TAG', '이 포럼은 태그가 필수입니다. 현재 사용할 수 있는 태그 중 적어도 하나를 선택해 주세요.', { configuredTagIds: configuredIds, missingTagIds: missingIds });
    }
    const autoArchiveDuration = (VALID_ARCHIVE_DURATIONS.has(settings.autoArchiveDuration) ? settings.autoArchiveDuration : channel.defaultAutoArchiveDuration ?? 1440) as ThreadAutoArchiveDuration;
    let thread: ThreadChannel;
    if (!settings.threadId || !publication.messageId || repair) {
      thread = await channel.threads.create({
        name: title,
        autoArchiveDuration,
        rateLimitPerUser: settings.slowmodeSeconds,
        appliedTags: validConfiguredIds,
        message: { content, allowedMentions }
      });
      const starter = await thread.fetchStarterMessage();
      if (!starter) throw new ApplicationError('PUBLICATION_DELETED', '포럼 starter message를 찾을 수 없습니다.');
      this.db.transaction((tx) => {
        tx.update(publications).set({ messageId: starter.id }).where(eq(publications.id, publication.id)).run();
        tx.update(forumPublicationSettings).set({ threadId: thread.id }).where(eq(forumPublicationSettings.publicationId, publication.id)).run();
      });
      if (settings.archiveAfterPublish || settings.lockAfterPublish) {
        await thread.edit({ archived: settings.archiveAfterPublish || settings.lockAfterPublish, locked: settings.lockAfterPublish });
      }
      return;
    }
    const fetchedThread = await channel.threads.fetch(settings.threadId);
    if (!fetchedThread) throw new ApplicationError('PUBLICATION_DELETED', '포럼 스레드가 삭제되었습니다. /publication repair로 복구해 주세요.');
    thread = fetchedThread;
    if (thread.locked) throw new ApplicationError('FORUM_THREAD_LOCKED', '포럼 스레드가 잠겨 있어 자동 갱신할 수 없습니다. 잠금을 해제하거나 lockAfterPublish를 끄세요.');
    const restoreArchived = thread.archived;
    if (thread.archived) {
      try { await thread.edit({ archived: false }); }
      catch (error) { throw new ApplicationError('FORUM_SETTING_UPDATE_FAILED', '보관된 포럼 스레드를 갱신하기 위해 다시 열지 못했습니다.', { reason: error instanceof Error ? error.message : String(error) }); }
    }
    const starter = await thread.messages.fetch(publication.messageId);
    if (starter.author.id !== this.client.user?.id) throw new ApplicationError('MISSING_PERMISSION', '다른 사용자 또는 봇이 작성한 starter message는 수정할 수 없습니다.');
    await starter.edit({ content, allowedMentions });
    const manualIds = settings.preserveManualTags ? thread.appliedTags.filter((id) => availableIds.has(id) && !configuredIds.includes(id)) : [];
    const appliedTags = [...new Set([...validConfiguredIds, ...manualIds])].slice(0, 5);
    try {
      await thread.edit({ name: title, appliedTags, autoArchiveDuration, rateLimitPerUser: settings.slowmodeSeconds });
      if (restoreArchived || settings.archiveAfterPublish) await thread.edit({ archived: true });
    } catch (error) {
      diagnostics.push({ code: 'FORUM_SETTING_UPDATE_FAILED', message: '본문은 갱신했지만 포럼 제목, 태그 또는 스레드 설정 일부를 갱신하지 못했습니다.', details: { reason: error instanceof Error ? error.message : String(error) } });
    }
  }

  private sanitizeForumTitle(value: string): string {
    return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  }
}
