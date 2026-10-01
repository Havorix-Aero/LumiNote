export interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT?: string;
  /** Mixed into session/device token hashes so a leaked database alone is not enough to forge one. */
  SESSION_PEPPER?: string;
  /** Base64url-encoded 32-byte AES-GCM key protecting TOTP secrets at rest. */
  TOTP_MASTER_KEY?: string;
  LLM_PROVIDER?: string;
  LLM_BASE_URL?: string;
  LLM_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  STT_PROVIDER?: string;
}

export interface Keyring {
  sessionPepper: string;
  totpMasterKey: string;
}

export class MissingSecretError extends Error {
  constructor(name: string) {
    super(
      `Missing required secret "${name}". Set it with \`wrangler secret put ${name}\` for deployed ` +
        `environments, or add it to .dev.vars for local development.`,
    );
    this.name = 'MissingSecretError';
  }
}

export function keyring(env: Env): Keyring {
  const sessionPepper = env.SESSION_PEPPER;
  const totpMasterKey = env.TOTP_MASTER_KEY;
  if (!sessionPepper) throw new MissingSecretError('SESSION_PEPPER');
  if (!totpMasterKey) throw new MissingSecretError('TOTP_MASTER_KEY');
  return { sessionPepper, totpMasterKey };
}

export function isProduction(env: Env): boolean {
  return env.ENVIRONMENT === 'production';
}
