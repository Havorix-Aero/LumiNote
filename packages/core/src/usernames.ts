import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from './constants';

/**
 * The username shape, shared so the login form can reject a bad name locally instead of letting
 * the server answer 422 with a message the user cannot act on.
 *
 * `packages/core/src/schemas/auth.ts` must use the exact same pattern — that one is what actually
 * validates the request.
 */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const USERNAME_RULE_MESSAGE = '用户名只能使用字母、数字、下划线、点和连字符';

/** Returns a user-facing problem description, or `null` when the name is acceptable. */
export function describeUsernameProblem(username: string): string | null {
  const value = username.trim();
  if (value.length === 0) return '请输入用户名';
  if (value.length < USERNAME_MIN_LENGTH) return `用户名至少 ${USERNAME_MIN_LENGTH} 个字符`;
  if (value.length > USERNAME_MAX_LENGTH) return `用户名最多 ${USERNAME_MAX_LENGTH} 个字符`;
  if (!USERNAME_PATTERN.test(value)) return USERNAME_RULE_MESSAGE;
  return null;
}
