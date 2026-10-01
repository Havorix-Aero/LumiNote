import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Dot } from '../components/Badge';
import { useSession } from '../lib/auth';
import { useOnline, usePendingCount } from '../lib/notes';
import { createLocalNote } from '../lib/repository';

/**
 * Mobile shell.
 *
 * Two destinations plus the capture action, and nothing else. The desktop navigation surface
 * (inspiration centre, keyword panel, settings sections) is deliberately not reused here; on a
 * phone the fastest path back to writing is the right one.
 */
export function MobileShell() {
  const navigate = useNavigate();
  const session = useSession();
  const pending = usePendingCount();
  const online = useOnline();

  async function handleNewNote() {
    const note = await createLocalNote();
    navigate(`/n/${note.id}`);
  }

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] transition-colors',
      isActive ? 'font-medium text-accent-ink' : 'text-fg-muted',
    ].join(' ');

  return (
    <div className="mobile flex h-full flex-col bg-surface-0">
      <header className="mobile__header pt-safe flex shrink-0 items-center gap-2 border-b border-line bg-surface-1 px-4 pb-2.5">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-sm text-accent-fg"
        >
          ✦
        </span>
        <span className="mobile__brand min-w-0 flex-1 truncate text-sm font-semibold text-fg">
          LumiNote
        </span>
        <Dot tone={!online ? 'warning' : pending > 0 ? 'caution' : 'ok'} />
        <span className="mobile__who max-w-32 truncate text-xs text-fg-muted">
          {session.data?.session?.user.displayName ?? ''}
        </span>
      </header>

      <main className="mobile__main min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {!online ? (
        <div className="mobile__offline shrink-0 border-t border-warning/40 bg-warning-soft px-4 py-2 text-center text-xs text-warning">
          离线中，内容会保存在本机
        </div>
      ) : null}

      <nav className="mobile__tabs pb-safe flex shrink-0 items-stretch gap-1 border-t border-line bg-surface-1 px-2 pt-1.5">
        <button
          type="button"
          className="mobile__tab mobile__tab--primary flex min-h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg bg-accent text-[11px] font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          onClick={() => void handleNewNote()}
        >
          <span aria-hidden className="text-base leading-none">
            ＋
          </span>
          记灵感
        </button>
        <NavLink to="/history" className={tabClass}>
          <span aria-hidden className="text-base leading-none">
            ☰
          </span>
          历史
        </NavLink>
        <NavLink to="/me" className={tabClass}>
          <span aria-hidden className="text-base leading-none">
            ◑
          </span>
          我的{pending > 0 ? ` (${pending})` : ''}
        </NavLink>
      </nav>
    </div>
  );
}
