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

const OFFLINE_IDEA = '断网时想到的点子：离线也必须能记';

test.describe('离线优先', () => {
  test('断网时写下的内容会留在本机，联网后同步到服务器', async ({ page, context }) => {
    await registerOnDesktop(page, newAccount('离线优先'));
    await createNote(page);

    await context.setOffline(true);
    await expect(syncFooter(page)).toContainText('离线');

    await focusEditorEnd(page);
    await insertText(page, OFFLINE_IDEA);
    await waitForPersisted(page, OFFLINE_IDEA);

    // The note is fully usable from IndexedDB while the network is down.
    await expect(editor(page)).toHaveValue(OFFLINE_IDEA);
    await expect(page.locator('.note-list__item.is-active')).toContainText(OFFLINE_IDEA);

    await context.setOffline(false);
    await expect(syncFooter(page)).toContainText('已连接');

    await page.getByRole('button', { name: '立即同步', exact: true }).click();
    await expect(syncFooter(page)).not.toContainText('待同步');

    await expect
      .poll(async () => (await serverNotes(page)).some((note) => note.body.includes(OFFLINE_IDEA)))
      .toBe(true);
  });

  test('离线时在页面之间来回切换，草稿依然在', async ({ page, context }) => {
    await registerOnDesktop(page, newAccount('草稿留存'));
    await createNote(page);

    await context.setOffline(true);
    await focusEditorEnd(page);
    await insertText(page, OFFLINE_IDEA);
    await waitForPersisted(page, OFFLINE_IDEA);

    // Client-side navigation keeps working offline because every screen reads from IndexedDB.
    await page.getByRole('link', { name: '灵感中心' }).click();
    await expect(page.locator('.inspiration')).toBeVisible();

    await page.locator('.note-list__item').first().click();
    await expect(editor(page)).toHaveValue(OFFLINE_IDEA);
  });
});
