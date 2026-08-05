import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { publications } from '../../../database/schema.js';
import { customId } from '../core/custom-id.js';

type Publication = typeof publications.$inferSelect;
export function publicationPanel(publication: Publication, owner: string, forum: boolean, threadId?: string | null) {
  const b = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(customId('pub', action, publication.id, owner)).setLabel(label).setStyle(style);
  const status = publication.messageId ? (forum ? `게시됨 · 스레드 ${threadId ?? '확인 불가'}` : `게시됨 · 메시지 ${publication.messageId}`) : '게시되지 않은 초안';
  const rows = [new ActionRowBuilder<ButtonBuilder>().addComponents(b('설정 편집', 'edit'), b('미리보기', 'preview'), b(publication.messageId ? '지금 갱신' : '저장하고 게시', 'publish', ButtonStyle.Primary), b('복구·재연결', 'repair'))];
  if (forum) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(b('제목·태그', 'forumtags'), b('스레드 설정', 'forumsettings'), b('게시물 열기', 'open')));
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(b('자동 갱신 전환', 'autorefresh'), b('설정 삭제', 'delete', ButtonStyle.Danger)));
  return { embeds: [new EmbedBuilder().setTitle(publication.name).setDescription(`${forum ? '포럼' : '일반'} 게시물\n채널: <#${publication.channelId}>\n상태: ${status}\n자동 갱신: ${publication.autoRefresh ? '켜짐' : '꺼짐'}\n마지막 갱신: ${publication.lastRenderedAt?.toISOString() ?? '없음'}\n진단: ${publication.lastRenderError ?? (publication.broken ? '오류 상태' : '정상')}`)], components: rows };
}
