import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Term } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { pageTarget, paginationRow } from '../core/panel-state.js';
import { discordTimestamp, formatTermStatus } from '../presentation/formatters.js';

export function termHistory(organizationName: string, organizationId: number, terms: readonly Term[], owner: string, requestedPage = 0) {
  const page = pageOf(terms, requestedPage, 25); const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(managementId('term', 'historyopen', pageTarget(organizationId, page.page), owner)).setPlaceholder('임기 선택').addOptions(
    page.items.map((term) => new StringSelectMenuOptionBuilder().setLabel(term.displayName.slice(0, 100)).setValue(String(term.id)).setDescription(`${formatTermStatus(term.status)} · ${discordTimestamp(term.startAt, 'D')}`.slice(0, 100)))
  )));
  components.push(paginationRow('term', 'history', organizationId, page.page, page.pages, owner));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('term', 'start', organizationId, owner)).setLabel(terms.length ? '새 임기 시작' : '첫 임기 시작').setStyle(ButtonStyle.Primary)));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 임기 기록`).setDescription(page.items.length ? '임기를 선택해 상세 정보를 확인하세요.' : '임기 기록이 없습니다. 아래 버튼으로 첫 임기를 시작하세요.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${terms.length}개` })], components };
}

export function termHistoryDetail(organizationName: string, organizationId: number, term: Term, owner: string, page = 0) {
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 임기 · ${term.displayName}`).addFields(
    { name: '상태', value: formatTermStatus(term.status), inline: true }, { name: '회차', value: term.termNumber === null ? '미지정' : `${term.termNumber}기`, inline: true },
    { name: '시작', value: discordTimestamp(term.startAt, 'f') }, { name: '종료 예정', value: term.scheduledEndAt ? discordTimestamp(term.scheduledEndAt, 'f') : '무기한' }, { name: '실제 종료', value: term.actualEndAt ? discordTimestamp(term.actualEndAt, 'f') : '—' }
  )], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('term', 'history', pageTarget(organizationId, page), owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary))] };
}
