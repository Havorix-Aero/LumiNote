import { expect } from '@playwright/test';
import {
  PASSWORD,
  answerFor,
  authError,
  completeQuestionReset,
  enableTwoFactor,
  greeting,
  isolatedAddress,
  loginPasswordField,
  newAccount,
  registerOnDesktop,
  setUpSecurityQuestions,
  signIn,
  signOut,
  test,
  usernameField,
} from './support';
import { totp } from './totp';

test.describe('账户流程', () => {
  test('注册后进入灵感中心，退出后还能用同一账号登录', async ({ page }) => {
    const account = newAccount('灵感测试员');
    await registerOnDesktop(page, account);

    await signOut(page);

    await signIn(page, account);
    await expect(greeting(page, account)).toBeVisible();
  });

  test('密码错误时给出提示且不进入应用', async ({ page }) => {
    const account = newAccount('密码错误');
    await registerOnDesktop(page, account);
    await signOut(page);

    await signIn(page, { ...account, password: `${PASSWORD}-wrong` });
    await expect(authError(page)).toContainText('用户名或密码不正确');
    await expect(page.locator('.auth')).toBeVisible();
  });
});

test.describe('两步验证', () => {
  test('开启后，新设备必须输入动态验证码', async ({ page, browser }) => {
    const account = newAccount('两步验证');
    await registerOnDesktop(page, account);
    const secret = await enableTwoFactor(page);

    const origin = new URL(page.url()).origin;
    const otherDevice = await browser.newContext({ extraHTTPHeaders: isolatedAddress() });

    try {
      const other = await otherDevice.newPage();
      await other.goto(origin);
      await usernameField(other).fill(account.username);
      await loginPasswordField(other).fill(account.password);
      await other.getByRole('button', { name: '登录', exact: true }).click();

      const codeField = other.locator('input[autocomplete="one-time-code"]');
      await expect(codeField).toBeVisible();
      await codeField.fill(totp(secret));
      await other.getByRole('button', { name: '验证并登录' }).click();

      await expect(greeting(other, account)).toBeVisible();
    } finally {
      await otherDevice.close();
    }
  });

  test('新设备可用密保问题登录，并被强制重设全部密保问题', async ({ page, browser }) => {
    const account = newAccount('密保恢复');
    await registerOnDesktop(page, account);
    await enableTwoFactor(page);
    const prompts = await setUpSecurityQuestions(page);

    const origin = new URL(page.url()).origin;
    const otherDevice = await browser.newContext({ extraHTTPHeaders: isolatedAddress() });

    try {
      const other = await otherDevice.newPage();
      await other.goto(origin);
      await usernameField(other).fill(account.username);
      await loginPasswordField(other).fill(account.password);
      await other.getByRole('button', { name: '登录', exact: true }).click();

      await other.getByRole('button', { name: '无法使用验证器？用密保问题登录' }).click();

      const prompt = (await other.locator('.auth__question').innerText()).trim();
      const index = prompts.indexOf(prompt);
      expect(index, '恢复时展示的问题必须是已设置的问题之一').toBeGreaterThanOrEqual(0);

      await other.getByLabel('你的答案').fill(answerFor(index));
      await other.getByRole('button', { name: '使用密保问题登录' }).click();

      // Recovery lands on a non-skippable reset screen, and the workspace stays locked until it is done.
      await expect(other.getByRole('heading', { name: '重设密保问题' })).toBeVisible();
      const blocked = await other.request.get(`${origin}/api/v1/notes`);
      expect(blocked.status()).toBe(403);

      await completeQuestionReset(other);
      await expect(greeting(other, account)).toBeVisible();

      const allowed = await other.request.get(`${origin}/api/v1/notes`);
      expect(allowed.ok()).toBeTruthy();
    } finally {
      await otherDevice.close();
    }
  });
});
