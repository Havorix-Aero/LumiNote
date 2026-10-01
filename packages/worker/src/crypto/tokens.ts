import { fromBase64Url, randomBytes, toBase64Url, toHex, utf8 } from './encoding';

const TOKEN_BYTES = 32;

/** Generates a fresh 256-bit opaque token. Only its hash is ever persisted. */
export function generateToken(bytes: number = TOKEN_BYTES): string {
  return toBase64Url(randomBytes(bytes));
}

export function generateNumericCode(digits: number): string {
  const bytes = randomBytes(digits);
  let out = '';
  for (let i = 0; i < digits; i++) out += ((bytes[i] as number) % 10).toString();
  return out;
}

/**
 * Hashes a token for storage. The pepper is part of the input, so a database dump alone cannot be
 * used to confirm a guessed token.
 */
export async function hashToken(token: string, pepper: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8(`${pepper}:${token}`));
  return toHex(new Uint8Array(digest));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', utf8(value));
  return toHex(new Uint8Array(digest));
}

/** Compares two hex digests without short-circuiting on the first differing character. */
export function digestMatches(candidate: string, stored: string): boolean {
  const a = utf8(candidate);
  const b = utf8(stored);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

export function decodeKey(raw: string): Uint8Array {
  return fromBase64Url(raw);
}
