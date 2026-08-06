import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Classification, ClassificationOption } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { pageTarget, paginationRow } from '../core/panel-state.js';

export interface ClassificationState { population: number; conflicts: number; unassigned: number; overflow: number }

export function classificationBrowser(organizationName: string, organizationId: number, rows: readonly Classification[], owner: string, optionCounts: ReadonlyMap<number, number>, requestedPage = 0, states: ReadonlyMap<number, ClassificationState> = new Map()) {
  const page = pageOf(rows, requestedPage, 25);
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(managementId('org', 'classselected', pageTarget(organizationId, page.page), owner)).setPlaceholder('분류 선택').addOptions(
    page.items.map((row) => { const state = states.get(row.id); const warning = state && (state.conflicts || state.overflow || (!row.allowUnassigned && state.unassigned)); return new StringSelectMenuOptionBuilder().setLabel(`${warning ? '⚠️ ' : '✅ '}${row.displayName}`.slice(0, 100)).setValue(String(row.id)).setDescription(`선택지 ${optionCounts.get(row.id) ?? 0}개 · ${row.exclusive ? '하나만 선택' : '복수 선택'}${state ? ` · ${state.population}명` : ''}`.slice(0, 100)); })
  )));
  components.push(paginationRow('org', 'classes', organizationId, page.page, page.pages, owner));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'classcreate', pageTarget(organizationId, page.page), owner)).setLabel(rows.length ? '새 분류 만들기' : '첫 분류 만들기').setStyle(ButtonStyle.Primary)));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 구성원 분류`).setDescription(rows.length ? '분류를 선택하면 계산 상태와 선택지를 관리할 수 있습니다.' : '분류가 없습니다. 아래 버튼으로 첫 분류를 만드세요.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${rows.length}개` })], components };
}

export function classificationDetail(organizationName: string, organizationId: number, row: Classification, owner: string, page: number, state: ClassificationState, baseRoleName: string, capacityFieldName: string | null, notice?: string) {
  const target = pageTarget(row.id, page); const warnings = [`충돌 ${state.conflicts}명`, `미분류 ${state.unassigned}명`, `정원 초과 ${state.overflow}명`].filter((value, index) => [state.conflicts, state.unassigned, state.overflow][index]! > 0);
  return { ...(notice ? { content: notice } : {}), embeds: [new EmbedBuilder().setTitle(`${organizationName} · 구성원 분류 · ${row.displayName}`).addFields(
    { name: 'key', value: `\`${row.key}\``, inline: true }, { name: '기준 역할', value: baseRoleName, inline: true }, { name: '할당 방식', value: row.exclusive ? '한 사람당 하나' : '복수 허용', inline: true },
    { name: '미분류 구성원', value: row.allowUnassigned ? `허용 (${row.unassignedLabel})` : '허용하지 않음', inline: true }, { name: '정원 필드', value: capacityFieldName ?? '설정 안 함', inline: true }, { name: '표시 순서', value: String(row.displayOrder), inline: true },
    { name: '현재 계산', value: `기준 인원 ${state.population}명 · 충돌 ${state.conflicts}명 · 미분류 ${state.unassigned}명 · 정원 초과 ${state.overflow}명` }, { name: '상태', value: warnings.length ? `⚠️ ${warnings.join(' · ')}` : '✅ 정상' }
  )], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'classedit', target, owner)).setLabel('설정 수정').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(managementId('org', 'options', target, owner)).setLabel('선택지 관리').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(managementId('org', 'classdelete', target, owner)).setLabel('삭제').setStyle(ButtonStyle.Danger)
  ), new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'classes', pageTarget(organizationId, page), owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary))] };
}

export function classificationOptionBrowser(organizationName: string, classification: Classification, rows: readonly ClassificationOption[], owner: string, classPage: number, requestedPage = 0) {
  const page = pageOf(rows, requestedPage, 25); const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) {
    const menu = new StringSelectMenuBuilder().setCustomId(managementId('org', 'optionopen', `${classification.id}_${classPage}_${page.page}`, owner)).setPlaceholder('분류 선택지 선택').addOptions(page.items.map((row) => new StringSelectMenuOptionBuilder().setLabel(row.displayName.slice(0, 100)).setValue(String(row.id)).setDescription(`key ${row.key} · 순서 ${row.displayOrder}`.slice(0, 100))));
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'optionspage', `${classification.id}_${classPage}_${page.page - 1}`, owner)).setLabel('이전').setStyle(ButtonStyle.Secondary).setDisabled(page.page === 0),
    new ButtonBuilder().setCustomId(managementId('org', 'noop', `${classification.id}_${classPage}_${page.page}`, owner)).setLabel(`${page.page + 1}/${page.pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(managementId('org', 'optionspage', `${classification.id}_${classPage}_${page.page + 1}`, owner)).setLabel('다음').setStyle(ButtonStyle.Secondary).setDisabled(page.page + 1 >= page.pages)
  ));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'optionadd', `${classification.id}_${classPage}_${page.page}`, owner)).setLabel(rows.length ? '새 선택지 추가' : '첫 선택지 추가').setStyle(ButtonStyle.Primary)));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'classdetail', pageTarget(classification.id, classPage), owner)).setLabel('분류 상세로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · ${classification.displayName} · 선택지`).setDescription(rows.length ? '선택지를 골라 역할 매핑과 상태를 확인하세요.' : '선택지가 없습니다. 아래 버튼으로 첫 선택지를 추가하세요.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${rows.length}개` })], components };
}

export function classificationOptionDetail(organizationName: string, classification: Classification, option: ClassificationOption, owner: string, classPage: number, optionPage: number, holderCount: number, roleExists: boolean, notice?: string) {
  const target = `${option.id}_${classPage}_${optionPage}`;
  return { ...(notice ? { content: notice } : {}), embeds: [new EmbedBuilder().setTitle(`${organizationName} · ${classification.displayName} · ${option.displayName}`).setDescription(roleExists ? `<@&${option.discordRoleId}>` : '❌ 연결된 Discord 역할이 삭제되었습니다.').addFields(
    { name: 'key', value: `\`${option.key}\``, inline: true }, { name: '현재 역할 보유자', value: `${holderCount}명`, inline: true }, { name: '표시 순서', value: String(option.displayOrder), inline: true }
  )], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'optionedit', target, owner)).setLabel('설정 수정').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(managementId('org', 'optionrolechange', target, owner)).setLabel('Discord 역할 변경').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(managementId('org', 'optiondelete', target, owner)).setLabel('삭제').setStyle(ButtonStyle.Danger)
  ), new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'optionspage', `${classification.id}_${classPage}_${optionPage}`, owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary))] };
}
