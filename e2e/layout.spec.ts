import { expect } from '@playwright/test';
import { greeting, newAccount, registerOnDesktop, test } from './support';

test.describe('桌面端布局', () => {
  test('默认进入灵感中心，并给出三条建议操作', async ({ page }) => {
    const account = newAccount('布局检查');
    await registerOnDesktop(page, account);

    await expect(page.locator('.desktop')).toBeVisible();
    await expect(greeting(page, account)).toBeVisible();
    await expect(page.locator('.inspiration__greeting')).toContainText('想做点什么？');

    await expect(page.getByRole('button', { name: '新建笔记' })).toBeVisible();
    await expect(page.getByRole('button', { name: '打开笔记历史' })).toBeVisible();
    await expect(page.getByRole('button', { name: '继续最近一条' })).toBeDisabled();
  });

  test('没有笔记时，侧栏给出引导而不是空白', async ({ page }) => {
    await registerOnDesktop(page, newAccount('空状态'));
    await expect(page.locator('.note-list__empty')).toBeVisible();
  });

  test('设置里可以把界面强制切换为移动端', async ({ page }) => {
    await registerOnDesktop(page, newAccount('布局切换'));

    await page.getByRole('link', { name: '设置' }).click();
    await page.getByLabel('界面布局').selectOption('mobile');

    await expect(page.locator('.mobile')).toBeVisible();
    await expect(page.locator('.desktop')).toBeHidden();
  });
});
