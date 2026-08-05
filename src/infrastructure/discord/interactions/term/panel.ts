import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { Term } from '../../../database/schema.js';
import { customId } from '../core/custom-id.js';

export function termPanel(organizationName: string, organizationId: number, term: Term | undefined, owner: string) {
  const id = (action: string) => customId('term', action, organizationId, owner);
  const button = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id(action)).setLabel(label).setStyle(style);
  const embed = new EmbedBuilder().setTitle(`${organizationName} 임기 관리`).setDescription(term
    ? `**${term.displayName}**${term.termNumber === null ? '' : ` (#${term.termNumber})`}\n상태: ${term.status}\n시작: ${term.startAt.toISOString()}\n종료 예정: ${term.scheduledEndAt?.toISOString() ?? '없음'}`
    : '현재 임기가 없습니다.');
  return { embeds: [embed], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(button('편집', 'edit'), button('일시 중지', 'pause'), button('재개', 'resume'), button('종료', 'end', ButtonStyle.Danger)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(button('새 임기 시작', 'start'), button('사용자 정의 필드', 'fields'), button('기록', 'history'))
  ] };
}
