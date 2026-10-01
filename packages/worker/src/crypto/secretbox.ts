import { fromBase64Url, fromUtf8, randomBytes, toBase64Url, utf8 } from './encoding';

const IV_BYTES = 12;

async function importKey(keyBase64Url: string, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const raw = fromBase64Url(keyBase64Url);
  if (raw.length !== 32) {
    throw new Error('TOTP_MASTER_KEY must decode to exactly 32 bytes (base64url).');
  }
  return crypto.subtle.importKey('raw', raw as unknown as ArrayBufferView, 'AES-GCM', false, [
    usage,
  ]);
}

/** AES-GCM envelope: `<iv>.<ciphertext>`, both base64url. */
export async function seal(plaintext: string, keyBase64Url: string): Promise<string> {
  const key = await importKey(keyBase64Url, 'encrypt');
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBufferView },
    key,
    utf8(plaintext) as unknown as ArrayBufferView,
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function open(sealed: string, keyBase64Url: string): Promise<string> {
  const [ivPart, ciphertextPart] = sealed.split('.');
  if (!ivPart || !ciphertextPart) throw new Error('Malformed sealed value.');
  const key = await importKey(keyBase64Url, 'decrypt');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) as unknown as ArrayBufferView },
    key,
    fromBase64Url(ciphertextPart) as unknown as ArrayBufferView,
  );
  return fromUtf8(new Uint8Array(plaintext));
}
