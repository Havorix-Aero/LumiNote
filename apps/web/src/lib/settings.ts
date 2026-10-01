import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from '@luminote/editor';
import { useSyncExternalStore } from 'react';

export type LayoutPreference = 'auto' | 'desktop' | 'mobile';

export interface AppSettings {
  layout: LayoutPreference;
  editor: EditorPreferences;
}

const STORAGE_KEY = 'luminote.settings';

const DEFAULTS: AppSettings = {
  layout: 'auto',
  editor: { ...DEFAULT_EDITOR_PREFERENCES },
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      layout: parsed.layout ?? DEFAULTS.layout,
      editor: { ...DEFAULTS.editor, ...(parsed.editor ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

let current: AppSettings = load();
const listeners = new Set<() => void>();

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(patch: Partial<AppSettings>): void {
  current = {
    ...current,
    ...patch,
    editor: { ...current.editor, ...(patch.editor ?? {}) },
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can be unavailable in private modes; settings simply won't persist.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
