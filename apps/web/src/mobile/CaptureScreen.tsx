import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../lib/settings';
import { createLocalNote } from '../lib/repository';
import { runSync } from '../lib/sync';
import { Editor } from '../shared/Editor';

/**
 * Capture-first home screen: a blank editor and nothing else.
 *
 * The note row is only created once the user actually types, so opening the app never litters the
 * history with empty notes.
 */
export function CaptureScreen() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleChange = useCallback(
    (value: string) => {
      if (creating) return;
      setCreating(true);
      void (async () => {
        const note = await createLocalNote(value);
        navigate(`/n/${note.id}`, { replace: true });
        void runSync().catch(() => undefined);
      })();
    },
    [creating, navigate],
  );

  return (
    <div className="capture">
      <p className="capture__hint muted">直接开写，标题稍后再说。</p>
      <Editor
        value=""
        onChange={handleChange}
        preferences={settings.editor}
        autoFocus
        minRows={16}
        placeholder="想到什么就先写下来…"
      />
      <p className="muted capture__tips">
        按住语音键或稍后接入的语音接口，可以先把想法说出来再自动转写。
      </p>
    </div>
  );
}
