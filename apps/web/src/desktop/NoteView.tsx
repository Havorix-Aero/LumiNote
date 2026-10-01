import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDebouncedCallback, useDraft } from '../lib/hooks';
import { useSettings } from '../lib/settings';
import { useLocalNote } from '../lib/notes';
import { deleteLocalNote, saveVersionNow, updateLocalNote } from '../lib/repository';
import { runSync } from '../lib/sync';
import { Editor } from '../shared/Editor';
import { KeywordPanel } from '../shared/KeywordPanel';
import { VersionHistory } from '../shared/VersionHistory';

export function NoteView() {
  const { id } = useParams<{ id: string }>();
  const note = useLocalNote(id);
  const settings = useSettings();
  const navigate = useNavigate();
  const { value: body, setValue: setBody } = useDraft(note?.body, id);
  const [showVersions, setShowVersions] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const persist = useDebouncedCallback((next: string) => {
    if (!id) return;
    void updateLocalNote(id, { body: next }).then(() => setSavedAt(new Date().toISOString()));
  }, 500);

  const handleChange = useCallback(
    (next: string) => {
      setBody(next);
      persist(next);
    },
    [persist, setBody],
  );

  useEffect(() => {
    if (id) setShowVersions(false);
  }, [id]);

  if (!note) {
    return (
      <div className="note-view note-view--empty">
        <p className="muted">这条笔记不存在，可能已被删除。</p>
      </div>
    );
  }

  async function handleSaveVersion() {
    if (!id) return;
    await saveVersionNow(id);
    setShowVersions(true);
    void runSync().catch(() => undefined);
  }

  async function handleDelete() {
    if (!id) return;
    await deleteLocalNote(id);
    void runSync().catch(() => undefined);
    navigate('/');
  }

  return (
    <div className="note-view">
      <header className="note-view__header">
        <h2 className="note-view__title">{note.title ?? '未命名灵感'}</h2>
        <div className="note-view__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void handleSaveVersion()}
          >
            保存版本
          </button>
          <button
            type="button"
            className={`button button--ghost${showVersions ? ' is-active' : ''}`}
            onClick={() => setShowVersions((current) => !current)}
          >
            历史版本
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void updateLocalNote(note.id, { pinned: !note.pinned })}
          >
            {note.pinned ? '取消置顶' : '置顶'}
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() => void handleDelete()}
          >
            删除
          </button>
        </div>
      </header>

      <div className="note-view__body">
        <div className="note-view__editor">
          <Editor
            value={body}
            onChange={handleChange}
            preferences={settings.editor}
            onSaveVersion={() => void handleSaveVersion()}
            autoFocus
            minRows={20}
          />
          <p className="note-view__status muted">
            {note.dirty ? '尚未同步' : '已同步'}
            {savedAt ? ` · 本地保存于 ${new Date(savedAt).toLocaleTimeString()}` : ''}
          </p>
        </div>

        <aside className="note-view__aside">
          {showVersions ? (
            <VersionHistory
              noteId={note.id}
              currentBody={body}
              mode="split"
              onRestored={() => setBody(null)}
            />
          ) : (
            <>
              <h3 className="panel__title">关键词</h3>
              <KeywordPanel
                body={body}
                onPick={(term) => {
                  const next = `${body}${body.endsWith('\n') || body.length === 0 ? '' : '\n'}${term} `;
                  handleChange(next);
                }}
              />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
