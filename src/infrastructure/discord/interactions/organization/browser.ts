import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Organization } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { paginationRow } from '../core/panel-state.js';

export interface OrganizationBrowserItem { organization: Organization; summary: string }

export function organizationBrowser(items: readonly OrganizationBrowserItem[], owner: string, requestedPage = 0) {
  const page = pageOf(items, requestedPage, 25);
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(managementId('org', 'listopen', page.page, owner)).setPlaceholder('관리할 조직 선택').addOptions(
      page.items.map(({ organization, summary }) => new StringSelectMenuOptionBuilder().setLabel(organization.name.slice(0, 100)).setDescription(summary.slice(0, 100)).setValue(String(organization.id)))
    )
  ));
  components.push(paginationRow('org', 'list', 0, page.page, page.pages, owner));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'create', page.page, owner)).setLabel(items.length ? '새 조직 만들기' : '첫 조직 만들기').setStyle(ButtonStyle.Primary)
  ));
  return { embeds: [new EmbedBuilder().setTitle('조직 목록').setDescription(page.items.length ? '조직을 선택해 관리 화면을 여세요.' : '등록된 조직이 없습니다. 아래 버튼으로 첫 조직을 만드세요.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${items.length}개` })], components };
}
