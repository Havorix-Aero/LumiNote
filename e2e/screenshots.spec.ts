import { expect } from '@playwright/test';
import {
  createNote,
  focusEditorEnd,
  insertText,
  newAccount,
  registerOnDesktop,
  test,
  waitForPersisted,
} from './support';

const SCREEN_DIR = 'test-results/screens';

const BODY = [
  '做一个灵感导向的笔记本，先记下来再想清楚。',
  '语音随手录下来，事后自动转写。',
  '选中关键词生成词云，再和 AI 讨论可行性。',
].join('\n\n');

/**
 * Captures the desktop surfaces into `test-results/screens` so styling can be reviewed without a
 * manual click-through. Not an assertion-heavy spec — it exists to make the UI visible.
 */
test.describe('界面截图', () => {
  test('捕获桌面端主要界面', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.auth')).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/desktop-00-login.png` });

    await registerOnDesktop(page, newAccount('截图'));
    await page.screenshot({ path: `${SCREEN_DIR}/desktop-01-inspiration.png` });

    await createNote(page);
    await focusEditorEnd(page);
    await insertText(page, BODY);
    await waitForPersisted(page, '做一个灵感导向的笔记本');
    await page.screenshot({ path: `${SCREEN_DIR}/desktop-02-note.png` });

    await page.getByRole('button', { name: '保存版本', exact: true }).click();
    await focusEditorEnd(page);
    await insertText(page, '\n\n第二版：再加上语音转写与关键词词云。');
    await waitForPersisted(page, '第二版');
    await page.screenshot({ path: `${SCREEN_DIR}/desktop-03-version-diff.png` });

    await page.getByRole('link', { name: '设置' }).click();
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/desktop-04-settings.png` });
  });
});
