import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { useOnline, usePendingCount } from '../lib/notes';
import { createLocalNote } from '../lib/repository';

/**
 * Mobile shell.
 *
 * Two tabs only — capture and history. The desktop navigation surface (inspiration centre,
 * keyword panel, settings sections) is deliberately not reused here; on a phone the fastest path
 * back to writing is the right one.
 */
export function MobileApp() {
  const navigate = useNavigate();
  const session = useSession();
  const pending = usePendingCount();
  const online = useOnline();

  async function handleNewNote() {
    const note = await createLocalNote();
    navigate(`/n/${note.id}`);
  }

  return (
    <div className="mobile">
      <header className="mobile__header">
        <span className="mobile__brand">LumiNote</span>
        <span className="mobile__who">{session.data?.session?.user.displayName ?? ''}</span>
      </header>

      <main className="mobile__main">
        <Outlet />
      </main>

      <nav className="mobile__tabs">
        <button
          type="button"
          className="mobile__tab mobile__tab--primary"
          onClick={() => void handleNewNote()}
        >
          记灵感
        </button>
        <NavLink to="/history" className="mobile__tab">
          历史
        </NavLink>
        <NavLink to="/me" className="mobile__tab">
          我的{pending > 0 ? ` (${pending})` : ''}
        </NavLink>
      </nav>

      {!online ? <div className="mobile__offline">离线中，内容会保存在本机</div> : null}
    </div>
  );
}
