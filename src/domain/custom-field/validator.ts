import { DateTime } from 'luxon';
import { ApplicationError } from '../../app/errors/application-error.js';

export type FieldType = 'text' | 'multiline_text' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'role' | 'channel';
export interface FieldDefinition { key: string; label: string; type: FieldType; required: boolean; selectOptions?: readonly string[] | null }

export function validateFieldValue(definition: FieldDefinition, raw: string | null): string | null {
  const value = raw?.trim() ?? '';
  if (!value) {
    if (definition.required) throw new ApplicationError('INVALID_FIELD_VALUE', `${definition.label} 값은 필수입니다.`);
    return null;
  }
  let valid = true;
  switch (definition.type) {
    case 'number': valid = Number.isFinite(Number(value)); break;
    case 'date': valid = DateTime.fromISO(value, { setZone: true }).isValid && /^\d{4}-\d{2}-\d{2}$/.test(value); break;
    case 'datetime': valid = DateTime.fromISO(value, { setZone: true }).isValid; break;
    case 'boolean': valid = ['true', 'false'].includes(value); break;
    case 'select': valid = definition.selectOptions?.includes(value) ?? false; break;
    case 'role': case 'channel': valid = /^\d{15,22}$/.test(value); break;
    default: valid = value.length <= (definition.type === 'multiline_text' ? 4000 : 1000);
  }
  if (!valid) throw new ApplicationError('INVALID_FIELD_VALUE', `${definition.label} 값이 ${definition.type} 형식에 맞지 않습니다.`);
  return value;
}
