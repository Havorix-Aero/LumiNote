import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebouncedCallback, useDraft } from '../lib/hooks';
import { useLocalNote } from '../lib/notes';
import { deleteLocalNote, saveVersionNow, updateLocalNote } from '../lib/repository';
import { useSettings } from '../lib/settings';
import { runSync } from '../lib/sync';
import { Editor } from '../shared/Editor';
import { KeywordPanel } from '../shared/KeywordPanel';
import { VersionHistory } from '../shared/VersionHistory';

type Sheet = 'none' | 'versions' | 'keywords' | 'more';

export function NoteScreen() {
  const { id } = useParams<{ id: string }>();
  const note = useLocalNote(id);
  const settings = useSettings();
  const navigate = useNavigate();
  const { value: body, setValue: setBody } = useDraft(note?.body, id);
  const [sheet, setSheet] = useState<Sheet>('none');

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
    return <p className="muted">这条笔记不存在。</p>;
  }

  return (
    <div className="note-screen">
      <div className="note-screen__bar">
        <button type="button" className="link" onClick={() => navigate('/history')}>
          ← 历史
        </button>
        <span className="muted note-screen__state">{note.dirty ? '待同步' : '已同步'}</span>
        <button type="button" className="link" onClick={() => setSheet('more')}>
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

      <div className="note-screen__toolbar">
        <button type="button" className="button button--ghost" onClick={() => setSheet('versions')}>
          版本
        </button>
        <button type="button" className="button button--ghost" onClick={() => setSheet('keywords')}>
          关键词
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            void saveVersionNow(note.id).then(() => runSync().catch(() => undefined));
          }}
        >
          存一版
        </button>
      </div>

      {sheet !== 'none' ? (
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="sheet__panel">
            <div className="sheet__header">
              <h2>
                {sheet === 'versions' && '历史版本'}
                {sheet === 'keywords' && '关键词'}
                {sheet === 'more' && '更多操作'}
              </h2>
              <button type="button" className="link" onClick={() => setSheet('none')}>
                关闭
              </button>
            </div>
            <div className="sheet__body">
              {sheet === 'versions' ? (
                <VersionHistory
                  noteId={note.id}
                  currentBody={body}
                  mode="inline"
                  onRestored={() => setBody(null)}
                />
              ) : null}
              {sheet === 'keywords' ? (
                <KeywordPanel
                  body={body}
                  onPick={(term) => {
                    const next = `${body}${body.endsWith('\n') || body.length === 0 ? '' : '\n'}${term} `;
                    handleChange(next);
                    setSheet('none');
                  }}
                />
              ) : null}
              {sheet === 'more' ? (
                <div className="stack">
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      void updateLocalNote(note.id, { pinned: !note.pinned });
                      setSheet('none');
                    }}
                  >
                    {note.pinned ? '取消置顶' : '置顶这条灵感'}
                  </button>
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => {
                      void deleteLocalNote(note.id).then(() => {
                        void runSync().catch(() => undefined);
                        navigate('/history');
                      });
                    }}
                  >
                    删除笔记
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
