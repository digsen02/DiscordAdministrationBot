import { DateTime } from 'luxon';
import { Liquid } from 'liquidjs';
import { ApplicationError } from '../../app/errors/application-error.js';

export interface MentionAllowList { userIds: ReadonlySet<string>; roleIds: ReadonlySet<string> }
export interface RenderOptions { timeZone: string; mentions: MentionAllowList; maxLength?: number }

function asDateTime(value: unknown, zone: string): DateTime | null {
  if (value instanceof Date) return DateTime.fromJSDate(value, { zone });
  if (typeof value === 'string') {
    const parsed = DateTime.fromISO(value, { zone });
    return parsed.isValid ? parsed : null;
  }
  return null;
}

export class TemplateRenderer {
  private readonly engine: Liquid;
  constructor() {
    this.engine = new Liquid({ strictFilters: true, strictVariables: false, dynamicPartials: false, cache: false });
    this.engine.registerFilter('date_short', (value: unknown, zone = 'Asia/Seoul') => asDateTime(value, String(zone))?.toFormat('yy.MM.dd') ?? '');
    this.engine.registerFilter('date_long', (value: unknown, zone = 'Asia/Seoul') => asDateTime(value, String(zone))?.toFormat('yyyy년 MM월 dd일') ?? '');
    this.engine.registerFilter('date_time', (value: unknown, zone = 'Asia/Seoul') => asDateTime(value, String(zone))?.toFormat('yyyy년 MM월 dd일 HH:mm') ?? '');
    this.engine.registerFilter('percentage', (value: unknown, digits = 1) => `${Number(value ?? 0).toFixed(Number(digits))}%`);
    this.engine.registerFilter('number', (value: unknown) => new Intl.NumberFormat('ko-KR').format(Number(value ?? 0)));
    this.engine.registerFilter('join_values', (value: unknown, separator = ', ') => Array.isArray(value) ? value.join(String(separator)) : '');
    this.engine.registerFilter('role_mention', (value: unknown) => /^\d{15,22}$/.test(String(value)) ? `<@&${String(value)}>` : '');
    this.engine.registerFilter('user_mention', (value: unknown) => /^\d{15,22}$/.test(String(value)) ? `<@${String(value)}>` : '');
  }

  validate(content: string): void {
    if (/{%\s*(include|render|layout)\b/i.test(content)) throw new ApplicationError('INVALID_TEMPLATE', '파일을 불러오는 템플릿 태그는 사용할 수 없습니다.');
    try { this.engine.parse(content); } catch (error) {
      throw new ApplicationError('INVALID_TEMPLATE', `템플릿 문법 오류: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async render(content: string, context: Readonly<Record<string, unknown>>, options: RenderOptions): Promise<string> {
    this.validate(content);
    let output: string;
    const zonedContent = content.replace(/\|\s*(date_short|date_long|date_time)(?=\s*(?:\||}}))/g, '$&: timeZone');
    try { output = await this.engine.parseAndRender(zonedContent, { ...context, timeZone: options.timeZone }); }
    catch (error) { throw new ApplicationError('INVALID_TEMPLATE', `템플릿 렌더링 오류: ${error instanceof Error ? error.message : String(error)}`); }
    this.assertSafeMentions(output, options.mentions);
    const limit = options.maxLength ?? 2000;
    if (output.length > limit) throw new ApplicationError('OUTPUT_TOO_LONG', `렌더링 결과가 Discord 메시지 제한(${limit}자)을 초과했습니다. 현재 ${output.length}자입니다.`);
    return output;
  }

  private assertSafeMentions(output: string, allow: MentionAllowList): void {
    if (/@everyone|@here/i.test(output)) throw new ApplicationError('INVALID_TEMPLATE', '@everyone 및 @here 멘션은 사용할 수 없습니다.');
    for (const match of output.matchAll(/<@([!&]?)(\d{15,22})>/g)) {
      const kind = match[1]; const id = match[2];
      if (!id || (kind === '&' ? !allow.roleIds.has(id) : !allow.userIds.has(id))) {
        throw new ApplicationError('INVALID_TEMPLATE', '저장된 역할 또는 실제 역할 보유자에서 생성되지 않은 멘션이 포함되어 있습니다.');
      }
    }
  }
}
