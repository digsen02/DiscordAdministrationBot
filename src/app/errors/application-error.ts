export type ErrorCode =
  | 'NOT_FOUND' | 'DUPLICATE_KEY' | 'ROLE_NOT_FOUND' | 'MISSING_PERMISSION'
  | 'INVALID_TERM_TRANSITION' | 'MULTIPLE_ACTIVE_TERMS' | 'INVALID_TEMPLATE'
  | 'OUTPUT_TOO_LONG' | 'PUBLICATION_DELETED' | 'CLASSIFICATION_CONFLICT'
  | 'INVALID_FIELD_VALUE' | 'VALIDATION_ERROR';

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
