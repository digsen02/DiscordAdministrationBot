import { describe, expect, it } from 'vitest';
import { ApplicationError } from '../src/app/errors/application-error.js';
import { TemplateRenderer } from '../src/infrastructure/template/template-renderer.js';

const renderer = new TemplateRenderer();
const mentions = { userIds: new Set(['200000000000000001']), roleIds: new Set(['100000000000000001']) };
const context = { organization: { name: '예시 조직' }, term: { name: '첫 임기', startDate: new Date('2026-08-01T15:00:00Z') }, fields: { seats: 5 }, roles: { leader: { count: 1, joinedMentions: '<@200000000000000001>' } }, classifications: { group: { groups: [{ displayName: '가', count: 1 }] } } };

describe('안전한 템플릿 렌더러', () => {
  it('조직/임기/필드/역할/분류 루프와 한국 날짜를 렌더링한다', async () => { const output = await renderer.render('{{ organization.name }} {{ term.name }} {{ term.startDate | date_long }} {{ fields.seats }} {{ roles.leader.joinedMentions }}{% for g in classifications.group.groups %} {{ g.displayName }}={{ g.count }}{% endfor %}', context, { timeZone: 'Asia/Seoul', mentions }); expect(output).toContain('예시 조직 첫 임기 2026년 08월 02일 5 <@200000000000000001> 가=1'); });
  it('기본값과 누락값을 처리한다', async () => { await expect(renderer.render('{{ fields.missing | default: "미정" }}', context, { timeZone: 'Asia/Seoul', mentions })).resolves.toBe('미정'); });
  it.each(['@everyone', '@here', '<@999999999999999999>', '<@&999999999999999999>'])('허용되지 않은 멘션 %s을 거부한다', async (content) => { await expect(renderer.render(content, context, { timeZone: 'Asia/Seoul', mentions })).rejects.toBeInstanceOf(ApplicationError); });
  it('include와 잘못된 문법을 거부한다', () => { expect(() => renderer.validate('{% include "secret" %}')).toThrow(); expect(() => renderer.validate('{% if x %}')).toThrow(); });
  it('Discord 길이 제한을 넘으면 자르지 않고 거부한다', async () => { await expect(renderer.render('x'.repeat(2001), context, { timeZone: 'Asia/Seoul', mentions })).rejects.toMatchObject({ code: 'OUTPUT_TOO_LONG' }); });
});
