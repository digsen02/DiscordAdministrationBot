import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { RoleBinding } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { pageTarget, paginationRow } from '../core/panel-state.js';
import { formatCardinality, formatRoleKind, safeDescription } from '../presentation/formatters.js';

export function roleBrowser(organizationName: string, organizationId: number, bindings: readonly RoleBinding[], owner: string, holderCounts: ReadonlyMap<string, number>, requestedPage = 0, existingRoleIds?: ReadonlySet<string>) {
  const page = pageOf(bindings, requestedPage, 25);
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(managementId('org', 'roleopen', pageTarget(organizationId, page.page), owner)).setPlaceholder('역할 연결 선택').addOptions(
    page.items.map((binding) => { const count = holderCounts.get(binding.discordRoleId) ?? 0; const missing = existingRoleIds ? !existingRoleIds.has(binding.discordRoleId) : false; const invalid = missing || (binding.required && count === 0) || (binding.cardinality === 'one' && count > 1); return new StringSelectMenuOptionBuilder().setLabel(`${invalid ? '⚠️ ' : '✅ '}${binding.displayName}`.slice(0, 100)).setValue(String(binding.id)).setDescription(safeDescription(`${formatRoleKind(binding.kind)} · ${formatCardinality(binding.cardinality)}${binding.required ? ' 필수' : ''} · ${missing ? '역할 삭제됨' : count === 0 ? '현재 공석' : `현재 ${count}명`}`)); })
  )));
  components.push(paginationRow('org', 'roles', organizationId, page.page, page.pages, owner));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'roleadd', pageTarget(organizationId, page.page), owner)).setLabel(bindings.length ? '역할 추가' : '첫 역할 연결하기').setStyle(ButtonStyle.Primary)
  ));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 역할 및 직책`).setDescription(bindings.length ? '현재 보유 인원과 설정을 확인한 뒤 역할을 선택하세요.' : '연결된 역할이 없습니다. 아래 버튼으로 첫 역할을 연결하세요.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${bindings.length}개` })], components };
}

export function roleDetail(organizationName: string, organizationId: number, binding: RoleBinding, owner: string, holders: readonly string[], page = 0, roleExists = true, notice?: string) {
  const id = (action: string) => managementId('org', action, organizationId, owner);
  const warnings = [!roleExists ? '연결된 Discord 역할이 삭제되었습니다.' : null, binding.required && holders.length === 0 ? '필수 역할이 공석입니다.' : null, binding.cardinality === 'one' && holders.length > 1 ? `1명 역할을 ${holders.length}명이 보유하고 있습니다.` : null].filter(Boolean);
  const target = pageTarget(binding.id, page);
  return { ...(notice ? { content: notice } : {}), embeds: [new EmbedBuilder().setTitle(`${organizationName} · 역할 및 직책 · ${binding.displayName}`).setDescription(`${roleExists ? `<@&${binding.discordRoleId}>` : '❌ 삭제된 Discord 역할'}\n표시 이름: ${binding.displayName}\nkey: \`${binding.key}\`\n종류: ${formatRoleKind(binding.kind)}\n인원 규칙: ${formatCardinality(binding.cardinality)}\n필수 여부: ${binding.required ? '필수' : '선택'}\n표시 순서: ${binding.displayOrder}\n현재 보유: ${holders.length}명${holders.length ? `\n${holders.slice(0, 20).map((member) => `<@${member}>`).join(' ')}` : ''}${warnings.length ? `\n\n⚠️ ${warnings.join('\n⚠️ ')}` : '\n\n✅ 정상'}`)], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(managementId('org', 'roleeditone', target, owner)).setLabel('설정 수정').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(managementId('org', 'rolechange', target, owner)).setLabel('Discord 역할 변경').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(managementId('org', 'roleholders', target, owner)).setLabel('현재 보유자 보기').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(managementId('org', 'roledelete', target, owner)).setLabel('삭제').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'roles', pageTarget(organizationId, page), owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(id('open')).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary))
  ] };
}
