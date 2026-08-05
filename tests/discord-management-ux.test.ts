import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import { commands } from '../src/infrastructure/discord/commands.js';
import { createDatabase } from '../src/infrastructure/database/client.js';
import { guildConfigs, organizations, publications, templates } from '../src/infrastructure/database/schema.js';
import { organizationChoices, publicationChoices, templateChoices } from '../src/infrastructure/discord/interactions/autocomplete.js';
import { assertOwner, customId, managementId, parseCustomId } from '../src/infrastructure/discord/interactions/core/custom-id.js';
import { DISCORD_LIMITS, pageOf, truncateMessage } from '../src/infrastructure/discord/interactions/core/pagination.js';
import { organizationPanel } from '../src/infrastructure/discord/interactions/org/panel.js';
import { classificationBrowser } from '../src/infrastructure/discord/interactions/organization/classifications.js';
import { roleBrowser } from '../src/infrastructure/discord/interactions/organization/roles.js';
import { formatDraft, formatPublicationStatus, formatTermStatus } from '../src/infrastructure/discord/interactions/presentation/formatters.js';
import { publicationBrowser } from '../src/infrastructure/discord/interactions/publication/browser.js';
import { publicationPanel } from '../src/infrastructure/discord/interactions/publication/panel.js';
import { templateBrowser } from '../src/infrastructure/discord/interactions/template/browser.js';
import { termPanel } from '../src/infrastructure/discord/interactions/term/panel.js';

const option = (commandName: string, subcommandName: string, optionName: string) => {
  const command = commands.find((entry) => entry.name === commandName)!;
  const subcommand = command.options?.find((entry) => entry.name === subcommandName);
  return subcommand && 'options' in subcommand ? subcommand.options?.find((entry) => entry.name === optionName) : undefined;
};

describe('Discord 관리 UX', () => {
  it('관리 명령에서 원시 ID 입력을 제거하고 자동완성을 등록한다', () => {
    expect(option('template', 'manage', 'template')).toBeUndefined();
    expect(option('template', 'manage', 'organization')).toMatchObject({ required: false, autocomplete: true });
    expect(option('template', 'preview', 'template')).toMatchObject({ autocomplete: true });
    expect(option('publication', 'create', 'template')).toBeUndefined();
    expect(option('publication', 'manage', 'publication')).toBeUndefined();
    expect(option('publication', 'manage', 'organization')).toMatchObject({ required: false, autocomplete: true });
    expect(option('publication', 'refresh', 'publication')).toMatchObject({ autocomplete: true });
  });

  it('v2 custom ID를 사용하면서 v1 패널도 호환하고 소유자를 검증한다', () => {
    expect(customId('org', 'roles', 42, '123456789')).toBe('org:v1:roles:42:123456789');
    const value = managementId('tpl', 'open', 7, '123456789');
    expect(parseCustomId(value)).toMatchObject({ area: 'tpl', version: 2, action: 'open', target: '7' });
    expect(() => assertOwner(parseCustomId(value), 'other')).toThrow();
    expect(() => parseCustomId('org:v3:roles:42:123456789')).toThrow();
  });

  it('조직 첫 화면에 템플릿 상태가 있고 삭제는 노출하지 않는다', () => {
    const org = { id: 1, guildId: 'g', key: 'reichstag', name: '국민의회', foreignName: null, pronunciation: null, description: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
    const panel = organizationPanel(org, 'owner', { roles: 2, classifications: 1, classificationOptions: 3, fields: 6, publications: 1, templates: 2, draftTemplates: 1, term: '시험 임기' });
    const json = JSON.stringify(panel);
    expect(json).toContain('템플릿'); expect(json).toContain('사용 가능 1개'); expect(json).toContain('고급 관리');
    expect(json).not.toContain('조직 삭제');
  });

  it('템플릿 브라우저는 이름·상태를 표시하고 ID는 option value로만 사용한다', () => {
    const organization = { id: 1, guildId: 'g', key: 'reichstag', name: '국민의회', foreignName: null, pronunciation: null, description: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
    const rows = Array.from({ length: 26 }, (_, index) => ({ template: { id: index + 10, organizationId: 1, name: `현황 ${index + 1}`, content: '본문', isDraft: index === 0, createdAt: new Date(), updatedAt: new Date() }, organization, publicationCount: index }));
    const panel = templateBrowser(rows, 'owner', 1, 0); const json = JSON.stringify(panel);
    expect(json).toContain('현황 1'); expect(json).toContain('초안'); expect(json).toContain('다음'); expect(json).not.toContain('템플릿 ID');
    const firstRow = panel.components[0]?.toJSON().components[0];
    expect(firstRow && 'options' in firstRow ? firstRow.options : []).toHaveLength(25);
  });

  it('게시물 상세는 상태에 맞는 버튼과 복구 작업만 표시한다', () => {
    const base = { id: 1, organizationId: 1, templateId: 1, name: '공식 현황', channelId: '20', messageId: null, autoRefresh: true, broken: false, lastRenderedAt: null, lastRenderError: null, createdAt: new Date(), updatedAt: new Date() };
    const unpublished = JSON.stringify(publicationPanel(base, 'owner', { forum: false, organizationName: '국민의회', templateName: '현황' }));
    expect(unpublished).toContain('저장하고 게시'); expect(unpublished).not.toContain('게시물 열기'); expect(unpublished).not.toContain('연결 복구');
    const broken = JSON.stringify(publicationPanel({ ...base, messageId: '30', broken: true }, 'owner', { forum: false }));
    expect(broken).toContain('지금 갱신'); expect(broken).toContain('게시물 열기'); expect(broken).toContain('연결 복구'); expect(broken).toContain('자동 갱신 끄기');
  });

  it('게시물 브라우저와 역할·분류 화면은 이름, 인원, 뒤로 가기를 제공한다', () => {
    const organization = { id: 1, guildId: 'g', key: 'reichstag', name: '국민의회', foreignName: null, pronunciation: null, description: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
    const publication = { id: 19, organizationId: 1, templateId: 2, name: '공식 현황', channelId: '20', messageId: '30', autoRefresh: true, broken: false, lastRenderedAt: null, lastRenderError: null, createdAt: new Date(), updatedAt: new Date() };
    const pubJson = JSON.stringify(publicationBrowser([{ publication, organization, channelName: '국회-게시판' }], 'owner', 1));
    expect(pubJson).toContain('공식 현황'); expect(pubJson).toContain('#국회-게시판'); expect(pubJson).toContain('정상'); expect(pubJson).not.toContain('publication ID');
    const binding = { id: 4, organizationId: 1, key: 'president', displayName: '의장', discordRoleId: '50', kind: 'office' as const, cardinality: 'one' as const, required: true, displayOrder: 0, createdAt: new Date(), updatedAt: new Date() };
    const rolesJson = JSON.stringify(roleBrowser('국민의회', 1, [binding], 'owner', new Map([['50', 1]])));
    expect(rolesJson).toContain('현재 1명'); expect(rolesJson).toContain('역할 추가'); expect(rolesJson).toContain('뒤로');
    const classification = { id: 7, organizationId: 1, key: 'party', displayName: '정당', baseRoleKey: 'member', exclusive: true, allowUnassigned: true, unassignedLabel: '미지정', capacityFieldKey: null, displayOrder: 0, createdAt: new Date(), updatedAt: new Date() };
    const classJson = JSON.stringify(classificationBrowser('국민의회', 1, [classification], 'owner', new Map([[7, 3]])));
    expect(classJson).toContain('선택지 3개'); expect(classJson).toContain('분류 선택'); expect(classJson).toContain('뒤로');
  });

  it('임기 패널은 현재 상태에서 유효한 작업만 표시한다', () => {
    const base = { id: 1, organizationId: 1, termNumber: 1, displayName: '제1기', startAt: new Date(), scheduledEndAt: null, actualEndAt: null, endReason: null, createdAt: new Date(), updatedAt: new Date() };
    const active = JSON.stringify(termPanel('국민의회', 1, { ...base, status: 'active' }, 'owner'));
    expect(active).toContain('일시 중지'); expect(active).not.toContain('재개'); expect(active).not.toContain('toISOString');
    const paused = JSON.stringify(termPanel('국민의회', 1, { ...base, status: 'suspended' }, 'owner'));
    expect(paused).toContain('재개'); expect(paused).not.toContain('term:v2:pause');
    const empty = JSON.stringify(termPanel('국민의회', 1, undefined, 'owner'));
    expect(empty).toContain('새 임기 시작'); expect(empty).toContain('과거 임기 보기');
  });

  it('표시 포매터가 enum을 사용자 문구로 변환한다', () => {
    expect(formatTermStatus('active')).toBe('진행 중'); expect(formatTermStatus('suspended')).toBe('일시 중지');
    expect(formatDraft(true)).toBe('초안'); expect(formatPublicationStatus({ messageId: '1', broken: false, lastRenderError: null })).toBe('정상');
  });

  it('자동완성은 guild 범위를 지키고 최대 25개만 반환한다', () => {
    const { db, sqlite } = createDatabase(':memory:'); migrate(db, { migrationsFolder: resolve('./drizzle') });
    db.insert(guildConfigs).values([{ guildId: 'g1' }, { guildId: 'g2' }]).run();
    const first = db.insert(organizations).values({ guildId: 'g1', key: 'reichstag', name: '국민의회' }).returning().get();
    const second = db.insert(organizations).values({ guildId: 'g2', key: 'secret', name: '다른 서버' }).returning().get();
    for (let index = 0; index < 30; index++) db.insert(templates).values({ organizationId: first.id, name: `현황 ${index}`, content: 'x' }).run();
    db.insert(templates).values({ organizationId: second.id, name: '노출 금지', content: 'x' }).run();
    const tpl = db.query.templates.findFirst({ where: (table, { eq }) => eq(table.organizationId, first.id) }).sync()!;
    db.insert(publications).values({ organizationId: first.id, templateId: tpl.id, name: '공식 현황', channelId: 'c1' }).run();
    expect(organizationChoices(db, 'g1', '국민')).toEqual([{ name: '국민의회 · reichstag', value: 'reichstag' }]);
    expect(templateChoices(db, 'g1', '')).toHaveLength(25); expect(JSON.stringify(templateChoices(db, 'g1', ''))).not.toContain('노출 금지');
    expect(publicationChoices(db, 'g1', '공식', new Map([['c1', '국회-게시판']]))[0]).toMatchObject({ value: expect.any(String), name: expect.stringContaining('#국회-게시판') });
    sqlite.close();
  });

  it('Discord 목록 제한을 지킨다', () => {
    const page = pageOf(Array.from({ length: 63 }, (_, index) => index), 99, 100);
    expect(page.items).toHaveLength(13); expect(page.items.length).toBeLessThanOrEqual(DISCORD_LIMITS.selectOptions); expect(truncateMessage('가'.repeat(3000)).length).toBeLessThanOrEqual(DISCORD_LIMITS.messageLength);
  });
});
