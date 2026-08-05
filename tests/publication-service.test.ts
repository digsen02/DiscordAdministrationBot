import { resolve } from 'node:path';
import { Collection, DiscordAPIError, type Client, type Guild } from 'discord.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it, vi } from 'vitest';
import { PublicationService } from '../src/app/services/publication-service.js';
import { createDatabase } from '../src/infrastructure/database/client.js';
import { guildConfigs, organizations, publications, templates } from '../src/infrastructure/database/schema.js';

function fixture(deleted = false) {
  const { db, sqlite } = createDatabase(':memory:'); migrate(db, { migrationsFolder: resolve('./drizzle') });
  db.insert(guildConfigs).values({ guildId: '100000000000000001' }).run(); const org = db.insert(organizations).values({ guildId: '100000000000000001', key: 'example', name: '예시' }).returning().get();
  const template = db.insert(templates).values({ organizationId: org.id, name: '기본', content: '{{ organization.name }}' }).returning().get(); const publication = db.insert(publications).values({ organizationId: org.id, templateId: template.id, name: '게시', channelId: '100000000000000002' }).returning().get();
  const edit = vi.fn(async () => undefined); const send = vi.fn(async () => ({ id: '100000000000000003' }));
  const fetchMessage = vi.fn(async () => { if (deleted) throw new DiscordAPIError({ message: 'Unknown Message', code: 10008 }, 10008, 404, 'GET', '/messages/x', { body: null, files: undefined }); return { author: { id: '100000000000000009' }, edit }; });
  const channel = { send, messages: { fetch: fetchMessage }, isSendable: () => true };
  const guild = { channels: { cache: new Collection([['100000000000000002', channel]]), fetch: vi.fn(async () => channel) }, members: { fetch: vi.fn(async () => undefined), cache: new Collection() }, roles: { cache: new Collection() } } as unknown as Guild;
  const client = { user: { id: '100000000000000009' }, guilds: { cache: new Collection([['100000000000000001', guild]]) } } as unknown as Client;
  return { db, sqlite, publication, service: new PublicationService(db, client), send, edit };
}

describe('게시 서비스', () => {
  it('최초 게시 후 같은 메시지를 수정한다', async () => { const f = fixture(); await f.service.refresh(f.publication.id); expect(f.send).toHaveBeenCalledOnce(); await f.service.refresh(f.publication.id); expect(f.edit).toHaveBeenCalledOnce(); expect(f.db.query.publications.findFirst().sync()?.messageId).toBe('100000000000000003'); f.sqlite.close(); });
  it('삭제된 메시지를 감지해 broken 상태로 기록한다', async () => { const f = fixture(true); f.db.update(publications).set({ messageId: '100000000000000003' }).run(); await expect(f.service.refresh(f.publication.id)).rejects.toMatchObject({ code: 'PUBLICATION_DELETED' }); expect(f.db.query.publications.findFirst().sync()?.broken).toBe(true); f.sqlite.close(); });
  it('repair가 대체 메시지를 만들고 broken 상태를 해제한다', async () => { const f = fixture(); f.db.update(publications).set({ messageId: 'old', broken: true }).run(); await f.service.refresh(f.publication.id, true); expect(f.send).toHaveBeenCalledOnce(); expect(f.db.query.publications.findFirst().sync()?.broken).toBe(false); f.sqlite.close(); });
});
