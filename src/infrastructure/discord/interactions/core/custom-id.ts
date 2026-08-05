import { ApplicationError } from '../../../../app/errors/application-error.js';

export type InteractionArea = 'org' | 'term' | 'tpl' | 'pub' | 'diag' | 'help';
export interface ParsedCustomId { area: InteractionArea; version: 1; action: string; target: string; owner: string }

const PART = /^[A-Za-z0-9_-]{1,32}$/;

export function customId(area: InteractionArea, action: string, target: string | number, owner: string): string {
  const parts = [area, 'v1', action, String(target), owner];
  if (!parts.every((part) => PART.test(part))) throw new ApplicationError('VALIDATION_ERROR', '상호작용 식별자를 만들 수 없습니다.');
  const value = parts.join(':');
  if (value.length > 100) throw new ApplicationError('VALIDATION_ERROR', '상호작용 식별자가 Discord 제한을 초과했습니다.');
  return value;
}

export function parseCustomId(value: string): ParsedCustomId {
  const parts = value.split(':');
  if (parts.length !== 5 || !parts.every((part) => PART.test(part))) throw new ApplicationError('VALIDATION_ERROR', '잘못되었거나 오래된 상호작용입니다.');
  const [area, version, action, target, owner] = parts;
  if (!['org', 'term', 'tpl', 'pub', 'diag', 'help'].includes(area!) || version !== 'v1') throw new ApplicationError('VALIDATION_ERROR', '지원하지 않는 상호작용 버전입니다.');
  return { area: area as InteractionArea, version: 1, action: action!, target: target!, owner: owner! };
}

export function assertOwner(parsed: ParsedCustomId, userId: string): void {
  if (parsed.owner !== userId) throw new ApplicationError('MISSING_PERMISSION', '다른 관리자가 연 패널은 조작할 수 없습니다.');
}
