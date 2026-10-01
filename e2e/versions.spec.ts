import { expect } from '@playwright/test';
import {
  createNote,
  editor,
  focusEditorEnd,
  insertText,
  newAccount,
  registerOnDesktop,
  serverNotes,
  syncFooter,
  test,
  waitForPersisted,
} from './support';

const FIRST = '第一版：做一个灵感导向的笔记本';
const SECOND = '\n第二版：再加上语音转写';

test.describe('版本历史', () => {
  test('保存版本 → 修改 → 查看 diff → 恢复，恢复会新增版本', async ({ page }) => {
    await registerOnDesktop(page, newAccount('版本历史'));
    await createNote(page);

    await focusEditorEnd(page);
    await insertText(page, FIRST);
    await waitForPersisted(page, FIRST);

    await page.getByRole('button', { name: '保存版本', exact: true }).click();
    await expect(page.locator('.versions')).toBeVisible();
    await expect(page.locator('.versions__item')).toHaveCount(1);
    await expect(page.locator('.versions__item')).toContainText('手动保存');

    await focusEditorEnd(page);
    await insertText(page, SECOND);
    await waitForPersisted(page, '第二版：再加上语音转写');
    await expect(page.locator('.diff__summary')).toContainText('+1');

    await page.getByRole('button', { name: '恢复此版本', exact: true }).click();
    await expect(page.locator('.notice')).toContainText('已恢复到所选版本');
    await expect(editor(page)).toHaveValue(FIRST);

    // The restore is appended, never rewritten: the manual version, an auto snapshot of the
    // discarded text, and the restore marker itself.
    await expect(page.locator('.versions__item')).toHaveCount(3);
  });

  test('恢复后的内容会同步到服务器', async ({ page }) => {
    await registerOnDesktop(page, newAccount('版本同步'));
    await createNote(page);
    const noteId = new URL(page.url()).pathname.split('/').pop() ?? '';

    await focusEditorEnd(page);
    await insertText(page, FIRST);
    await waitForPersisted(page, FIRST);

    await page.getByRole('button', { name: '保存版本', exact: true }).click();
    await focusEditorEnd(page);
    await insertText(page, SECOND);
    await waitForPersisted(page, '第二版：再加上语音转写');

    await page.getByRole('button', { name: '恢复此版本', exact: true }).click();
    await expect(editor(page)).toHaveValue(FIRST);

    await page.getByRole('button', { name: '立即同步', exact: true }).click();
    await expect(syncFooter(page)).not.toContainText('待同步');

    await expect
      .poll(async () => (await serverNotes(page)).find((note) => note.id === noteId)?.body ?? '')
      .toBe(FIRST);
  });
});
