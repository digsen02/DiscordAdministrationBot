import { describe, expect, it } from 'vitest';
import { commands } from '../src/infrastructure/discord/commands.js';
import { assertOwner, customId, parseCustomId } from '../src/infrastructure/discord/interactions/core/custom-id.js';
import { DISCORD_LIMITS, pageOf, truncateMessage } from '../src/infrastructure/discord/interactions/core/pagination.js';
import { deprecatedCommands } from '../src/infrastructure/discord/interactions/deprecated.js';

describe('새 Discord 명령 UX', () => {
  it('요구된 공개 명령과 하위 명령만 등록한다', () => {
    expect(commands.map((entry) => entry.name)).toEqual(['org', 'term', 'template', 'publication', 'diagnose', 'help']);
    const subcommands = Object.fromEntries(commands.slice(0, 4).map((entry) => [entry.name, entry.options?.map((option) => option.name)]));
    expect(subcommands).toEqual({
      org: ['create', 'manage', 'list'], term: ['start', 'manage', 'history'],
      template: ['create', 'manage', 'preview'], publication: ['create', 'manage', 'refresh']
    });
    expect(commands.flatMap((entry) => entry.options ?? []).map((option) => option.name)).not.toContain('repair');
  });

  it('정상 UTF-8 한국어 라벨을 등록한다', () => {
    const json = JSON.stringify(commands);
    expect(json).toContain('조직을 만들고 관리합니다.');
    expect(json).toContain('통합 진단');
    expect(json).not.toContain('議곗');
  });

  it('버전형 custom ID를 엄격하게 파싱하고 소유자를 확인한다', () => {
    const value = customId('org', 'roles', 42, '123456789');
    expect(value).toBe('org:v1:roles:42:123456789');
    expect(parseCustomId(value)).toMatchObject({ area: 'org', version: 1, action: 'roles', target: '42' });
    expect(() => parseCustomId('org:v2:roles:42:123456789')).toThrow();
    expect(() => parseCustomId('org:v1:roles:42:123:extra')).toThrow();
    expect(() => assertOwner(parseCustomId(value), 'other')).toThrow();
  });

  it('항목 수와 페이지 번호를 Discord 제한 안으로 보정한다', () => {
    const values = Array.from({ length: 63 }, (_, index) => index);
    const page = pageOf(values, 99, 100);
    expect(page.pages).toBe(3);
    expect(page.page).toBe(2);
    expect(page.items).toHaveLength(13);
    expect(page.items.length).toBeLessThanOrEqual(DISCORD_LIMITS.selectOptions);
    expect(truncateMessage('가'.repeat(3000)).length).toBeLessThanOrEqual(DISCORD_LIMITS.messageLength);
  });

  it('레거시 명령을 중앙 매핑에서 새 패널로 안내한다', () => {
    expect(deprecatedCommands['org-role']?.panel).toBe('/org manage → 역할');
    expect(deprecatedCommands['classification-option']?.panel).toContain('분류');
    expect(deprecatedCommands['publication:repair']?.panel).toContain('/publication manage');
  });
});
