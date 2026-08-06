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
import { organizationBrowser } from '../src/infrastructure/discord/interactions/organization/browser.js';
import { classificationBrowser, classificationOptionDetail } from '../src/infrastructure/discord/interactions/organization/classifications.js';
import { fieldDetail } from '../src/infrastructure/discord/interactions/organization/fields.js';
import { roleBrowser, roleDetail } from '../src/infrastructure/discord/interactions/organization/roles.js';
import { formatDraft, formatPublicationStatus, formatTermStatus } from '../src/infrastructure/discord/interactions/presentation/formatters.js';
import { publicationBrowser } from '../src/infrastructure/discord/interactions/publication/browser.js';
import { publicationPanel } from '../src/infrastructure/discord/interactions/publication/panel.js';
import { templateBrowser } from '../src/infrastructure/discord/interactions/template/browser.js';
import { templatePanel } from '../src/infrastructure/discord/interactions/template/panel.js';
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
    expect(unpublished).toContain('저장하고 게시'); expect(unpublished).not.toContain('게시물 열기'); expect(unpublished).not.toContain('기존 게시물에 다시 연결');
    const broken = JSON.stringify(publicationPanel({ ...base, messageId: '30', broken: true }, 'owner', { forum: false }));
    expect(broken).toContain('지금 갱신'); expect(broken).toContain('게시물 열기'); expect(broken).toContain('연결 상태 다시 검사'); expect(broken).toContain('기존 게시물에 다시 연결'); expect(broken).toContain('새 게시물 생성'); expect(broken).toContain('자동 갱신 끄기');
  });

  it('게시물 브라우저와 역할·분류 화면은 이름, 인원, 뒤로 가기를 제공한다', () => {
    const organization = { id: 1, guildId: 'g', key: 'reichstag', name: '국민의회', foreignName: null, pronunciation: null, description: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() };
    const publication = { id: 19, organizationId: 1, templateId: 2, name: '공식 현황', channelId: '20', messageId: '30', autoRefresh: true, broken: false, lastRenderedAt: null, lastRenderError: null, createdAt: new Date(), updatedAt: new Date() };
    const pubJson = JSON.stringify(publicationBrowser([{ publication, organization, channelName: '국회-게시판' }], 'owner', 1));
    expect(pubJson).toContain('공식 현황'); expect(pubJson).toContain('#국회-게시판'); expect(pubJson).toContain('정상'); expect(pubJson).not.toContain('publication ID');
    const binding = { id: 4, organizationId: 1, key: 'president', displayName: '의장', discordRoleId: '50', kind: 'office' as const, cardinality: 'one' as const, required: true, displayOrder: 0, createdAt: new Date(), updatedAt: new Date() };
    const rolesJson = JSON.stringify(roleBrowser('국민의회', 1, [binding], 'owner', new Map([['50', 1]])));
    expect(rolesJson).toContain('현재 1명'); expect(rolesJson).toContain('역할 추가'); expect(rolesJson).toContain('조직 관리로');
    const classification = { id: 7, organizationId: 1, key: 'party', displayName: '정당', baseRoleKey: 'member', exclusive: true, allowUnassigned: true, unassignedLabel: '미지정', capacityFieldKey: null, displayOrder: 0, createdAt: new Date(), updatedAt: new Date() };
    const classJson = JSON.stringify(classificationBrowser('국민의회', 1, [classification], 'owner', new Map([[7, 3]])));
    expect(classJson).toContain('선택지 3개'); expect(classJson).toContain('분류 선택'); expect(classJson).toContain('조직 관리로');
  });

  it('임기 패널은 현재 상태에서 유효한 작업만 표시한다', () => {
    const base = { id: 1, organizationId: 1, termNumber: 1, displayName: '제1기', startAt: new Date(), scheduledEndAt: null, actualEndAt: null, endReason: null, createdAt: new Date(), updatedAt: new Date() };
    const active = JSON.stringify(termPanel('국민의회', 1, { ...base, status: 'active' }, 'owner'));
    expect(active).toContain('일시 중지'); expect(active).not.toContain('재개'); expect(active).not.toContain('toISOString');
    const paused = JSON.stringify(termPanel('국민의회', 1, { ...base, status: 'suspended' }, 'owner'));
    expect(paused).toContain('재개'); expect(paused).not.toContain('term:v2:pause');
    const scheduled = JSON.stringify(termPanel('국민의회', 1, { ...base, status: 'scheduled' }, 'owner'));
    expect(scheduled).toContain('지금 시작'); expect(scheduled).toContain('예약 취소'); expect(scheduled).not.toContain('일시 중지');
    const empty = JSON.stringify(termPanel('국민의회', 1, undefined, 'owner'));
    expect(empty).toContain('새 임기 시작'); expect(empty).toContain('과거 임기 보기');
  });

  it('25개를 넘는 조직과 게시물 목록을 실제 페이지로 나눈다', () => {
    const organizations = Array.from({ length: 31 }, (_, index) => ({ id: index + 1, guildId: 'g', key: `org-${index}`, name: `조직 ${index + 1}`, foreignName: null, pronunciation: null, description: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() }));
    const first = organizationBrowser(organizations.map((organization) => ({ organization, summary: '정상' })), 'owner', 0);
    const second = organizationBrowser(organizations.map((organization) => ({ organization, summary: '정상' })), 'owner', 1);
    expect(first.components[0]!.toJSON().components[0]).toMatchObject({ options: expect.any(Array) });
    expect(JSON.stringify(first)).toContain('1/2'); expect(JSON.stringify(second)).toContain('조직 31'); expect(JSON.stringify(second)).not.toContain('조직 1\"');
  });

  it('템플릿·게시물 상세에서 원래 브라우저 페이지를 유지한다', () => {
    const template = { id: 12, organizationId: 1, name: '현황', content: '본문', isDraft: false, createdAt: new Date(), updatedAt: new Date() };
    expect(JSON.stringify(templatePanel(template, '국민의회', 'owner', 0, undefined, 3))).toContain('12_3');
    const publication = { id: 19, organizationId: 1, templateId: 12, name: '공식 현황', channelId: '20', messageId: '30', autoRefresh: true, broken: false, lastRenderedAt: null, lastRenderError: null, createdAt: new Date(), updatedAt: new Date() };
    expect(JSON.stringify(publicationPanel(publication, 'owner', { forum: false, targetExists: true, browserPage: 2 }))).toContain('19_2');
  });

  it('필수 역할 공백과 삭제된 Discord 역할을 실제 보유 상태로 표시한다', () => {
    const binding = { id: 4, organizationId: 1, key: 'president', displayName: '의장', discordRoleId: '50', kind: 'office' as const, cardinality: 'one' as const, required: true, displayOrder: 0, createdAt: new Date(), updatedAt: new Date() };
    const vacant = JSON.stringify(roleDetail('국민의회', 1, binding, 'owner', [], 0, true));
    const deleted = JSON.stringify(roleDetail('국민의회', 1, binding, 'owner', [], 0, false));
    expect(vacant).toContain('필수 역할이 공석입니다'); expect(deleted).toContain('삭제된 Discord 역할');
  });

  it('사용자 정의 필드와 분류 선택지에서 정의·역할 수정 경로를 제공한다', () => {
    const field = { id: 9, organizationId: 1, key: 'capacity', label: '정원', scope: 'term' as const, type: 'number' as const, required: true, displayOrder: 2, selectOptions: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() };
    const fieldJson = JSON.stringify(fieldDetail('국민의회', 1, { field, value: '30' }, 'owner'));
    expect(fieldJson).toContain('현재 값'); expect(fieldJson).toContain('정의 수정'); expect(fieldJson).toContain('삭제');
    const classification = { id: 7, organizationId: 1, key: 'party', displayName: '정당', baseRoleKey: 'member', exclusive: true, allowUnassigned: true, unassignedLabel: '미지정', capacityFieldKey: null, displayOrder: 0, createdAt: new Date(), updatedAt: new Date() };
    const choice = { id: 8, classificationId: 7, key: 'a', displayName: 'A당', discordRoleId: '50', displayOrder: 0, customIconUrl: null, createdAt: new Date(), updatedAt: new Date() };
    expect(JSON.stringify(classificationOptionDetail('국민의회', classification, choice, 'owner', 0, 0, 3, true))).toContain('Discord 역할 변경');
  });

  it('빈 템플릿·게시물 목록에 즉시 시작 동작을 표시한다', () => {
    expect(JSON.stringify(templateBrowser([], 'owner', 1))).toContain('첫 템플릿 만들기');
    expect(JSON.stringify(publicationBrowser([], 'owner', 1))).toContain('게시물 만들기');
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
