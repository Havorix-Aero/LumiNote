import { test as base, expect, type Page } from '@playwright/test';
import { totp } from './totp';

export const PASSWORD = 'luminote-e2e-passphrase';

/** Number of security questions the account must keep provisioned at all times. */
export const QUESTION_COUNT = 3;

const runSeed = 1 + Math.floor(Math.random() * 200);
let addressSeed = 0;

/**
 * Each test presents its own client address.
 *
 * Local `wrangler dev` never sets `cf-connecting-ip`, so `attachRequestMeta` falls back to
 * `x-forwarded-for`. Giving every test a fresh address keeps the per-IP auth throttles (10
 * registrations per hour) from leaking across tests and between runs, without weakening anything
 * in production — there Cloudflare always sets `cf-connecting-ip`, which takes precedence.
 */
export function isolatedAddress(): Record<string, string> {
  addressSeed += 1;
  return { 'x-forwarded-for': `198.51.${runSeed}.${(addressSeed % 240) + 1}` };
}

/** `test` with the isolated client address already applied to the browser context. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders(isolatedAddress());
    await use(context);
  },
});

let sequence = 0;

/**
 * The local D1 database survives between runs, so every test registers a brand new account rather
 * than depending on seeded data.
 */
export function uniqueUsername(): string {
  sequence += 1;
  return `e2e${Date.now().toString(36)}${sequence}${Math.random().toString(36).slice(2, 6)}`;
}

export interface Account {
  username: string;
  password: string;
  displayName: string;
}

export function newAccount(displayName = '端到端测试'): Account {
  return { username: uniqueUsername(), password: PASSWORD, displayName };
}

export function answerFor(index: number): string {
  return `我的答案 ${index}`;
}

export const usernameField = (page: Page) => page.locator('input[autocomplete="username"]');
export const nicknameField = (page: Page) => page.locator('input[autocomplete="nickname"]');
export const newPasswordField = (page: Page) => page.locator('input[autocomplete="new-password"]');
export const loginPasswordField = (page: Page) =>
  page.locator('input[autocomplete="current-password"]');

/** The note editor, shared by the desktop and mobile layouts. */
export const editor = (page: Page) => page.getByRole('textbox', { name: '笔记内容' });

export const authError = (page: Page) => page.locator('.auth__error');
export const notice = (page: Page) => page.locator('.notice').first();
export const syncFooter = (page: Page) => page.locator('.desktop__footer');

export function greeting(page: Page, account: Account) {
  return page.getByText(`欢迎回来，${account.displayName}`);
}

// ------------------------------------------------------------------ authentication

export async function registerAccount(page: Page, account: Account): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '还没有账号？去注册' }).click();
  await usernameField(page).fill(account.username);
  await nicknameField(page).fill(account.displayName);
  await newPasswordField(page).fill(account.password);
  await page.getByRole('button', { name: '注册并登录' }).click();
  await expect(page.locator('.auth')).toBeHidden();
}

/** Registers and waits for the desktop inspiration centre, which proves the session is live. */
export async function registerOnDesktop(page: Page, account: Account): Promise<void> {
  await registerAccount(page, account);
  await expect(greeting(page, account)).toBeVisible();
}

export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/');
  await usernameField(page).fill(account.username);
  await loginPasswordField(page).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'LumiNote' })).toBeVisible();
}

// ------------------------------------------------------------------ writing

/** Creates a new note from the desktop sidebar and waits for its editor. */
export async function createNote(page: Page): Promise<void> {
  await page.getByRole('button', { name: '新建灵感', exact: true }).click();
  await expect(editor(page)).toBeVisible();
}

/**
 * Inserts text the way an IME would — a single `input` event and no key presses — so the editor's
 * keydown rules (space, Enter, `-`) stay out of the way.
 */
export async function insertText(page: Page, text: string): Promise<void> {
  await page.keyboard.insertText(text);
}

/** Puts the caret at the end of the editor without triggering any input rule. */
export async function focusEditorEnd(page: Page): Promise<void> {
  await editor(page).click();
  await page.keyboard.press('Control+End');
}

/**
 * Waits until the debounced write has reached IndexedDB. The sidebar preview renders from the
 * stored row, so seeing the text there means a later snapshot will capture it too.
 */
export async function waitForPersisted(page: Page, text: string): Promise<void> {
  await expect(page.locator('.note-list__item.is-active .note-list__preview')).toContainText(text);
}

// ------------------------------------------------------------------ server-side checks

export interface ServerNote {
  id: string;
  body: string;
}

/** Reads notes straight from the API using the page's own session cookie. */
export async function serverNotes(page: Page): Promise<ServerNote[]> {
  const response = await page.request.get('/api/v1/notes');
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { notes: ServerNote[] };
  return payload.notes;
}

// ------------------------------------------------------------------ account security

/** Enables TOTP on the settings screen and returns the base32 secret. */
export async function enableTwoFactor(page: Page): Promise<string> {
  await page.getByRole('link', { name: '设置' }).click();
  await page.getByRole('button', { name: '开始设置', exact: true }).click();

  const secret = (await page.locator('.settings__secret code').innerText()).trim();
  await page.getByLabel('验证码').fill(totp(secret));
  await page.getByRole('button', { name: '确认启用', exact: true }).click();
  await expect(notice(page)).toContainText('两步验证已启用');

  return secret;
}

/** Fills the security-question section of the settings screen; returns the chosen prompts. */
export async function setUpSecurityQuestions(page: Page): Promise<string[]> {
  const items = securityQuestionItems(page);
  const prompts: string[] = [];

  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    const item = items.nth(index);
    prompts.push((await item.locator('.questions__option > span').innerText()).trim());
    await item.locator('input[type="checkbox"]').check();
    await item.locator('input.questions__answer').fill(answerFor(index));
  }

  await page.getByRole('button', { name: /保存密保问题/ }).click();
  await expect(notice(page)).toContainText('密保问题已更新');

  return prompts;
}

/** Answers the forced question-reset screen shown after a security-question sign-in. */
export async function completeQuestionReset(page: Page): Promise<void> {
  const items = securityQuestionItems(page);

  for (let index = 0; index < QUESTION_COUNT; index += 1) {
    const item = items.nth(index);
    await item.locator('input[type="checkbox"]').check();
    await item.locator('input.questions__answer').fill(answerFor(index + 10));
  }

  await page.getByRole('button', { name: /保存并继续/ }).click();
}

function securityQuestionItems(page: Page) {
  return page.locator('.questions__catalog > li');
}
