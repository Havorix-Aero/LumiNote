import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useLogout, useSession } from '../lib/auth';
import { useLocalNotes, useOnline, usePendingCount, useSyncStatus } from '../lib/notes';
import { createLocalNote } from '../lib/repository';
import { runSync } from '../lib/sync';
import { NoteList } from '../shared/NoteList';

export function DesktopApp() {
  const notes = useLocalNotes();
  const session = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const pending = usePendingCount();
  const online = useOnline();
  const sync = useSyncStatus();
  const activeId = window.location.pathname.startsWith('/notes/')
    ? window.location.pathname.slice('/notes/'.length)
    : undefined;

  async function handleNewNote() {
    const note = await createLocalNote();
    navigate(`/notes/${note.id}`);
  }

  return (
    <div className="desktop">
      <aside className="desktop__sidebar">
        <div className="desktop__brand">
          <span className="desktop__logo">LumiNote</span>
          <span className="muted">{session.data?.session?.user.displayName}</span>
        </div>

        <button
          type="button"
          className="button button--primary"
          onClick={() => void handleNewNote()}
        >
          新建灵感
        </button>

        <nav className="desktop__nav">
          <NavLink to="/" end>
            灵感中心
          </NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>

        <div className="desktop__list">
          <NoteList notes={notes} activeId={activeId} onSelect={(id) => navigate(`/notes/${id}`)} />
        </div>

        <footer className="desktop__footer">
          <span className={`status-dot${online ? ' is-online' : ''}`} />
          <span className="muted">
            {online ? '已连接' : '离线'}
            {pending > 0 ? ` · ${pending} 项待同步` : ''}
            {sync.report && pending === 0 ? ' · 已同步' : ''}
          </span>
          <button
            type="button"
            className="link"
            onClick={() => void runSync().catch(() => undefined)}
          >
            立即同步
          </button>
          <button type="button" className="link" onClick={() => logout.mutate()}>
            退出登录
          </button>
        </footer>
      </aside>

      <main className="desktop__main">
        <Outlet />
      </main>
    </div>
  );
}
