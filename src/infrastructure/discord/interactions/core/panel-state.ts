import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { InteractionArea } from './custom-id.js';
import { managementId } from './custom-id.js';

export interface TargetPage { id: number; page: number }

export function targetPage(target: string | number, fallbackPage = 0): TargetPage {
  const [rawId, rawPage] = String(target).split('_');
  const id = Number(rawId); const page = rawPage === undefined ? fallbackPage : Number(rawPage);
  return { id, page: Number.isInteger(page) && page >= 0 ? page : fallbackPage };
}

export function pageTarget(id: string | number, page: number): string { return `${id}_${Math.max(0, Math.trunc(page))}`; }

export function paginationRow(area: InteractionArea, action: string, id: string | number, page: number, pages: number, owner: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId(area, action, pageTarget(id, page - 1), owner)).setLabel('이전').setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(managementId(area, 'noop', pageTarget(id, page), owner)).setLabel(`${page + 1}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(managementId(area, action, pageTarget(id, page + 1), owner)).setLabel('다음').setStyle(ButtonStyle.Secondary).setDisabled(page + 1 >= pages)
  );
}
