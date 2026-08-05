import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import type { Organization, Publication } from '../../../database/schema.js';
import { managementId } from '../core/custom-id.js';
import { pageOf } from '../core/pagination.js';
import { formatPublicationStatus, safeDescription, safeLabel } from '../presentation/formatters.js';

export interface PublicationBrowserItem { publication: Publication; organization: Organization; channelName?: string }
export function publicationBrowser(items: readonly PublicationBrowserItem[], owner: string, organizationId: number | null, requestedPage = 0) {
  const page = pageOf(items, requestedPage, 25);
  const components: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];
  if (page.items.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(managementId('pub', 'open', organizationId ?? 0, owner)).setPlaceholder('관리할 게시물 선택').addOptions(
      page.items.map(({ publication, organization, channelName }) => new StringSelectMenuOptionBuilder().setLabel(safeLabel(publication.name)).setValue(String(publication.id))
        .setDescription(safeDescription(`${organization.name} · ${channelName ? `#${channelName}` : '삭제된 채널'} · ${formatPublicationStatus(publication)}`)))
    )
  ));
  if (page.pages > 1) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId('pub', 'list', `${organizationId ?? 0}_${page.page - 1}`, owner)).setLabel('이전').setStyle(ButtonStyle.Secondary).setDisabled(page.page === 0),
    new ButtonBuilder().setCustomId(managementId('pub', 'list', `${organizationId ?? 0}_${page.page + 1}`, owner)).setLabel('다음').setStyle(ButtonStyle.Secondary).setDisabled(page.page + 1 >= page.pages)
  ));
  if (organizationId !== null) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(managementId('org', 'open', organizationId, owner)).setLabel('조직 관리로').setStyle(ButtonStyle.Secondary)));
  return { embeds: [new EmbedBuilder().setTitle(`${organizationId === null ? '서버 전체' : (items[0]?.organization.name ?? '조직')} · 게시물`).setDescription(page.items.length ? '상태와 채널을 확인하고 게시물을 선택하세요.' : '표시할 게시물이 없습니다.').setFooter({ text: `${page.page + 1}/${page.pages} 페이지 · 총 ${items.length}개` })], components };
}
