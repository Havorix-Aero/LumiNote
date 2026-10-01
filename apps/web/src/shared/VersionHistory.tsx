import type { NoteVersionDto } from '@luminote/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { db } from '../lib/local-db';
import { restoreLocalVersion } from '../lib/repository';
import { runSync } from '../lib/sync';
import { DiffView } from './DiffView';

export interface VersionHistoryProps {
  noteId: string;
  currentBody: string;
  mode: 'split' | 'inline';
  onRestored: () => void;
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

const SOURCE_LABELS: Record<string, string> = {
  auto: '自动快照',
  manual: '手动保存',
  restore: '恢复',
  import: '冲突副本',
};

export function VersionHistory({ noteId, currentBody, mode, onRestored }: VersionHistoryProps) {
  const versions = useLiveQuery(
    () => db.versions.where('noteId').equals(noteId).reverse().sortBy('createdAt'),
    [noteId],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const list = versions ?? [];
  const selected = list.find((version) => version.id === selectedId) ?? list[0];

  async function handleRestore() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      await restoreLocalVersion(noteId, selected.id);
      onRestored();
      setMessage('已恢复到所选版本，原内容已保留为历史版本。');
      void runSync().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePin(version: { id: string; pinned: boolean }) {
    setMessage(null);
    try {
      await apiFetch<{ version: NoteVersionDto }>(
        `/api/v1/notes/${noteId}/versions/${version.id}`,
        {
          method: 'PATCH',
          json: { pinned: !version.pinned },
        },
      );
      await db.versions.update(version.id, { pinned: !version.pinned });
    } catch {
      setMessage('固定版本需要联网，请稍后重试。');
    }
  }

  if (list.length === 0) {
    return <p className="muted">还没有历史版本。开始编辑后会自动留下快照。</p>;
  }

  return (
    <div className="versions">
      <ul className="versions__list">
        {list.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              className={`versions__item${selected?.id === version.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(version.id)}
            >
              <span className="versions__stamp">{formatStamp(version.createdAt)}</span>
              <span className={`versions__source versions__source--${version.source}`}>
                {version.label ?? SOURCE_LABELS[version.source] ?? version.source}
              </span>
              {version.pinned ? (
                <span className="versions__pin" aria-label="已固定">
                  📌
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="versions__detail">
        {selected ? (
          <>
            <div className="versions__actions">
              <button type="button" className="button" onClick={handleRestore} disabled={busy}>
                恢复此版本
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => void handleTogglePin(selected)}
              >
                {selected.pinned ? '取消固定' : '固定版本'}
              </button>
            </div>
            {message ? <p className="notice">{message}</p> : null}
            <DiffView before={selected.body} after={currentBody} mode={mode} />
          </>
        ) : null}
      </div>
    </div>
  );
}
