import type { NoteVersionDto } from '@luminote/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Notice } from '../components/Notice';
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

const SOURCE_TONES: Record<string, 'neutral' | 'accent' | 'ok' | 'caution'> = {
  auto: 'neutral',
  manual: 'accent',
  restore: 'ok',
  import: 'caution',
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
    return (
      <p className="text-xs leading-relaxed text-fg-subtle">
        还没有历史版本。开始编辑后会自动留下快照。
      </p>
    );
  }

  return (
    <div className="versions flex min-h-0 flex-col gap-3">
      <ul className="versions__list scrollbar-slim -mx-1 flex max-h-56 flex-col gap-1 overflow-y-auto px-1">
        {list.map((version) => {
          const isActive = selected?.id === version.id;
          return (
            <li key={version.id}>
              <button
                type="button"
                className={[
                  'versions__item flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                  isActive
                    ? 'is-active border-accent/50 bg-accent-soft'
                    : 'border-transparent hover:border-line hover:bg-surface-2',
                ].join(' ')}
                onClick={() => setSelectedId(version.id)}
              >
                <span className="versions__stamp tabular min-w-0 flex-1 truncate text-xs text-fg-muted">
                  {formatStamp(version.createdAt)}
                </span>
                <Badge tone={SOURCE_TONES[version.source] ?? 'neutral'}>
                  {version.label ?? SOURCE_LABELS[version.source] ?? version.source}
                </Badge>
                {version.pinned ? (
                  <span className="versions__pin shrink-0 text-[11px]" aria-label="已固定">
                    📌
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="versions__detail flex flex-col gap-3">
        {selected ? (
          <>
            <div className="versions__actions flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={() => void handleRestore()}
                loading={busy}
              >
                恢复此版本
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleTogglePin(selected)}
                disabled={busy}
              >
                {selected.pinned ? '取消固定' : '固定版本'}
              </Button>
            </div>
            {message ? <Notice tone="ok">{message}</Notice> : null}
            <DiffView before={selected.body} after={currentBody} mode={mode} />
          </>
        ) : null}
      </div>
    </div>
  );
}
