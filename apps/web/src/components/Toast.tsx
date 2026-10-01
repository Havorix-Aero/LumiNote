import { useEffect, useSyncExternalStore } from 'react';
import { Badge } from './Badge';
import type { Tone } from './Badge';

export type ToastTone = Exclude<Tone, 'neutral' | 'accent'>;

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** 0 keeps the toast on screen until it is dismissed. */
  timeoutMs: number;
}

/*
 * A tiny module-level store instead of pulling in a state library: toasts are fired from event
 * handlers and async callbacks, far away from any component that could provide context.
 */
let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let sequence = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function push(input: Omit<ToastItem, 'id' | 'timeoutMs'> & { timeoutMs?: number }): string {
  sequence += 1;
  const id = `toast_${sequence}`;
  const item: ToastItem = {
    id,
    tone: input.tone,
    title: input.title,
    description: input.description,
    timeoutMs:
      input.timeoutMs ?? (input.tone === 'critical' || input.tone === 'warning' ? 8000 : 4000),
  };
  // Keep only the last few, so a burst of errors cannot cover the whole screen.
  items = [...items.slice(-3), item];
  emit();
  return id;
}

function dismiss(id: string): void {
  items = items.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  show: push,
  info: (title: string, description?: string) => push({ tone: 'info', title, description }),
  ok: (title: string, description?: string) => push({ tone: 'ok', title, description }),
  caution: (title: string, description?: string) => push({ tone: 'caution', title, description }),
  warning: (title: string, description?: string) => push({ tone: 'warning', title, description }),
  critical: (title: string, description?: string) => push({ tone: 'critical', title, description }),
  dismiss,
  clear: () => {
    items = [];
    emit();
  },
};

const LABELS: Record<ToastTone, string> = {
  info: '提示',
  ok: '成功',
  caution: '注意',
  warning: '警告',
  critical: '严重',
};

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    if (item.timeoutMs <= 0) return;
    const timer = window.setTimeout(() => dismiss(item.id), item.timeoutMs);
    return () => window.clearTimeout(timer);
  }, [item.id, item.timeoutMs]);

  return (
    <div
      role="status"
      className={[
        'pointer-events-none flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-1.5 rounded-xl border bg-surface-1 px-3.5 py-3 shadow-lg',
        item.tone === 'critical'
          ? 'border-critical/70'
          : item.tone === 'warning'
            ? 'border-warning/60'
            : 'border-line-strong',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={item.tone} solid={item.tone === 'critical' || item.tone === 'warning'}>
            {LABELS[item.tone]}
          </Badge>
          <p className="truncate text-sm font-medium text-fg">{item.title}</p>
        </div>
        <button
          type="button"
          aria-label="关闭提示"
          onClick={() => dismiss(item.id)}
          className="pointer-events-auto -mt-0.5 -mr-1 cursor-pointer rounded px-1 text-xs text-fg-subtle hover:text-fg"
        >
          ✕
        </button>
      </div>
      {item.description ? (
        <p className="text-xs leading-relaxed text-fg-muted">{item.description}</p>
      ) : null}
    </div>
  );
}

export function ToastViewport() {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );

  if (current.length === 0) return null;

  return (
    // Above page content, below the modal layer. The stack itself ignores pointer events so it
    // never blocks a button underneath; only the close control opts back in.
    <div className="pointer-events-none fixed right-4 bottom-4 z-[1150] flex flex-col items-end gap-2">
      {current.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
