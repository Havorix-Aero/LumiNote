import { applyInput, type EditorPreferences, type EditorState } from '@luminote/editor';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  preferences: EditorPreferences;
  placeholder?: string;
  autoFocus?: boolean;
  /** Ctrl/Cmd+S — an explicit snapshot instead of waiting for the session boundary. */
  onSaveVersion?: () => void;
  minRows?: number;
}

/**
 * The note editor.
 *
 * A plain controlled textarea plus the pure rule engine from `@luminote/editor`. Deliberately not
 * a rich-text framework: the product's signature behaviours (space to punctuation, auto blank
 * line, dash lists) are exactly the kind of thing contenteditable implementations fight you on.
 *
 * The focus ring sits on the wrapper rather than the textarea, so the borderless writing surface
 * still shows keyboard focus — the previous version removed the outline and put nothing in its
 * place.
 */
export function Editor({
  value,
  onChange,
  preferences,
  placeholder,
  autoFocus,
  onSaveVersion,
  minRows = 12,
}: EditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [autoPunctuationIndex, setAutoPunctuationIndex] = useState<number | null>(null);
  const pendingSelection = useRef<number | null>(null);

  useEffect(() => {
    if (pendingSelection.current === null) return;
    const element = ref.current;
    if (element) {
      const caret = pendingSelection.current;
      element.setSelectionRange(caret, caret);
    }
    pendingSelection.current = null;
  });

  const apply = useCallback(
    (next: EditorState) => {
      onChange(next.value);
      setAutoPunctuationIndex(next.autoPunctuationIndex);
      pendingSelection.current = next.selectionStart;
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Never interfere with an active IME composition: Chinese input relies on the space key.
      if (event.nativeEvent.isComposing) return;

      const element = event.currentTarget;
      const state: EditorState = {
        value,
        selectionStart: element.selectionStart,
        selectionEnd: element.selectionEnd,
        autoPunctuationIndex,
      };

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSaveVersion?.();
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        apply(applyInput(state, { type: 'insertLineBreak' }, preferences));
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        apply(applyInput(state, { type: 'insertText', text: ' ' }, preferences));
        return;
      }

      if (
        event.key === 'Backspace' &&
        autoPunctuationIndex !== null &&
        state.selectionStart === state.selectionEnd &&
        state.selectionStart === autoPunctuationIndex + 1
      ) {
        // One press turns the auto-inserted punctuation back into the space the user pressed.
        event.preventDefault();
        apply(applyInput(state, { type: 'deleteContentBackward' }, preferences));
      }
    },
    [apply, autoPunctuationIndex, onSaveVersion, preferences, value],
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
      setAutoPunctuationIndex(null);
    },
    [onChange],
  );

  return (
    <div className="rounded-card border border-line bg-surface-1 transition-colors focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/25">
      <textarea
        ref={ref}
        className="editor block w-full resize-none border-0 bg-transparent px-4 py-4 text-[15px] leading-[1.9] text-fg outline-none placeholder:text-fg-subtle sm:px-5 sm:py-5"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? '想到什么就先写下来…'}
        autoFocus={autoFocus}
        rows={minRows}
        spellCheck={false}
        aria-label="笔记内容"
      />
    </div>
  );
}
