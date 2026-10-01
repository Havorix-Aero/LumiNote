import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './lib/auth';
import { prefersMobileLayout } from './lib/device';
import { markSyncing, useOnline } from './lib/notes';
import { META_KEYS, readMeta, resetLocalData, writeMeta } from './lib/local-db';
import { useSettings } from './lib/settings';
import { runSync, startSyncLoop } from './lib/sync';
import { AuthScreen } from './shared/AuthScreen';
import { QuestionReset } from './shared/QuestionReset';
import { CaptureScreen } from './mobile/CaptureScreen';
import { HistoryScreen } from './mobile/HistoryScreen';
import { MobileApp } from './mobile/MobileApp';
import { NoteScreen } from './mobile/NoteScreen';
import { SettingsScreen } from './mobile/SettingsScreen';
import { DesktopApp } from './desktop/DesktopApp';
import { InspirationCenter } from './desktop/InspirationCenter';
import { NoteView } from './desktop/NoteView';
import { SettingsView } from './desktop/SettingsView';

function useLayout(): 'desktop' | 'mobile' {
  const settings = useSettings();
  if (settings.layout === 'desktop') return 'desktop';
  if (settings.layout === 'mobile') return 'mobile';
  return prefersMobileLayout() ? 'mobile' : 'desktop';
}

export function App() {
  const session = useSession();
  const online = useOnline();
  const layout = useLayout();

  // Keep the sync loop running whenever the app is mounted.
  useEffect(() => startSyncLoop(), []);

  // Clear local data when a different account signs in on this device.
  useEffect(() => {
    const userId = session.data?.session?.user.id;
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
  }, [online, session.data?.session?.user.id]);

  if (session.isLoading) {
    return <div className="boot">正在加载…</div>;
  }

  if (!session.data?.session) {
    return <AuthScreen onAuthenticated={() => void session.refetch()} />;
  }

  if (session.data.needsQuestionReset) {
    return <QuestionReset onDone={() => void session.refetch()} />;
  }

  return layout === 'mobile' ? (
    <Routes>
      <Route element={<MobileApp />}>
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
      <Route element={<DesktopApp />}>
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
