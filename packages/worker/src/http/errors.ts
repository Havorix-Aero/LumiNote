import { ApiError, ERROR_CODES, isApiError, statusForCode } from '@luminote/core';
import type { Context } from 'hono';
import { MissingSecretError } from '../env';
import type { AppEnv } from './context';

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

function body(code: string, message: string, requestId: string, details?: unknown): ErrorBody {
  return {
    error:
      details === undefined ? { code, message, requestId } : { code, message, requestId, details },
  };
}

/** Normalizes anything thrown in a route into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof MissingSecretError) {
    return new ApiError(ERROR_CODES.INTERNAL, '服务端缺少必要配置（secret 未设置）。');
  }
  if (error instanceof Error) {
    return new ApiError(ERROR_CODES.INTERNAL, error.message);
  }
  return new ApiError(ERROR_CODES.INTERNAL, '未知错误');
}

export function errorHandler(error: Error, c: Context<AppEnv>): Response {
  const requestId = c.get('requestId') ?? 'unknown';
  const apiError = toApiError(error);

  if (apiError.status >= 500) {
    console.error(`[${requestId}] ${apiError.code}: ${apiError.message}`, error);
  }

  return new Response(
    JSON.stringify(body(apiError.code, apiError.message, requestId, apiError.details)),
    {
      status: statusForCode(apiError.code),
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  );
}

export function notFoundHandler(c: Context<AppEnv>): Response {
  const requestId = c.get('requestId') ?? 'unknown';
  return new Response(JSON.stringify(body(ERROR_CODES.NOT_FOUND, '接口不存在', requestId)), {
    status: 404,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data ?? null), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init?.headers ?? {}) },
  });
}
