import { useCallback, useEffect, useRef, useState } from 'react';

/** Trailing-edge debounce for high-frequency edits (typing) before they hit IndexedDB. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const timer = useRef<number | null>(null);
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        latest.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}

/**
 * Keeps a text field responsive by holding the in-progress value locally while persisting the
 * settled value.
 */
export function useDraft<T>(source: T | undefined, resetKey: string | undefined) {
  const [draft, setDraft] = useState<T | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [resetKey]);

  return {
    value: (draft ?? source) as T,
    setValue: setDraft,
    isDirty: draft !== null,
  };
}
