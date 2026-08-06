import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Publication } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageTarget } from '../core/panel-state.js';
import { discordTimestamp } from '../presentation/formatters.js';

export interface PublicationPanelContext { forum: boolean; threadId?: string | null | undefined; organizationName?: string | undefined; templateName?: string | undefined; channelName?: string | undefined; targetExists?: boolean | undefined; notice?: string | undefined; browserPage?: number | undefined }
export function publicationPanel(publication: Publication, owner: string, contextOrForum: PublicationPanelContext | boolean, legacyThreadId?: string | null) {
  const context: PublicationPanelContext = typeof contextOrForum === 'boolean' ? { forum: contextOrForum, threadId: legacyThreadId } : contextOrForum;
  const target = pageTarget(publication.id, context.browserPage ?? 0);
  const b = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(managementId('pub', action, target, owner)).setLabel(label).setStyle(style);
  const primary = [b('미리보기', 'preview')];
  primary.push(publication.messageId ? b('지금 갱신', 'publish', ButtonStyle.Primary) : b('저장하고 게시', 'publish', ButtonStyle.Primary));
  if ((publication.messageId || context.threadId) && context.targetExists !== false) primary.push(b('게시물 열기', 'open'));
  const settings = [
    ['기본 설정', 'edit'], ['템플릿 변경', 'templatechange'],
    ...(context.forum ? [['제목과 태그', 'forumtags'], ['스레드 설정', 'forumsettings']] : []),
    ['자동 갱신 설정', 'autorefresh'],
    ...((publication.broken || publication.lastRenderError || context.targetExists === false || (publication.messageId && !context.threadId && context.forum)) ? [['연결 상태 다시 검사', 'recheck'], ['기존 게시물에 다시 연결', 'reconnect'], ['새 게시물 생성', 'repair']] : []),
    ['게시 설정 삭제', 'delete']
  ];
  const menu = new StringSelectMenuBuilder().setCustomId(managementId('pub', 'actions', target, owner)).setPlaceholder('설정 및 기타 작업').addOptions(
    settings.map(([label, value]) => { const option = new StringSelectMenuOptionBuilder().setLabel(label!).setValue(value!); return value === 'autorefresh' ? option.setDescription(`자동 갱신 ${publication.autoRefresh ? '끄기' : '켜기'}`) : option; })
  );
  const status = context.targetExists === false ? '❌ Discord 게시물을 찾을 수 없음' : publication.broken ? '❌ 연결 오류' : publication.lastRenderError ? '⚠️ 최근 갱신 실패' : publication.messageId || context.threadId ? '✅ 정상' : '게시 전 설정';
  return { ...(context.notice ? { content: context.notice } : {}), embeds: [new EmbedBuilder().setTitle(`${context.organizationName ? `${context.organizationName} · 게시물 · ` : ''}${publication.name}`).addFields(
    { name: '채널', value: context.channelName ? `#${context.channelName}` : `<#${publication.channelId}>`, inline: true },
    { name: '템플릿', value: context.templateName ?? '확인 중', inline: true }, { name: '게시 방식', value: context.forum ? '포럼 게시물' : '일반 메시지', inline: true },
    { name: '자동 갱신', value: publication.autoRefresh ? '켜짐' : '꺼짐', inline: true }, { name: '마지막 갱신', value: discordTimestamp(publication.lastRenderedAt, 'R'), inline: true },
    { name: '상태', value: status, inline: true }
  ).setDescription(publication.lastRenderError ? '⚠️ 최근 갱신에 실패했습니다. 자세한 오류는 진단에서 확인하세요.' : null)], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(...primary), new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(b('뒤로', 'back'), b('조직 관리로', 'org'))
  ] };
}
