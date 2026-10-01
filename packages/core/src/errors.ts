/** Machine-readable API error codes. Clients switch on these, never on the message. */
export const ERROR_CODES = {
  BAD_REQUEST: 'bad_request',
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  ACCOUNT_LOCKED: 'account_locked',
  TWO_FA_REQUIRED: 'two_fa_required',
  TWO_FA_INVALID: 'two_fa_invalid',
  RECOVERY_UNAVAILABLE: 'recovery_unavailable',
  RECOVERY_INVALID: 'recovery_invalid',
  QUESTIONS_RESET_REQUIRED: 'questions_reset_required',
  INTERNAL: 'internal',
  NOT_IMPLEMENTED: 'not_implemented',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ERROR_CODES.BAD_REQUEST]: 400,
  [ERROR_CODES.VALIDATION_FAILED]: 422,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.ACCOUNT_LOCKED]: 423,
  [ERROR_CODES.TWO_FA_REQUIRED]: 401,
  [ERROR_CODES.TWO_FA_INVALID]: 401,
  [ERROR_CODES.RECOVERY_UNAVAILABLE]: 409,
  [ERROR_CODES.RECOVERY_INVALID]: 401,
  [ERROR_CODES.QUESTIONS_RESET_REQUIRED]: 403,
  [ERROR_CODES.INTERNAL]: 500,
  [ERROR_CODES.NOT_IMPLEMENTED]: 501,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = statusForCode(code);
    this.details = details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
