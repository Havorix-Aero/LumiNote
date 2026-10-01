import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLocalNote } from '../lib/repository';
import { useSettings } from '../lib/settings';
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
    <div className="capture flex flex-col gap-3 p-4">
      <p className="capture__hint text-xs text-fg-subtle">直接开写，标题稍后再说。</p>

      <Editor
        value=""
        onChange={handleChange}
        preferences={settings.editor}
        autoFocus
        minRows={16}
        placeholder="想到什么就先写下来…"
      />

      <p className="capture__tips flex items-center gap-2 rounded-lg border border-line bg-surface-1 px-3 py-2 text-[11px] leading-relaxed text-fg-subtle">
        <span aria-hidden className="text-base">
          🎙
        </span>
        语音接口已预留，接上之后可以先说出来再自动转写。
      </p>
    </div>
  );
}
