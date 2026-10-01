import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/Card';
import { useDebouncedCallback, useDraft } from '../lib/hooks';
import { useLocalNote } from '../lib/notes';
import { deleteLocalNote, saveVersionNow, updateLocalNote } from '../lib/repository';
import { useSettings } from '../lib/settings';
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
      <div className="note-view note-view--empty grid h-full place-items-center p-8">
        <EmptyState
          title="这条笔记不存在"
          description="它可能已经被删除了，或者还没有同步到这台设备。"
        />
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
    <div className="note-view flex min-h-full flex-col">
      <header className="note-view__header sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-0/95 px-5 py-3 backdrop-blur lg:px-7">
        <div className="min-w-0">
          <h2 className="note-view__title truncate text-sm font-semibold text-fg">
            {note.title ?? '未命名灵感'}
          </h2>
          <p className="note-view__status tabular mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
            <span className={note.dirty ? 'text-caution' : 'text-ok'}>
              {note.dirty ? '尚未同步' : '已同步'}
            </span>
            {savedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>本地保存于 {new Date(savedAt).toLocaleTimeString()}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="note-view__actions flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => void handleSaveVersion()}>
            保存版本
          </Button>
          <Button
            variant={showVersions ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowVersions((current) => !current)}
          >
            历史版本
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void updateLocalNote(note.id, { pinned: !note.pinned })}
          >
            {note.pinned ? '取消置顶' : '置顶'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => void handleDelete()}>
            删除
          </Button>
        </div>
      </header>

      <div className="note-view__body grid min-h-0 flex-1 gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:p-7">
        <div className="note-view__editor min-w-0">
          <Editor
            value={body}
            onChange={handleChange}
            preferences={settings.editor}
            onSaveVersion={() => void handleSaveVersion()}
            autoFocus
            minRows={20}
          />
        </div>

        <aside className="note-view__aside flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface-1 p-4">
          {showVersions ? (
            <VersionHistory
              noteId={note.id}
              currentBody={body}
              mode="split"
              onRestored={() => setBody(null)}
            />
          ) : (
            <>
              <h3 className="panel__title text-xs font-medium tracking-wide text-fg-subtle uppercase">
                关键词
              </h3>
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
