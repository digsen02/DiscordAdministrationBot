import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { customFieldDefinitions } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { pageTarget, paginationRow } from '../core/panel-state.js';

type Field = typeof customFieldDefinitions.$inferSelect;
export interface FieldBrowserItem { field: Field; value: string | null }

export function fieldBrowser(organizationName: string, organizationId: number, items: readonly FieldBrowserItem[], owner: string, requestedPage = 0) {
  const page = pageOf(items, requestedPage, 25); const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(managementId('org', 'fieldopen', pageTarget(organizationId, page.page), owner)).setPlaceholder('사용자 정의 필드 선택').addOptions(
      page.items.map(({ field, value }) => new StringSelectMenuOptionBuilder().setLabel(field.label.slice(0, 100)).setValue(String(field.id)).setDescription(`${field.scope === 'organization' ? '조직' : '현재 임기'} · ${field.type} · ${value ?? '값 없음'}`.slice(0, 100)))
    )
  ));
  components.push(paginationRow('org', 'fields', organizationId, page.page, page.pages, owner));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'fieldcreate', pageTarget(organizationId, page.page), owner)).setLabel(items.length ? '새 필드 만들기' : '첫 필드 만들기').setStyle(ButtonStyle.Primary)));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 사용자 정의 필드`).setDescription(page.items.length ? '필드를 선택해 현재 값과 설정을 확인하세요.' : '사용자 정의 필드가 없습니다. 아래 버튼으로 첫 필드를 만드세요.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${items.length}개` })], components };
}

export function fieldDetail(organizationName: string, organizationId: number, item: FieldBrowserItem, owner: string, page = 0, notice?: string) {
  const { field, value } = item; const target = pageTarget(field.id, page);
  return { ...(notice ? { content: notice } : {}), embeds: [new EmbedBuilder().setTitle(`${organizationName} · 추가 정보 · ${field.label}`).setDescription(`현재 값: **${value ?? '설정되지 않음'}**`).addFields(
    { name: 'key', value: `\`${field.key}\``, inline: true }, { name: '범위', value: field.scope === 'organization' ? '조직' : '현재 임기', inline: true },
    { name: '형식', value: field.type, inline: true }, { name: '필수', value: field.required ? '예' : '아니요', inline: true }, { name: '표시 순서', value: String(field.displayOrder), inline: true }
  )], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(managementId('org', 'fieldset', target, owner)).setLabel('값 설정').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(managementId('org', 'fieldclear', target, owner)).setLabel('값 지우기').setStyle(ButtonStyle.Secondary).setDisabled(value === null || field.required),
      new ButtonBuilder().setCustomId(managementId('org', 'fieldedit', target, owner)).setLabel('정의 수정').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(managementId('org', 'fielddelete', target, owner)).setLabel('삭제').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'fields', pageTarget(organizationId, page), owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary))
  ] };
}
