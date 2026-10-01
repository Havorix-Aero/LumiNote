import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Dot } from '../components/Badge';
import { ThemeToggle } from '../components/ThemeToggle';
import { toast } from '../components/Toast';
import { useLogout, useSession } from '../lib/auth';
import { useLocalNotes, useOnline, usePendingCount, useSyncStatus } from '../lib/notes';
import { createLocalNote } from '../lib/repository';
import { runSync } from '../lib/sync';
import { NoteList } from '../shared/NoteList';

function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

const ICONS = {
  center: 'M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8.4 5.2-2.1-.8.9-2-1.2-2.1-2.1.8-1.7-1.3-.3-2.2h-2.4l-.3 2.2-1.7 1.3-2.1-.8L3.3 10.4l.9 2-2.1.8v2.4l2.1.8-.9 2 1.2 2.1 2.1-.8 1.7 1.3.3 2.2h2.4l.3-2.2 1.7-1.3 2.1.8 1.2-2.1-.9-2 2.1-.8z',
} as const;

/**
 * Desktop shell: a fixed sidebar plus the routed content.
 *
 * The sidebar owns everything that is not a note — creating one, navigating, the note list, and
 * the sync/account footer — so `main` can be entirely about writing.
 */
export function DesktopShell() {
  const notes = useLocalNotes();
  const session = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const pending = usePendingCount();
  const online = useOnline();
  const sync = useSyncStatus();

  const activeId = location.pathname.startsWith('/notes/')
    ? location.pathname.slice('/notes/'.length)
    : undefined;

  const displayName = session.data?.session?.user.displayName ?? '朋友';

  const [syncing, setSyncing] = useState(false);

  async function handleNewNote() {
    const note = await createLocalNote();
    navigate(`/notes/${note.id}`);
  }

  // A manual sync is the one place the user asks for something and waits for it, so it reports
  // its own progress and its own failures instead of failing silently.
  async function handleManualSync() {
    setSyncing(true);
    try {
      await runSync();
    } catch {
      toast.critical('同步失败', '网络看起来不稳定，内容仍然保存在本机，稍后会自动重试。');
    } finally {
      setSyncing(false);
    }
  }

  // The end-to-end suite reads this footer to tell connectivity apart from sync state, so the
  // wording ("已连接" / "离线" / "N 项待同步" / "已同步") is part of the contract.
  const syncLabel = !online
    ? '离线'
    : pending > 0
      ? `已连接 · ${pending} 项待同步`
      : '已连接 · 已同步';
  const syncTone = !online ? 'warning' : pending > 0 ? 'caution' : 'ok';

  return (
    <div className="desktop flex h-full bg-surface-0">
      <aside className="desktop__sidebar flex w-72 shrink-0 flex-col border-r border-line bg-surface-1">
        <div className="desktop__brand flex items-center gap-2.5 px-4 pt-4 pb-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg"
          >
            ✦
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-fg">LumiNote</span>
            <span className="block truncate text-xs text-fg-muted">{displayName}</span>
          </span>
        </div>

        <div className="px-4 pb-3">
          <Button variant="primary" size="lg" block onClick={() => void handleNewNote()}>
            新建灵感
          </Button>
        </div>

        <nav className="desktop__nav flex flex-col gap-0.5 px-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              [
                'flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent-soft font-medium text-accent-ink'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              ].join(' ')
            }
          >
            <NavIcon path={ICONS.center} />
            灵感中心
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              [
                'flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent-soft font-medium text-accent-ink'
                  : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              ].join(' ')
            }
          >
            <NavIcon path={ICONS.settings} />
            设置
          </NavLink>
        </nav>

        <div className="mt-3 flex items-center justify-between px-4 pb-1.5">
          <span className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
            全部灵感
          </span>
          <span className="tabular text-[11px] text-fg-subtle">{notes.length}</span>
        </div>

        <div className="desktop__list scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <NoteList notes={notes} activeId={activeId} onSelect={(id) => navigate(`/notes/${id}`)} />
        </div>

        <footer className="desktop__footer flex items-center gap-2 border-t border-line px-3 py-2.5 text-[11px] text-fg-muted">
          <Dot tone={syncTone} pulse={pending > 0 || !online} />
          <span className="tabular flex-1 truncate">{syncLabel}</span>
          {online ? (
            <button
              type="button"
              className="link cursor-pointer rounded px-1.5 py-1 text-fg-muted hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => void handleManualSync()}
              disabled={syncing}
              title={
                sync.report
                  ? `上次同步：${sync.report.pushed} 推送 / ${sync.report.pulled} 拉取`
                  : '立即同步'
              }
            >
              {syncing ? '同步中…' : '立即同步'}
            </button>
          ) : null}
          <ThemeToggle size="sm" showLabel={false} />
          <button
            type="button"
            className="link cursor-pointer rounded px-1.5 py-1 text-fg-muted hover:bg-surface-2 hover:text-critical"
            onClick={() => logout.mutate()}
          >
            退出登录
          </button>
        </footer>
      </aside>

      <main className="desktop__main min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
