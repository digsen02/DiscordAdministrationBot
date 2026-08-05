export type ErrorCode =
  | 'NOT_FOUND' | 'DUPLICATE_KEY' | 'ROLE_NOT_FOUND' | 'MISSING_PERMISSION'
  | 'INVALID_TERM_TRANSITION' | 'MULTIPLE_ACTIVE_TERMS' | 'INVALID_TEMPLATE'
  | 'OUTPUT_TOO_LONG' | 'PUBLICATION_DELETED' | 'CLASSIFICATION_CONFLICT'
  | 'INVALID_FIELD_VALUE' | 'VALIDATION_ERROR'
  | 'FORUM_TAG_MISSING' | 'FORUM_TAG_LIMIT_EXCEEDED' | 'FORUM_REQUIRES_TAG'
  | 'FORUM_TITLE_EMPTY' | 'FORUM_SETTINGS_MISSING' | 'FORUM_THREAD_LOCKED'
  | 'FORUM_SETTING_UPDATE_FAILED';

export class ApplicationError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'ApplicationError';
  }
}

export function userMessage(error: unknown): string {
  if (error instanceof ApplicationError) return error.message;
  return '처리 중 예상하지 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}
