import { TOTP_DIGITS, TOTP_PERIOD_SECONDS, TOTP_WINDOW } from '@luminote/core';
import { fromBase32, randomBytes, toBase32 } from './encoding';

const SECRET_BYTES = 20; // 160 bits, the size RFC 4226 recommends for HMAC-SHA1.

export function generateTotpSecret(): string {
  return toBase32(randomBytes(SECRET_BYTES));
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBufferView,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    message as unknown as ArrayBufferView,
  );
  return new Uint8Array(signature);
}

/** RFC 6238 TOTP code for a given counter value. */
export async function totpForCounter(secretBase32: string, counter: number): Promise<string> {
  const key = fromBase32(secretBase32);
  const message = new Uint8Array(8);
  let remaining = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
  const digest = await hmacSha1(key, message);
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary =
    (((digest[offset] as number) & 0x7f) << 24) |
    (((digest[offset + 1] as number) & 0xff) << 16) |
    (((digest[offset + 2] as number) & 0xff) << 8) |
    ((digest[offset + 3] as number) & 0xff);
  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

export async function totpAt(
  secretBase32: string,
  timestampMs: number = Date.now(),
  periodSeconds: number = TOTP_PERIOD_SECONDS,
): Promise<string> {
  return totpForCounter(secretBase32, Math.floor(timestampMs / 1000 / periodSeconds));
}

/**
 * Verifies a submitted TOTP code, tolerating `window` steps of clock drift in either direction.
 * Accepts codes with or without the customary grouping space.
 */
export async function verifyTotp(
  secretBase32: string,
  code: string,
  options?: { timestampMs?: number; window?: number; periodSeconds?: number },
): Promise<boolean> {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(normalized)) return false;
  const timestampMs = options?.timestampMs ?? Date.now();
  const window = options?.window ?? TOTP_WINDOW;
  const periodSeconds = options?.periodSeconds ?? TOTP_PERIOD_SECONDS;
  const counter = Math.floor(timestampMs / 1000 / periodSeconds);
  let matched = false;
  for (let offset = -window; offset <= window; offset++) {
    const candidate = await totpForCounter(secretBase32, counter + offset);
    matched = constantTimeCodeEqual(candidate, normalized) || matched;
  }
  return matched;
}

function constantTimeCodeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** otpauth:// URI for authenticator apps. */
export function totpUri(secretBase32: string, username: string, issuer = 'LumiNote'): string {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
