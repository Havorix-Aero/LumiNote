/** Shared, environment-agnostic constants. */

/** Minimum password length. Long enough to make PBKDF2 worthwhile, short enough to type on mobile. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 256;

/** PBKDF2 parameters. Stored per-credential so these can be raised without locking users out. */
export const PBKDF2_HASH = 'SHA-256';
export const PBKDF2_ITERATIONS = 210_000;
export const PBKDF2_SALT_BYTES = 16;
export const PBKDF2_KEY_BITS = 256;

/** Session lifetimes (seconds). */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_ABSOLUTE_TTL_SECONDS = 90 * 24 * 60 * 60;

/** Short-lived tokens used mid-login. */
export const CHALLENGE_TTL_SECONDS = 5 * 60;
export const RECOVERY_TOKEN_TTL_SECONDS = 10 * 60;

/** TOTP (RFC 6238). */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
export const TOTP_BACKUP_CODE_COUNT = 10;

/** Security questions. */
export const SECURITY_QUESTION_COUNT = 3;

/** Note version history. */
export const VERSION_RETENTION_DAYS = 90;
/** A new editing session starts when a note has been idle this long. */
export const EDIT_SESSION_IDLE_MS = 5 * 60 * 1000;
export const VERSION_LABEL_MAX_LENGTH = 80;

/** Sync. */
export const SYNC_PAGE_SIZE = 200;
export const NOTE_BODY_MAX_LENGTH = 200_000;
export const NOTE_TITLE_MAX_LENGTH = 200;

/** Login throttling. */
export const LOGIN_MAX_ATTEMPTS_PER_WINDOW = 10;
export const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;
export const ACCOUNT_LOCKOUT_SECONDS = 15 * 60;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const DISPLAY_NAME_MAX_LENGTH = 60;

/** Cookie names. */
export const SESSION_COOKIE = 'luminote_session';
export const CSRF_COOKIE = 'luminote_csrf';
export const DEVICE_COOKIE = 'luminote_device';
export const CSRF_HEADER = 'x-luminote-csrf';
