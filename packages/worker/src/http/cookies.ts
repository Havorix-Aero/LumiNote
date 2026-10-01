import {
  CSRF_COOKIE,
  DEVICE_COOKIE,
  SESSION_ABSOLUTE_TTL_SECONDS,
  SESSION_COOKIE,
} from '@luminote/core';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { AppEnv } from './context';

export interface CookieContextOptions {
  secure: boolean;
}

export function readCookie(c: Context<AppEnv>, name: string): string | null {
  return getCookie(c, name) ?? null;
}

export function setSessionCookie(
  c: Context<AppEnv>,
  token: string,
  options: CookieContextOptions,
): void {
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: options.secure,
    sameSite: 'Lax',
    maxAge: SESSION_ABSOLUTE_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context<AppEnv>, options: CookieContextOptions): void {
  deleteCookie(c, SESSION_COOKIE, {
    path: '/',
    httpOnly: true,
    secure: options.secure,
    sameSite: 'Lax',
  });
}

/**
 * Double-submit CSRF token: deliberately readable by JavaScript so the SPA can echo it back in a
 * header, which a cross-site attacker cannot set.
 */
export function setCsrfCookie(
  c: Context<AppEnv>,
  token: string,
  options: CookieContextOptions,
): void {
  setCookie(c, CSRF_COOKIE, token, {
    path: '/',
    httpOnly: false,
    secure: options.secure,
    sameSite: 'Lax',
    maxAge: SESSION_ABSOLUTE_TTL_SECONDS,
  });
}

export function clearCsrfCookie(c: Context<AppEnv>, options: CookieContextOptions): void {
  deleteCookie(c, CSRF_COOKIE, {
    path: '/',
    httpOnly: false,
    secure: options.secure,
    sameSite: 'Lax',
  });
}

/** `<deviceId>.<deviceSecret>` — lets the server recognise a returning device before authentication. */
export function setDeviceCookie(
  c: Context<AppEnv>,
  value: string,
  options: CookieContextOptions,
): void {
  setCookie(c, DEVICE_COOKIE, value, {
    path: '/',
    httpOnly: true,
    secure: options.secure,
    sameSite: 'Lax',
    maxAge: 365 * 24 * 60 * 60,
  });
}

export function readDeviceCookie(c: Context<AppEnv>): { deviceId: string; secret: string } | null {
  const raw = readCookie(c, DEVICE_COOKIE);
  if (!raw) return null;
  const separator = raw.indexOf('.');
  if (separator <= 0) return null;
  return { deviceId: raw.slice(0, separator), secret: raw.slice(separator + 1) };
}
