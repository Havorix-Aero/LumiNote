import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '../components/Button';
import { DesktopShell } from '../desktop/DesktopShell';
import { InspirationCenter } from '../desktop/InspirationCenter';
import { NoteView } from '../desktop/NoteView';
import { SettingsView } from '../desktop/SettingsView';
import { useLayout } from '../hooks/useLayout';
import { useSession } from '../lib/auth';
import { META_KEYS, readMeta, resetLocalData, writeMeta } from '../lib/local-db';
import { markSyncing, useOnline } from '../lib/notes';
import { runSync, startSyncLoop } from '../lib/sync';
import { CaptureScreen } from '../mobile/CaptureScreen';
import { HistoryScreen } from '../mobile/HistoryScreen';
import { MobileShell } from '../mobile/MobileShell';
import { NoteScreen } from '../mobile/NoteScreen';
import { SettingsScreen } from '../mobile/SettingsScreen';
import { AuthScreen } from '../shared/AuthScreen';
import { QuestionReset } from '../shared/QuestionReset';

function BootScreen() {
  return (
    <div className="boot grid h-full place-items-center bg-surface-0 text-fg-muted">
      <span className="flex items-center gap-2 text-sm">
        <Spinner />
        正在加载…
      </span>
    </div>
  );
}

export function App() {
  const session = useSession();
  const online = useOnline();
  const layout = useLayout();

  const userId = session.data?.session?.user.id;

  /*
   * The sync loop only makes sense once there is a session. Starting it on the sign-in screen
   * instead fires an unauthenticated `/sync/pull` that 401s on every tick, which both pollutes
   * the console and spends the per-IP request budget.
   */
  useEffect(() => {
    if (!userId) return;
    return startSyncLoop();
  }, [userId]);

  // Clear local data when a different account signs in on this device.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const previous = await readMeta<string>(META_KEYS.lastUserId);
      if (!cancelled && previous && previous !== userId) {
        await resetLocalData();
      }
      if (!cancelled) await writeMeta(META_KEYS.lastUserId, userId);
      if (!cancelled && online) {
        markSyncing(true);
        await runSync().catch(() => undefined);
        markSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, userId]);

  if (session.isLoading) {
    return <BootScreen />;
  }

  if (!session.data?.session) {
    return <AuthScreen onAuthenticated={() => void session.refetch()} />;
  }

  if (session.data.needsQuestionReset) {
    return <QuestionReset onDone={() => void session.refetch()} />;
  }

  return layout === 'mobile' ? (
    <Routes>
      <Route element={<MobileShell />}>
        <Route index element={<CaptureScreen />} />
        <Route path="history" element={<HistoryScreen />} />
        <Route path="n/:id" element={<NoteScreen />} />
        <Route path="me" element={<SettingsScreen />} />
        <Route path="settings" element={<Navigate to="/me" replace />} />
        <Route path="notes" element={<Navigate to="/history" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  ) : (
    <Routes>
      <Route element={<DesktopShell />}>
        <Route index element={<InspirationCenter />} />
        <Route path="notes" element={<InspirationCenter />} />
        <Route path="notes/:id" element={<NoteView />} />
        <Route path="settings" element={<SettingsView />} />
        <Route path="history" element={<Navigate to="/" replace />} />
        <Route path="me" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
