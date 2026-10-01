import { useNavigate } from 'react-router-dom';
import { useLocalNotes } from '../lib/notes';
import { NoteList } from '../shared/NoteList';

/** History lives behind its own screen on mobile so the capture screen stays a blank page. */
export function HistoryScreen() {
  const notes = useLocalNotes();
  const navigate = useNavigate();

  return (
    <div className="history">
      <h1 className="history__title">笔记历史</h1>
      <NoteList notes={notes} onSelect={(id) => navigate(`/n/${id}`)} />
    </div>
  );
}
