import { resolve } from 'node:path';
import { ChannelFlags, ChannelType, Collection, DiscordAPIError, type Client, type Guild } from 'discord.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it, vi } from 'vitest';
import { PublicationService } from '../src/app/services/publication-service.js';
import { createDatabase } from '../src/infrastructure/database/client.js';
import { forumPublicationSettings, guildConfigs, organizations, publications, templates } from '../src/infrastructure/database/schema.js';

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

function forumFixture(options: { requiredTag?: boolean; configuredTags?: string[]; availableTags?: string[]; preserveManualTags?: boolean } = {}) {
  const { db, sqlite } = createDatabase(':memory:'); migrate(db, { migrationsFolder: resolve('./drizzle') });
  db.insert(guildConfigs).values({ guildId: '100000000000000001' }).run();
  const org = db.insert(organizations).values({ guildId: '100000000000000001', key: 'forum', name: '포럼 조직' }).returning().get();
  const template = db.insert(templates).values({ organizationId: org.id, name: '본문', content: '{{ organization.name }} 본문' }).returning().get();
  const publication = db.insert(publications).values({ organizationId: org.id, templateId: template.id, name: '포럼 게시', channelId: '100000000000000020' }).returning().get();
  db.insert(forumPublicationSettings).values({ publicationId: publication.id, titleTemplate: '{{ organization.name }} 제목', appliedTagIdsJson: options.configuredTags ?? ['200000000000000001', '200000000000000002'], autoArchiveDuration: 4320, slowmodeSeconds: 30, preserveManualTags: options.preserveManualTags ?? false }).run();
  const starterEdit = vi.fn(async () => undefined); const starter = { id: '300000000000000001', author: { id: '100000000000000009' }, edit: starterEdit };
  const threadEdit = vi.fn(async () => undefined);
  const thread = { id: '300000000000000000', locked: false, archived: false, appliedTags: ['200000000000000003'], fetchStarterMessage: vi.fn(async () => starter), messages: { fetch: vi.fn(async () => starter) }, edit: threadEdit };
  const createThread = vi.fn(async () => thread); const fetchThread = vi.fn(async () => thread);
  const availableTagIds = options.availableTags ?? ['200000000000000001', '200000000000000002', '200000000000000003'];
  const channel = { id: '100000000000000020', type: ChannelType.GuildForum, availableTags: availableTagIds.map((id, index) => ({ id, name: `태그 ${index + 1}`, moderated: false, emoji: null })), flags: { has: (flag: ChannelFlags) => Boolean(options.requiredTag) && flag === ChannelFlags.RequireTag }, defaultAutoArchiveDuration: 1440, defaultThreadRateLimitPerUser: 0, threads: { create: createThread, fetch: fetchThread } };
  const guild = { channels: { cache: new Collection([['100000000000000020', channel]]), fetch: vi.fn(async () => channel) }, members: { fetch: vi.fn(async () => undefined), cache: new Collection() }, roles: { cache: new Collection() } } as unknown as Guild;
  const client = { user: { id: '100000000000000009' }, guilds: { cache: new Collection([['100000000000000001', guild]]) } } as unknown as Client;
  return { db, sqlite, publication, service: new PublicationService(db, client), createThread, fetchThread, starterEdit, threadEdit, thread };
}

describe('포럼 게시 서비스', () => {
  it('선택한 여러 태그 ID와 스레드 설정으로 게시하고 두 Discord ID를 저장한다', async () => {
    const f = forumFixture(); await f.service.refresh(f.publication.id);
    expect(f.createThread).toHaveBeenCalledWith(expect.objectContaining({ name: '포럼 조직 제목', appliedTags: ['200000000000000001', '200000000000000002'], autoArchiveDuration: 4320, rateLimitPerUser: 30 }));
    expect(f.db.query.publications.findFirst().sync()?.messageId).toBe('300000000000000001');
    const settings = f.db.query.forumPublicationSettings.findFirst().sync(); expect(settings?.threadId).toBe('300000000000000000'); expect(settings?.appliedTagIdsJson).toEqual(['200000000000000001', '200000000000000002']); f.sqlite.close();
  });

  it('삭제된 태그를 제외하고 진단을 반환한다', async () => {
    const f = forumFixture({ configuredTags: ['200000000000000001', '299999999999999999'], availableTags: ['200000000000000001'] }); const result = await f.service.refresh(f.publication.id);
    expect(f.createThread).toHaveBeenCalledWith(expect.objectContaining({ appliedTags: ['200000000000000001'] })); expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'FORUM_TAG_MISSING' })])); f.sqlite.close();
  });

  it('설정 태그가 5개를 넘으면 앞의 유효한 5개만 적용하고 진단한다', async () => {
    const tagIds = Array.from({ length: 6 }, (_, index) => `20000000000000000${index + 1}`); const f = forumFixture({ configuredTags: tagIds, availableTags: tagIds }); const result = await f.service.refresh(f.publication.id);
    expect(f.createThread).toHaveBeenCalledWith(expect.objectContaining({ appliedTags: tagIds.slice(0, 5) })); expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'FORUM_TAG_LIMIT_EXCEEDED' })])); f.sqlite.close();
  });

  it('태그 필수 포럼에서 모든 설정 태그가 사라졌으면 게시하지 않는다', async () => {
    const f = forumFixture({ requiredTag: true, configuredTags: ['299999999999999999'], availableTags: ['200000000000000001'] });
    await expect(f.service.refresh(f.publication.id)).rejects.toMatchObject({ code: 'FORUM_REQUIRES_TAG', message: expect.stringContaining('적어도 하나') }); expect(f.createThread).not.toHaveBeenCalled(); f.sqlite.close();
  });

  it('새로고침에서 제목, 슬로우모드와 자동 보관 시간을 업데이트한다', async () => {
    const f = forumFixture(); await f.service.refresh(f.publication.id); f.db.update(forumPublicationSettings).set({ titleTemplate: '{{ organization.name }} 새 제목', slowmodeSeconds: 90, autoArchiveDuration: 10080 }).run();
    await f.service.refresh(f.publication.id); expect(f.starterEdit).toHaveBeenCalledWith(expect.objectContaining({ content: '포럼 조직 본문' })); expect(f.threadEdit).toHaveBeenLastCalledWith(expect.objectContaining({ name: '포럼 조직 새 제목', rateLimitPerUser: 90, autoArchiveDuration: 10080 })); f.sqlite.close();
  });

  it.each([{ preserve: true, expected: ['200000000000000001', '200000000000000003'] }, { preserve: false, expected: ['200000000000000001'] }])('수동 태그 보존 설정이 $preserve이면 태그 집합을 알맞게 갱신한다', async ({ preserve, expected }) => {
    const f = forumFixture({ configuredTags: ['200000000000000001'], preserveManualTags: preserve }); await f.service.refresh(f.publication.id); await f.service.refresh(f.publication.id);
    expect(f.threadEdit).toHaveBeenLastCalledWith(expect.objectContaining({ appliedTags: expected })); f.sqlite.close();
  });

  it('게시 후 보관과 잠금 설정을 최초 게시 뒤 적용한다', async () => {
    const f = forumFixture(); f.db.update(forumPublicationSettings).set({ archiveAfterPublish: true, lockAfterPublish: true }).run(); await f.service.refresh(f.publication.id);
    expect(f.threadEdit).toHaveBeenCalledWith({ archived: true, locked: true }); f.sqlite.close();
  });
});
