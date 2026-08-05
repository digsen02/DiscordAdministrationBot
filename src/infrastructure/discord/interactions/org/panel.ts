import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import type { Organization } from '../../../database/schema.js';
import { customId } from '../core/custom-id.js';

const button = (label: string, action: string, orgId: number, owner: string, style = ButtonStyle.Secondary) =>
  new ButtonBuilder().setCustomId(customId('org', action, orgId, owner)).setLabel(label).setStyle(style);

export function organizationPanel(organization: Organization, owner: string, counts: { roles: number; classifications: number; fields: number; publications: number; term?: string }): { embeds: EmbedBuilder[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } {
  const embed = new EmbedBuilder().setTitle(`${organization.name} 관리`).setDescription(organization.description || '설명이 없습니다.')
    .addFields(
      { name: '기본 정보', value: `키: \`${organization.key}\`` },
      { name: '현재 임기', value: counts.term ?? '없음', inline: true },
      { name: '구성', value: `역할 ${counts.roles} · 분류 ${counts.classifications} · 필드 ${counts.fields} · 게시물 ${counts.publications}`, inline: true }
    );
  return { embeds: [embed], components: [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      button('기본 정보', 'info', organization.id, owner), button('역할', 'roles', organization.id, owner),
      button('분류', 'classes', organization.id, owner), button('사용자 정의 필드', 'fields', organization.id, owner)
    ),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      button('임기', 'term', organization.id, owner), button('게시물', 'publications', organization.id, owner),
      button('삭제', 'delete', organization.id, owner, ButtonStyle.Danger)
    )
  ] };
}
