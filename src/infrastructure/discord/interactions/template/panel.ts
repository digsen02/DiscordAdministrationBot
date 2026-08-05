import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { templates } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { discordTimestamp, formatDraft } from '../presentation/formatters.js';

type Template = typeof templates.$inferSelect;
export function templatePanel(template: Template, organizationName: string, owner: string, usageCount = 0, latestRenderStatus = '아직 미리보지 않음') {
  const b = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(managementId('tpl', action, template.id, owner)).setLabel(label).setStyle(style);
  const actions = new StringSelectMenuBuilder().setCustomId(managementId('tpl', 'actions', template.id, owner)).setPlaceholder('기타 작업').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('이름 변경').setValue('rename'), new StringSelectMenuOptionBuilder().setLabel('복제').setValue('duplicate'),
    new StringSelectMenuOptionBuilder().setLabel('파일로 내보내기').setValue('export'), new StringSelectMenuOptionBuilder().setLabel(template.isDraft ? '사용 가능으로 전환' : '초안으로 전환').setValue('draft'),
    new StringSelectMenuOptionBuilder().setLabel('삭제').setValue('delete').setDescription('확인 후 삭제합니다.')
  );
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 템플릿 · ${template.name}`).addFields(
    { name: '상태', value: formatDraft(template.isDraft), inline: true }, { name: '내용 길이', value: `${template.content.length.toLocaleString('ko-KR')}자`, inline: true },
    { name: '연결된 게시물', value: `${usageCount}개`, inline: true }, { name: '마지막 수정', value: discordTimestamp(template.updatedAt, 'R'), inline: true },
    { name: '최근 미리보기', value: latestRenderStatus, inline: true }
  )], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(b('미리보기', 'preview', ButtonStyle.Primary), b('내용 수정', 'edit')),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(actions),
    new ActionRowBuilder<ButtonBuilder>().addComponents(b('뒤로', 'back'), b('조직 관리로', 'org'))
  ] };
}
