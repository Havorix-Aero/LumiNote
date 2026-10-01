import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
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

interface ActionCardProps {
  title: string;
  hint: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionCard({ title, hint, icon, onClick, disabled }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'card-button flex w-full cursor-pointer items-start gap-3 rounded-card border border-line bg-surface-1 p-4 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : 'hover:border-accent/50 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      ].join(' ')}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-base text-accent-ink"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="card-button__title block text-sm font-semibold text-fg">{title}</span>
        <span className="card-button__hint mt-0.5 block truncate text-xs text-fg-muted">
          {hint}
        </span>
      </span>
    </button>
  );
}

/**
 * The desktop landing surface: greet the returning user, then offer the three things they actually
 * want. Unlike mobile — which opens straight into a blank note — desktop has room to orient first.
 */
export function InspirationCenter() {
  const session = useSession();
  const notes = useLocalNotes();
  const navigate = useNavigate();

  const displayName = session.data?.session?.user.displayName ?? '朋友';
  const greeting = greetingForHour(new Date().getHours());
  const latest = notes[0];
  const unpushed = notes.filter((note) => note.dirty).length;

  async function handleNewNote() {
    const note = await createLocalNote();
    navigate(`/notes/${note.id}`);
  }

  return (
    <div className="inspiration flex flex-col gap-6 p-6 lg:p-8">
      <Card className="inspiration__hero overflow-hidden">
        <div
          className="flex flex-col gap-1 px-5 py-6 lg:px-7 lg:py-8"
          style={{
            backgroundImage:
              'linear-gradient(118deg, var(--accent-soft) 0%, var(--surface-1) 52%, var(--surface-2) 100%)',
          }}
        >
          <p className="inspiration__hello text-xs font-medium tracking-wide text-fg-muted uppercase">
            欢迎回来，{displayName}
          </p>
          <h1 className="inspiration__greeting text-2xl leading-tight font-semibold text-fg lg:text-3xl">
            {greeting}，想做点什么？
          </h1>
        </div>
      </Card>

      <div className="inspiration__actions grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          title="新建笔记"
          hint="直接开写，标题稍后再说"
          icon="✎"
          onClick={() => void handleNewNote()}
        />
        <ActionCard
          title="打开笔记历史"
          hint={`共 ${notes.length} 条记录${unpushed > 0 ? ` · ${unpushed} 条待同步` : ''}`}
          icon="☰"
          onClick={() => {
            document.querySelector('.desktop__list')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <ActionCard
          title="继续最近一条"
          hint={
            latest
              ? (latest.title ??
                  latest.body.replace(/\s+/g, ' ').trim().slice(0, 24) ??
                  '未命名灵感') ||
                '未命名灵感'
              : '还没有笔记'
          }
          icon="↩"
          disabled={!latest}
          onClick={() => latest && navigate(`/notes/${latest.id}`)}
        />
      </div>

      <p className="inspiration__hint rounded-card border border-line bg-surface-1 px-4 py-3 text-xs leading-relaxed text-fg-muted">
        <span className="font-medium text-fg">写作提示</span> · 输入 “-”
        再空格开始列表；正文里的空格会自动变成 “，” 或 “。”，按一次退格即可还原。
      </p>
    </div>
  );
}
