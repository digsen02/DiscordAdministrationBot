import { DiscordAPIError, type Client, type Guild, type SendableChannels } from 'discord.js';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../../infrastructure/database/client.js';
import { publications, templates } from '../../infrastructure/database/schema.js';
import { TemplateRenderer } from '../../infrastructure/template/template-renderer.js';
import { ApplicationError } from '../errors/application-error.js';
import { ContextBuilder } from './context-builder.js';

export class PublicationService {
  private readonly renderer = new TemplateRenderer();
  private readonly contexts: ContextBuilder;
  constructor(private readonly db: AppDatabase, private readonly client: Client) { this.contexts = new ContextBuilder(db); }

  async refresh(publicationId: number, repair = false): Promise<void> {
    const publication = this.db.select().from(publications).where(eq(publications.id, publicationId)).get();
    if (!publication) throw new ApplicationError('NOT_FOUND', '게시 설정을 찾을 수 없습니다.');
    const template = this.db.select().from(templates).where(eq(templates.id, publication.templateId)).get();
    if (!template || template.isDraft) throw new ApplicationError('INVALID_TEMPLATE', '게시할 수 있는 유효한 템플릿이 없습니다.');
    const guild = this.client.guilds.cache.find((candidate) => candidate.channels.cache.has(publication.channelId));
    if (!guild) throw new ApplicationError('NOT_FOUND', '게시 대상 서버를 찾을 수 없습니다.');
    const channel = await this.getChannel(guild, publication.channelId);
    const built = await this.contexts.build(publication.organizationId, guild);
    try {
      const content = await this.renderer.render(template.content, built.context, { timeZone: built.timeZone, mentions: built.mentions });
      const allowedMentions = { parse: [] as never[], users: [...built.mentions.userIds], roles: [...built.mentions.roleIds], repliedUser: false };
      let messageId = publication.messageId;
      if (!messageId || repair) {
        const message = await channel.send({ content, allowedMentions }); messageId = message.id;
      } else {
        const message = await channel.messages.fetch(messageId);
        if (message.author.id !== this.client.user?.id) throw new ApplicationError('MISSING_PERMISSION', '다른 사용자 또는 봇이 작성한 메시지는 수정할 수 없습니다.');
        await message.edit({ content, allowedMentions });
      }
      this.db.update(publications).set({ messageId, broken: false, lastRenderedAt: new Date(), lastRenderError: null }).where(eq(publications.id, publicationId)).run();
    } catch (error) {
      const deleted = error instanceof DiscordAPIError && error.code === 10008;
      this.db.update(publications).set({ broken: deleted || publication.broken, lastRenderError: error instanceof Error ? error.message : String(error) }).where(eq(publications.id, publicationId)).run();
      if (deleted) throw new ApplicationError('PUBLICATION_DELETED', '게시 메시지가 삭제되었습니다. /publication repair로 복구해 주세요.');
      throw error;
    }
  }
  private async getChannel(guild: Guild, channelId: string): Promise<SendableChannels> {
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isSendable()) throw new ApplicationError('VALIDATION_ERROR', '선택한 채널에는 메시지를 게시할 수 없습니다.');
    return channel;
  }
}
