import { PBKDF2_HASH, PBKDF2_ITERATIONS, PBKDF2_KEY_BITS, PBKDF2_SALT_BYTES } from '@luminote/core';
import { fromBase64Url, randomBytes, toBase64Url, utf8 } from './encoding';

export const PASSWORD_ALGO = 'pbkdf2-sha256';

export interface StoredPassword {
  passwordHash: string;
  algo: string;
  paramsJson: string;
}

interface PasswordParams {
  iterations: number;
  hash: string;
  saltBytes: number;
  keyBits: number;
}

async function derive(
  password: string,
  salt: Uint8Array,
  params: PasswordParams,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBufferView,
      iterations: params.iterations,
      hash: params.hash,
    },
    keyMaterial,
    params.keyBits,
  );
  return new Uint8Array(bits);
}

/**
 * Hashes a password with PBKDF2-SHA256.
 *
 * The iteration count and salt travel with the credential, so parameters can be raised later and
 * old hashes verified (and transparently re-hashed on the next successful login).
 */
export async function hashPassword(
  password: string,
  overrides?: Partial<PasswordParams>,
): Promise<StoredPassword> {
  const params: PasswordParams = {
    iterations: overrides?.iterations ?? PBKDF2_ITERATIONS,
    hash: overrides?.hash ?? PBKDF2_HASH,
    saltBytes: overrides?.saltBytes ?? PBKDF2_SALT_BYTES,
    keyBits: overrides?.keyBits ?? PBKDF2_KEY_BITS,
  };
  const salt = randomBytes(params.saltBytes);
  const derived = await derive(password, salt, params);
  return {
    passwordHash: toBase64Url(derived),
    algo: PASSWORD_ALGO,
    paramsJson: JSON.stringify({ ...params, salt: toBase64Url(salt) }),
  };
}

export async function verifyPassword(
  password: string,
  stored: { passwordHash: string; algo: string; paramsJson: string },
): Promise<boolean> {
  if (stored.algo !== PASSWORD_ALGO) return false;
  let raw: unknown;
  try {
    raw = JSON.parse(stored.paramsJson);
  } catch {
    return false;
  }
  const params = raw as PasswordParams & { salt?: string };
  if (!params.salt) return false;
  const derived = await derive(password, fromBase64Url(params.salt), {
    iterations: params.iterations,
    hash: params.hash,
    saltBytes: params.saltBytes,
    keyBits: params.keyBits,
  });
  const expected = fromBase64Url(stored.passwordHash);
  if (expected.length !== derived.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= (expected[i] as number) ^ (derived[i] as number);
  return diff === 0;
}

/** True when a stored credential was produced with weaker parameters than we now use. */
export function needsRehash(stored: { algo: string; paramsJson: string }): boolean {
  if (stored.algo !== PASSWORD_ALGO) return true;
  try {
    const params = JSON.parse(stored.paramsJson) as PasswordParams;
    return params.iterations < PBKDF2_ITERATIONS || params.keyBits < PBKDF2_KEY_BITS;
  } catch {
    return true;
  }
}
