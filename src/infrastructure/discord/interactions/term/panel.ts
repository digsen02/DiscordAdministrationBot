import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { Term } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { discordTimestamp, formatTermStatus } from '../presentation/formatters.js';

export function termPanel(organizationName: string, organizationId: number, term: Term | undefined, owner: string) {
  const button = (label: string, action: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(managementId('term', action, organizationId, owner)).setLabel(label).setStyle(style);
  const primary: ButtonBuilder[] = [];
  if (!term) primary.push(button('새 임기 시작', 'start', ButtonStyle.Primary), button('과거 임기 보기', 'history'));
  else if (term.status === 'suspended') primary.push(button('임기 수정', 'edit'), button('재개', 'resume', ButtonStyle.Primary), button('임기 종료', 'end', ButtonStyle.Danger));
  else if (term.status === 'active') primary.push(button('임기 수정', 'edit'), button('일시 중지', 'pause'), button('임기 종료', 'end', ButtonStyle.Danger));
  else if (term.status === 'scheduled') primary.push(button('임기 수정', 'edit'), button('지금 시작', 'activate', ButtonStyle.Primary), button('예약 취소', 'cancel', ButtonStyle.Danger));
  else primary.push(button('과거 임기 보기', 'history'));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 임기`).setDescription(term
    ? `**${term.displayName}**${term.termNumber === null ? '' : ` · ${term.termNumber}기`}\n상태: ${formatTermStatus(term.status)}\n시작: ${discordTimestamp(term.startAt, 'D')}\n종료 예정: ${term.scheduledEndAt ? discordTimestamp(term.scheduledEndAt, 'D') : '무기한'}`
    : '현재 임기가 없습니다.')], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...primary), new ActionRowBuilder<ButtonBuilder>().addComponents(button('조직 관리로', 'org'))] };
}
