import { PBKDF2_HASH, PBKDF2_ITERATIONS, PBKDF2_KEY_BITS, PBKDF2_SALT_BYTES } from '@luminote/core';
import { constantTimeEqual, fromBase64Url, randomBytes, toBase64Url, utf8 } from './encoding';

/**
 * Security answers are typed by humans on phones, so the same answer arrives as
 * "  Blue  ", "blue" and "Ｂｌｕｅ". Normalizing before hashing means the user only has to
 * remember the answer, not the exact keystrokes.
 */
export function normalizeAnswer(answer: string): string {
  return answer.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface AnswerHash {
  hash: string;
  salt: string;
}

/**
 * Answers are a single low-entropy phrase, so they are stretched exactly like passwords rather
 * than stored as a plain digest.
 */
export async function hashAnswer(answer: string, saltBase64Url?: string): Promise<AnswerHash> {
  const salt = saltBase64Url ? fromBase64Url(saltBase64Url) : randomBytes(PBKDF2_SALT_BYTES);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    utf8(normalizeAnswer(answer)) as unknown as ArrayBufferView,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBufferView,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    PBKDF2_KEY_BITS,
  );
  return { hash: toBase64Url(new Uint8Array(bits)), salt: toBase64Url(salt) };
}

export async function verifyAnswer(
  answer: string,
  expectedHash: string,
  saltBase64Url: string,
): Promise<boolean> {
  const candidate = await hashAnswer(answer, saltBase64Url);
  return constantTimeEqual(fromBase64Url(candidate.hash), fromBase64Url(expectedHash));
}
