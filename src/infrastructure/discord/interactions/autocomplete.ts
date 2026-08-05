import { and, eq, isNull } from 'drizzle-orm';
import type { AutocompleteInteraction } from 'discord.js';
import type { AppDatabase } from '../../database/client.js';
import { organizations, publications, templates } from '../../database/schema.js';
import { formatPublicationStatus, safeLabel } from './presentation/formatters.js';

export interface AutocompleteChoice { name: string; value: string }
const matches = (query: string, ...values: Array<string | null | undefined>) => values.some((value) => value?.toLocaleLowerCase('ko-KR').includes(query));

export function organizationChoices(db: AppDatabase, guildId: string, focused: string): AutocompleteChoice[] {
  const query = focused.trim().toLocaleLowerCase('ko-KR');
  return db.select().from(organizations).where(and(eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).all()
    .filter((org) => matches(query, org.name, org.key)).slice(0, 25).map((org) => ({ name: safeLabel(`${org.name} · ${org.key}`), value: org.key }));
}
export function templateChoices(db: AppDatabase, guildId: string, focused: string): AutocompleteChoice[] {
  const query = focused.trim().toLocaleLowerCase('ko-KR');
  return db.select({ template: templates, organization: organizations }).from(templates).innerJoin(organizations, eq(organizations.id, templates.organizationId))
    .where(and(eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).all()
    .filter(({ template, organization }) => matches(query, template.name, organization.name, organization.key)).slice(0, 25)
    .map(({ template, organization }) => ({ name: safeLabel(`${template.name} · ${organization.name}`), value: String(template.id) }));
}
export function publicationChoices(db: AppDatabase, guildId: string, focused: string, channelNames: ReadonlyMap<string, string> = new Map()): AutocompleteChoice[] {
  const query = focused.trim().toLocaleLowerCase('ko-KR');
  return db.select({ publication: publications, organization: organizations }).from(publications).innerJoin(organizations, eq(organizations.id, publications.organizationId))
    .where(and(eq(organizations.guildId, guildId), isNull(organizations.deletedAt))).all()
    .filter(({ publication, organization }) => matches(query, publication.name, organization.name, channelNames.get(publication.channelId))).slice(0, 25)
    .map(({ publication }) => ({ name: safeLabel(`${publication.name} · #${channelNames.get(publication.channelId) ?? '삭제된 채널'} · ${formatPublicationStatus(publication)}`), value: String(publication.id) }));
}

export class ManagementAutocompleteController {
  constructor(private readonly db: AppDatabase) {}
  async handle(interaction: AutocompleteInteraction<'cached'>): Promise<void> {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'organization') return interaction.respond(organizationChoices(this.db, interaction.guildId, String(focused.value)));
    if (focused.name === 'target' && interaction.options.getString('scope') === 'organization') return interaction.respond(organizationChoices(this.db, interaction.guildId, String(focused.value)));
    if (focused.name === 'template') return interaction.respond(templateChoices(this.db, interaction.guildId, String(focused.value)));
    if (focused.name === 'publication' || (focused.name === 'target' && interaction.options.getString('scope') === 'publication')) {
      const names = new Map(interaction.guild.channels.cache.map((channel) => [channel.id, channel.name]));
      return interaction.respond(publicationChoices(this.db, interaction.guildId, String(focused.value), names));
    }
    await interaction.respond([]);
  }
}
