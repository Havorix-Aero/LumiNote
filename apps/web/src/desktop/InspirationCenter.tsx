import { useNavigate } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { useLocalNotes } from '../lib/notes';
import { createLocalNote } from '../lib/repository';

function greetingForHour(hour: number): string {
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 23) return '晚上好';
  return '夜深了';
}

/**
 * The desktop landing surface: a greeting, then the three things a returning user actually wants.
 * Unlike mobile (which opens straight into a blank note), desktop has room to orient you first.
 */
export function InspirationCenter() {
  const session = useSession();
  const notes = useLocalNotes();
  const navigate = useNavigate();

  const displayName = session.data?.session?.user.displayName ?? '朋友';
  const greeting = greetingForHour(new Date().getHours());
  const latest = notes[0];

  async function handleNewNote() {
    const note = await createLocalNote();
    navigate(`/notes/${note.id}`);
  }

  return (
    <div className="inspiration">
      <p className="inspiration__hello">欢迎回来，{displayName}</p>
      <h1 className="inspiration__greeting">{greeting}，想做点什么？</h1>

      <div className="inspiration__actions">
        <button type="button" className="card-button" onClick={() => void handleNewNote()}>
          <span className="card-button__title">新建笔记</span>
          <span className="card-button__hint">直接开写，标题稍后再说</span>
        </button>

        <button
          type="button"
          className="card-button"
          onClick={() => {
            const target = document.querySelector('.desktop__list');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <span className="card-button__title">打开笔记历史</span>
          <span className="card-button__hint">共 {notes.length} 条记录</span>
        </button>

        <button
          type="button"
          className="card-button"
          disabled={!latest}
          onClick={() => latest && navigate(`/notes/${latest.id}`)}
        >
          <span className="card-button__title">继续最近一条</span>
          <span className="card-button__hint">
            {latest ? (latest.title ?? latest.body.slice(0, 24) ?? '未命名灵感') : '还没有笔记'}
          </span>
        </button>
      </div>

      <p className="muted inspiration__hint">
        提示：输入 “-” 再空格开始列表；空格会自动变成 “，” 或 “。”，按一次退格即可还原。
      </p>
    </div>
  );
}
