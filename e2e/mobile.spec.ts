import { expect } from '@playwright/test';
import { editor, insertText, newAccount, registerAccount, test } from './support';

const SCREEN_DIR = 'test-results/screens';

test.describe('移动端', () => {
  test('打开就是一张空白纸，写下第一个字立刻进入笔记', async ({ page }) => {
    const account = newAccount('移动端');
    await registerAccount(page, account);

    await expect(page.locator('.mobile')).toBeVisible();
    await expect(page.locator('.desktop')).toBeHidden();
    await expect(page.locator('.capture')).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/mobile-01-capture.png` });

    await editor(page).click();
    await insertText(page, '在手机上随手记下的灵感');

    await expect(page).toHaveURL(/\/n\//);
    await expect(page.locator('.note-screen')).toBeVisible();
    await expect(editor(page)).toHaveValue('在手机上随手记下的灵感');

    await page.screenshot({ path: `${SCREEN_DIR}/mobile-02-note.png` });
  });

  test('历史在独立页面，版本历史以底部抽屉打开', async ({ page }) => {
    await registerAccount(page, newAccount('移动端历史'));

    await editor(page).click();
    await insertText(page, '第一条移动端灵感');
    await expect(page.locator('.note-screen')).toBeVisible();

    await page.getByRole('link', { name: '历史' }).click();
    await expect(page.locator('.history')).toBeVisible();
    await expect(page.locator('.note-list__item')).toHaveCount(1);
    await page.screenshot({ path: `${SCREEN_DIR}/mobile-03-history.png` });

    await page.locator('.note-list__item').first().click();
    await expect(page.locator('.note-screen')).toBeVisible();

    await page.getByRole('button', { name: '版本', exact: true }).click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.getByRole('heading', { name: '历史版本' })).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/mobile-04-version-sheet.png` });

    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('.sheet')).toBeHidden();
  });

  test('“我的”页面保留账号与写作偏好设置', async ({ page }) => {
    const account = newAccount('移动端设置');
    await registerAccount(page, account);

    await page.getByRole('link', { name: /我的/ }).click();

    await expect(page.locator('.mobile-settings')).toBeVisible();
    await expect(page.locator('.mobile-settings')).toContainText(`@${account.username}`);
    await expect(page.getByLabel('换行自动空一行')).toBeVisible();
    await expect(page.getByLabel('空格自动转标点')).toBeVisible();

    await page.screenshot({ path: `${SCREEN_DIR}/mobile-05-settings.png` });
  });
});
