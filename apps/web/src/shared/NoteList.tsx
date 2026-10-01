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

export function NoteList({ notes, activeId, onSelect, emptyHint }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <p className="muted note-list__empty">{emptyHint ?? '还没有笔记，写下第一条灵感吧。'}</p>
    );
  }

  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.id}>
          <button
            type="button"
            className={`note-list__item${activeId === note.id ? ' is-active' : ''}`}
            onClick={() => onSelect(note.id)}
          >
            <span className="note-list__title">
              {note.pinned ? '📌 ' : ''}
              {note.title ?? deriveTitle(note.body) ?? '未命名灵感'}
            </span>
            <span className="note-list__preview">{preview(note.body)}</span>
            <span className="note-list__meta">
              {relativeTime(note.updatedAt)}
              {note.dirty ? ' · 待同步' : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
