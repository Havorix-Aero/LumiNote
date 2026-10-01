import { expect } from '@playwright/test';
import { createNote, editor, insertText, newAccount, registerOnDesktop, test } from './support';

test.describe('编辑器输入规则', () => {
  test.beforeEach(async ({ page }) => {
    await registerOnDesktop(page, newAccount('输入规则'));
    await createNote(page);
  });

  test('短句后的空格变成逗号，按一次退格还原为空格', async ({ page }) => {
    await editor(page).click();
    await insertText(page, '你好');
    await page.keyboard.press('Space');
    await expect(editor(page)).toHaveValue('你好，');

    await page.keyboard.press('Backspace');
    await expect(editor(page)).toHaveValue('你好 ');
  });

  test('长句后的空格变成句号', async ({ page }) => {
    await editor(page).click();
    await insertText(page, '今天想到了一个很棒的灵感方向');
    await page.keyboard.press('Space');
    await expect(editor(page)).toHaveValue('今天想到了一个很棒的灵感方向。');
  });

  test('回车会自动空一行，保持段落可读', async ({ page }) => {
    await editor(page).click();
    await insertText(page, '第一段');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveValue('第一段\n\n');
  });

  test('输入 “-” 加空格进入列表，回车继续列表项', async ({ page }) => {
    await editor(page).click();
    await page.keyboard.press('-');
    await expect(editor(page)).toHaveValue('-');

    await page.keyboard.press('Space');
    await expect(editor(page)).toHaveValue('- ');

    await insertText(page, '第一点');
    await page.keyboard.press('Enter');
    await expect(editor(page)).toHaveValue('- 第一点\n- ');
  });

  test('输入会在本地留下草稿，并在侧栏出现标题预览', async ({ page }) => {
    await editor(page).click();
    await insertText(page, '灵感标题应该自动从第一行生成');
    await expect(page.locator('.note-list__item.is-active .note-list__title')).toContainText(
      '灵感标题应该自动从第一行生成',
    );
  });
});
