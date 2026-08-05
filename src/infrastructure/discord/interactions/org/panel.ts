import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import type { Organization } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';

export interface OrganizationDashboardCounts {
  roles: number; requiredRoleVacancies?: number; classifications: number; classificationOptions?: number;
  fields: number; publications: number; brokenPublications?: number; templates?: number; draftTemplates?: number; term?: string;
}
export function organizationPanel(organization: Organization, owner: string, counts: OrganizationDashboardCounts): { embeds: EmbedBuilder[]; components: ActionRowBuilder<MessageActionRowComponentBuilder>[] } {
  const status = [
    `📝 기본 정보 · ${organization.description ? '설명 설정됨' : '설명 필요'}`,
    `👥 역할 및 직책 · ${counts.roles}개 연결${counts.requiredRoleVacancies ? `, 필수 직책 ${counts.requiredRoleVacancies}개 공석` : ''}`,
    `🗂️ 구성원 분류 · ${counts.classifications}개 분류, 선택지 ${counts.classificationOptions ?? 0}개`,
    `📋 추가 정보 · 필드 ${counts.fields}개`,
    `📅 현재 임기 · ${counts.term ?? '진행 중인 임기 없음'}`,
    `📄 템플릿 · 사용 가능 ${(counts.templates ?? 0) - (counts.draftTemplates ?? 0)}개, 초안 ${counts.draftTemplates ?? 0}개`,
    `📣 게시물 · ${counts.publications}개${counts.brokenPublications ? `, ${counts.brokenPublications}개 확인 필요` : ' 정상'}`
  ].join('\n');
  const sections = new StringSelectMenuBuilder().setCustomId(managementId('org', 'section', organization.id, owner)).setPlaceholder('관리할 영역 선택').addOptions(
    [['기본 정보', 'info'], ['역할 및 직책', 'roles'], ['구성원 분류', 'classes'], ['추가 정보', 'fields'], ['임기', 'term'], ['템플릿', 'templates'], ['게시물', 'publications'], ['고급 관리', 'advanced']]
      .map(([label, value]) => new StringSelectMenuOptionBuilder().setLabel(label!).setValue(value!))
  );
  const recommended = counts.requiredRoleVacancies ? ['역할 연결 확인', 'roles'] : (counts.templates ?? 0) === 0 ? ['첫 템플릿 만들기', 'templates'] : counts.brokenPublications ? ['게시물 오류 확인', 'publications'] : ['설정 상태 새로고침', 'open'];
  return { embeds: [new EmbedBuilder().setTitle(`조직 관리 · ${organization.name}`).setDescription(organization.description || '설명이 없습니다.').addFields({ name: '설정 상태', value: status })], components: [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(sections),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(managementId('org', recommended[1]!, organization.id, owner)).setLabel(recommended[0]!).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(managementId('org', 'preview', organization.id, owner)).setLabel('조직 미리보기').setStyle(ButtonStyle.Secondary)
    )
  ] };
}
