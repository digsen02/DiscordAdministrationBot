import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { RoleBinding } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { formatCardinality, formatRoleKind, safeDescription } from '../presentation/formatters.js';

export function roleBrowser(organizationName: string, organizationId: number, bindings: readonly RoleBinding[], owner: string, holderCounts: ReadonlyMap<string, number>) {
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (bindings.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(managementId('org', 'roleopen', organizationId, owner)).setPlaceholder('역할 연결 선택').addOptions(
    bindings.slice(0, 25).map((binding) => new StringSelectMenuOptionBuilder().setLabel(binding.displayName.slice(0, 100)).setValue(String(binding.id)).setDescription(safeDescription(`${formatRoleKind(binding.kind)} · ${formatCardinality(binding.cardinality)}${binding.required ? ' · 필수' : ''} · 현재 ${holderCounts.get(binding.discordRoleId) ?? 0}명`)))
  )));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'roleadd', organizationId, owner)).setLabel('역할 추가').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('뒤로').setStyle(ButtonStyle.Secondary)
  ));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 역할 및 직책`).setDescription(bindings.length ? '현재 보유 인원과 설정을 확인한 뒤 역할을 선택하세요.' : '연결된 역할이 없습니다.')], components };
}

export function roleDetail(organizationName: string, organizationId: number, binding: RoleBinding, owner: string, holders: readonly string[]) {
  const id = (action: string) => managementId('org', action, organizationId, owner);
  return { embeds: [new EmbedBuilder().setTitle(`${organizationName} · 역할 및 직책 · ${binding.displayName}`).setDescription(`<@&${binding.discordRoleId}>\n종류: ${formatRoleKind(binding.kind)}\n인원 규칙: ${formatCardinality(binding.cardinality)}\n필수 여부: ${binding.required ? '필수' : '선택'}\n현재 보유: ${holders.length}명${holders.length ? `\n${holders.slice(0, 20).map((member) => `<@${member}>`).join(' ')}` : ''}`)], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(managementId('org', 'roleeditone', binding.id, owner)).setLabel('수정').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(managementId('org', 'roleholders', binding.id, owner)).setLabel('현재 보유자 보기').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(managementId('org', 'roledelete', binding.id, owner)).setLabel('삭제').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(id('roles')).setLabel('뒤로').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(id('open')).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary))
  ] };
}
