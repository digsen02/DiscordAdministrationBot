import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { templates } from '../../../database/schema.js';
import { customId } from '../core/custom-id.js';

type Template = typeof templates.$inferSelect;
export function templatePanel(template: Template, organizationName: string, owner: string) {
  const b = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(customId('tpl', action, template.id, owner)).setLabel(label).setStyle(style);
  return { embeds: [new EmbedBuilder().setTitle(template.name).setDescription(`조직: ${organizationName}\n상태: ${template.isDraft ? '초안' : '사용 가능'}\n내용: ${template.content.length.toLocaleString()}자`)], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(b('내용 편집', 'edit'), b('이름 변경', 'rename'), b('미리보기', 'preview'), b('복제', 'duplicate'), b('내보내기', 'export')),
    new ActionRowBuilder<ButtonBuilder>().addComponents(b('초안 전환', 'draft'), b('삭제', 'delete', ButtonStyle.Danger))
  ] };
}
