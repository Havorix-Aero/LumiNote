import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/Card';
import { Sheet } from '../components/Sheet';
import { useDebouncedCallback, useDraft } from '../lib/hooks';
import { useLocalNote } from '../lib/notes';
import { deleteLocalNote, saveVersionNow, updateLocalNote } from '../lib/repository';
import { useSettings } from '../lib/settings';
import { runSync } from '../lib/sync';
import { Editor } from '../shared/Editor';
import { KeywordPanel } from '../shared/KeywordPanel';
import { VersionHistory } from '../shared/VersionHistory';

type SheetKind = 'none' | 'versions' | 'keywords' | 'more';

/**
 * The mobile note screen.
 *
 * Everything secondary lives in a sheet so the screen itself is the editor: on a phone, a toolbar
 * per action would cost more than it gives.
 */
export function NoteScreen() {
  const { id } = useParams<{ id: string }>();
  const note = useLocalNote(id);
  const settings = useSettings();
  const navigate = useNavigate();
  const { value: body, setValue: setBody } = useDraft(note?.body, id);
  const [sheet, setSheet] = useState<SheetKind>('none');

  const persist = useDebouncedCallback((next: string) => {
    if (id) void updateLocalNote(id, { body: next });
  }, 500);

  const handleChange = useCallback(
    (next: string) => {
      setBody(next);
      persist(next);
    },
    [persist, setBody],
  );

  if (!note) {
    return (
      <div className="p-4">
        <EmptyState title="这条笔记不存在" description="它可能已经被删除了。" />
      </div>
    );
  }

  return (
    <div className="note-screen flex min-h-full flex-col gap-3 p-4">
      <div className="note-screen__bar flex items-center justify-between gap-2">
        <button
          type="button"
          className="link inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
          onClick={() => navigate('/history')}
        >
          ← 历史
        </button>
        <span
          className={['note-screen__state text-xs', note.dirty ? 'text-caution' : 'text-ok'].join(
            ' ',
          )}
        >
          {note.dirty ? '待同步' : '已同步'}
        </span>
        <button
          type="button"
          className="link inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
          onClick={() => setSheet('more')}
        >
          更多
        </button>
      </div>

      <Editor
        value={body}
        onChange={handleChange}
        preferences={settings.editor}
        autoFocus
        minRows={14}
      />

      <div className="note-screen__toolbar flex items-center gap-2">
        <Button size="lg" variant="ghost" className="flex-1" onClick={() => setSheet('versions')}>
          版本
        </Button>
        <Button size="lg" variant="ghost" className="flex-1" onClick={() => setSheet('keywords')}>
          关键词
        </Button>
        <Button
          size="lg"
          variant="primary"
          className="flex-1"
          onClick={() => {
            void saveVersionNow(note.id).then(() => runSync().catch(() => undefined));
          }}
        >
          存一版
        </Button>
      </div>

      {sheet === 'versions' ? (
        <Sheet title="历史版本" onClose={() => setSheet('none')}>
          <VersionHistory
            noteId={note.id}
            currentBody={body}
            mode="inline"
            onRestored={() => setBody(null)}
          />
        </Sheet>
      ) : null}

      {sheet === 'keywords' ? (
        <Sheet title="关键词" onClose={() => setSheet('none')}>
          <KeywordPanel
            body={body}
            onPick={(term) => {
              const next = `${body}${body.endsWith('\n') || body.length === 0 ? '' : '\n'}${term} `;
              handleChange(next);
              setSheet('none');
            }}
          />
        </Sheet>
      ) : null}

      {sheet === 'more' ? (
        <Sheet title="更多操作" onClose={() => setSheet('none')}>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              block
              onClick={() => {
                void updateLocalNote(note.id, { pinned: !note.pinned });
                setSheet('none');
              }}
            >
              {note.pinned ? '取消置顶' : '置顶这条灵感'}
            </Button>
            <Button
              size="lg"
              block
              variant="danger"
              onClick={() => {
                void deleteLocalNote(note.id).then(() => {
                  void runSync().catch(() => undefined);
                  navigate('/history');
                });
              }}
            >
              删除笔记
            </Button>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
