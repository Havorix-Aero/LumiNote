import { useNavigate } from 'react-router-dom';
import { useLocalNotes } from '../lib/notes';
import { NoteList } from '../shared/NoteList';

/** History lives behind its own screen on mobile so the capture screen stays a blank page. */
export function HistoryScreen() {
  const notes = useLocalNotes();
  const navigate = useNavigate();

  return (
    <div className="history flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="history__title text-base font-semibold text-fg">笔记历史</h1>
        <span className="tabular text-xs text-fg-subtle">{notes.length} 条</span>
      </div>
      <NoteList
        notes={notes}
        onSelect={(id) => navigate(`/n/${id}`)}
        emptyHint="还没有笔记。回到“记灵感”写下第一条吧。"
      />
    </div>
  );
}
