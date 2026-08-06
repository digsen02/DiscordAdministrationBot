import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Organization } from '../../../database/schema.js';
import type { templates } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { pageTarget, paginationRow } from '../core/panel-state.js';
import { formatDraft, safeDescription, safeLabel } from '../presentation/formatters.js';

type Template = typeof templates.$inferSelect;
export interface TemplateBrowserItem { template: Template; organization: Organization; publicationCount: number }

export function templateBrowser(items: readonly TemplateBrowserItem[], owner: string, organizationId: number | null, requestedPage = 0) {
  const page = pageOf(items, requestedPage, 25);
  const scope = organizationId === null ? '서버 전체' : (items[0]?.organization.name ?? '조직');
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(managementId('tpl', 'open', pageTarget(organizationId ?? 0, page.page), owner)).setPlaceholder('관리할 템플릿 선택').addOptions(
      page.items.map(({ template, organization, publicationCount }) => new StringSelectMenuOptionBuilder()
        .setLabel(safeLabel(template.name)).setValue(String(template.id))
        .setDescription(safeDescription(`${organization.name} · ${formatDraft(template.isDraft)} · 게시물 ${publicationCount}개에서 사용`)))
    )
  ));
  components.push(paginationRow('tpl', 'list', organizationId ?? 0, page.page, page.pages, owner));
  if (organizationId !== null) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('tpl', 'new', `${organizationId}_${page.page}`, owner)).setLabel(items.length ? '새 템플릿 만들기' : '첫 템플릿 만들기').setStyle(ButtonStyle.Primary)
  ));
  if (organizationId !== null) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary)
  ));
  return { embeds: [new EmbedBuilder().setTitle(`${scope} · 템플릿`).setDescription(page.items.length ? '이름과 상태를 확인하고 관리할 템플릿을 선택하세요.' : '표시할 템플릿이 없습니다.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${items.length}개` })], components };
}
