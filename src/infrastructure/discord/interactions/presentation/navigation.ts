import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { managementId, type InteractionArea } from '../core/custom-id.js';

export function backRow(area: InteractionArea, action: string, target: string | number, owner: string, label = '뒤로') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(managementId(area, action, target, owner)).setLabel(label).setStyle(ButtonStyle.Secondary)
  );
}
