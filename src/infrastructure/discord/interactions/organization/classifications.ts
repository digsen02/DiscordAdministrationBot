import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Classification } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';

export function classificationBrowser(organizationName: string, organizationId: number, rows: readonly Classification[], owner: string, optionCounts: ReadonlyMap<number, number>) {
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (rows.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(managementId('org', 'classselected', organizationId, owner)).setPlaceholder('분류 선택').addOptions(
    rows.slice(0, 25).map((row) => new StringSelectMenuOptionBuilder().setLabel(row.displayName.slice(0, 100)).setValue(String(row.id)).setDescription(`선택지 ${optionCounts.get(row.id) ?? 0}개 · ${row.exclusive ? '하나만 선택' : '복수 선택'}`))
  )));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'classcreate', organizationId, owner)).setLabel('분류 만들기').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 구성원 분류`).setDescription(rows.length ? '분류를 선택하면 선택지와 역할 매핑을 관리할 수 있습니다.' : '분류가 없습니다.')], components };
}
