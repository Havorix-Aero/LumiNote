/** Identifier and time helpers shared by worker and clients. */

/**
 * Ids must come from a cryptographically secure source in every runtime we target (Workers and
 * modern browsers), but `globalThis.crypto` is not in the ES lib, so it is read defensively rather
 * than assuming a DOM lib is present.
 */
function secureUuid(): string {
  const source = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  if (!source?.randomUUID) {
    throw new Error('No secure random UUID source available in this runtime.');
  }
  return source.randomUUID();
}

export function newId(prefix?: string): string {
  const uuid = secureUuid();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function epochSecondsNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function isoFromEpochSeconds(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

export function epochSecondsFromIso(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}
