import type { ButtonInteraction, ChannelSelectMenuInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, RoleSelectMenuInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { PublicationService } from '../../../app/services/publication-service.js';
import type { AppDatabase } from '../../database/client.js';
import type { RefreshQueue } from '../../scheduler/refresh-queue.js';
import { ManagementInteractionController } from './controller.js';

type ComponentInteraction = ButtonInteraction<'cached'> | StringSelectMenuInteraction<'cached'> | RoleSelectMenuInteraction<'cached'> | ChannelSelectMenuInteraction<'cached'>;

/** Thin interaction entrypoint. Domain rendering and operations live in their domain modules/controller. */
export class ManagementInteractionRouter {
  private readonly controller: ManagementInteractionController;
  constructor(db: AppDatabase, publications: PublicationService, queue: RefreshQueue) { this.controller = new ManagementInteractionController(db, publications, queue); }
  supportsCommand(name: string): boolean { return this.controller.supportsCommand(name); }
  handleCommand(interaction: ChatInputCommandInteraction<'cached'>): Promise<void> { return this.controller.handleCommand(interaction); }
  handleComponent(interaction: ComponentInteraction): Promise<boolean> { return this.controller.handleComponent(interaction); }
  handleModal(interaction: ModalSubmitInteraction<'cached'>): Promise<boolean> { return this.controller.handleModal(interaction); }
}
