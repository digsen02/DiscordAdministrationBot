import { ApplicationError } from '../../app/errors/application-error.js';

export const SAFE_KEY = /^[a-z][a-z0-9_]{1,31}$/;

export function assertSafeKey(value: string): void {
  if (!SAFE_KEY.test(value)) throw new ApplicationError('VALIDATION_ERROR', '내부 키는 영문 소문자로 시작하는 2~32자의 영문 소문자, 숫자, 밑줄만 사용할 수 있습니다.');
}
