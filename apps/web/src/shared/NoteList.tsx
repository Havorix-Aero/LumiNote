import { deriveTitle } from '@luminote/versions';
import type { LocalNote } from '../lib/local-db';

export interface NoteListProps {
  notes: LocalNote[];
  activeId?: string;
  onSelect: (id: string) => void;
  emptyHint?: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString();
}

function preview(body: string): string {
  const flattened = body.replace(/\s+/g, ' ').trim();
  return flattened.length > 80 ? `${flattened.slice(0, 80)}…` : flattened;
}

/**
 * The scrolling list of notes.
 *
 * Rendered from the local store rather than the server, so a note appears the moment it is typed
 * — which is also why the end-to-end suite reads it back to prove a write reached IndexedDB.
 */
export function NoteList({ notes, activeId, onSelect, emptyHint }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="note-list__empty px-3 py-6 text-center text-xs leading-relaxed text-fg-subtle">
        {emptyHint ?? '还没有笔记，写下第一条灵感吧。'}
      </div>
    );
  }

  return (
    <ul className="note-list flex flex-col gap-1">
      {notes.map((note) => {
        const isActive = activeId === note.id;
        return (
          <li key={note.id}>
            <button
              type="button"
              className={[
                'note-list__item group relative flex w-full cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                isActive
                  ? 'is-active border-accent/50 bg-accent-soft'
                  : 'border-transparent hover:border-line hover:bg-surface-2',
              ].join(' ')}
              onClick={() => onSelect(note.id)}
            >
              {/* The active marker is a bar rather than a border so the card never shifts width. */}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute top-2 bottom-2 -left-px w-0.5 rounded-full bg-accent"
                />
              ) : null}

              <span
                className={[
                  'note-list__title flex items-center gap-1.5 truncate text-sm font-medium',
                  isActive ? 'text-accent-ink' : 'text-fg',
                ].join(' ')}
              >
                {note.pinned ? (
                  <span aria-hidden className="shrink-0 text-[11px]">
                    📌
                  </span>
                ) : null}
                <span className="truncate">
                  {note.title ?? deriveTitle(note.body) ?? '未命名灵感'}
                </span>
              </span>

              <span className="note-list__preview line-clamp-2 text-xs leading-relaxed text-fg-muted">
                {preview(note.body) || '（空白）'}
              </span>

              <span className="note-list__meta tabular mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-subtle">
                {relativeTime(note.updatedAt)}
                {note.dirty ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-caution">待同步</span>
                  </>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
