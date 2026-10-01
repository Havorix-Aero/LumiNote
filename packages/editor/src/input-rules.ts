/**
 * The editor's behaviour lives here as pure functions rather than inside a React component.
 *
 * Writing (especially on a phone, mid-idea) is the product's whole point, so the rules that shape
 * typing need to be testable without a DOM and identical across the mobile and desktop editors.
 */

export interface EditorState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  /**
   * Index of the punctuation this editor inserted most recently. A single Backspace at exactly
   * that position turns it back into the space the user actually pressed.
   */
  autoPunctuationIndex: number | null;
}

export interface EditorPreferences {
  /** Insert a blank line between paragraphs so a wall of text stays readable. */
  autoBlankLine: boolean;
  /** Convert a typed space into `，` or `。`. */
  spaceToPunctuation: boolean;
  /** Typing `-` then space starts a list that continues on the next line. */
  listMode: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  autoBlankLine: true,
  spaceToPunctuation: true,
  listMode: true,
};

export type EditorInputEvent =
  | { type: 'insertText'; text: string }
  | { type: 'insertLineBreak' }
  | { type: 'deleteContentBackward' };

export const AUTO_PUNCTUATION = ['，', '。'] as const;
export type AutoPunctuation = (typeof AUTO_PUNCTUATION)[number];

/** A clause this long is treated as a finished sentence rather than a comma-separated fragment. */
export const SENTENCE_CLAUSE_THRESHOLD = 12;

const CLAUSE_BOUNDARIES = ['\n', '。', '！', '？', '!', '?', '；', ';'];
const LIST_MARKER = /^(\s*)- /;
const EMPTY_LIST_ITEM = /^\s*- $/;
const PENDING_LIST_ITEM = /^\s*-$/;

export function emptyEditorState(value = ''): EditorState {
  return {
    value,
    selectionStart: value.length,
    selectionEnd: value.length,
    autoPunctuationIndex: null,
  };
}

function replaceRange(
  state: EditorState,
  start: number,
  end: number,
  text: string,
  autoPunctuationIndex: number | null = null,
): EditorState {
  const value = state.value.slice(0, start) + text + state.value.slice(end);
  const caret = start + text.length;
  return { value, selectionStart: caret, selectionEnd: caret, autoPunctuationIndex };
}

function lineStartIndex(value: string, caret: number): number {
  return value.lastIndexOf('\n', caret - 1) + 1;
}

/** Start of the current clause, used to judge whether it reads like a finished sentence. */
export function clauseStartIndex(value: string, caret: number): number {
  let index = -1;
  for (const boundary of CLAUSE_BOUNDARIES) {
    index = Math.max(index, value.lastIndexOf(boundary, caret - 1));
  }
  return index + 1;
}

export function choosePunctuation(value: string, caret: number): AutoPunctuation {
  const clause = value.slice(clauseStartIndex(value, caret), caret).replace(/\s+/g, '');
  return clause.length >= SENTENCE_CLAUSE_THRESHOLD ? '。' : '，';
}

export function isInListItem(value: string, caret: number): boolean {
  return LIST_MARKER.test(value.slice(lineStartIndex(value, caret), caret));
}

/**
 * Applies one keystroke and returns the resulting editor state.
 *
 * The component is fully controlled, so callers always `preventDefault()` and adopt the returned
 * state — that is what keeps the mobile and desktop editors behaving identically.
 */
export function applyInput(
  state: EditorState,
  event: EditorInputEvent,
  preferences: EditorPreferences = DEFAULT_EDITOR_PREFERENCES,
): EditorState {
  switch (event.type) {
    case 'insertLineBreak':
      return handleLineBreak(state, preferences);
    case 'deleteContentBackward':
      return handleBackspace(state);
    case 'insertText':
      return handleText(state, event.text, preferences);
  }
}

function handleLineBreak(state: EditorState, preferences: EditorPreferences): EditorState {
  const { value, selectionStart, selectionEnd } = state;
  const collapsing = selectionStart === selectionEnd;
  const beforeCaret = value.slice(lineStartIndex(value, selectionStart), selectionStart);

  if (preferences.listMode && collapsing) {
    if (EMPTY_LIST_ITEM.test(beforeCaret)) {
      // Pressing Enter on an empty bullet ends the list instead of starting another one.
      const start = lineStartIndex(value, selectionStart);
      return replaceRange(state, start, selectionStart, '\n');
    }
    const marker = LIST_MARKER.exec(beforeCaret);
    if (marker) {
      return replaceRange(state, selectionStart, selectionEnd, `\n${marker[1] ?? ''}- `);
    }
  }

  return replaceRange(
    state,
    selectionStart,
    selectionEnd,
    preferences.autoBlankLine ? '\n\n' : '\n',
  );
}

function handleBackspace(state: EditorState): EditorState {
  const { selectionStart, selectionEnd, autoPunctuationIndex } = state;

  if (
    selectionStart === selectionEnd &&
    autoPunctuationIndex !== null &&
    selectionStart === autoPunctuationIndex + 1
  ) {
    // Undo the auto-punctuation: the user meant a space, not a comma.
    return replaceRange(state, autoPunctuationIndex, selectionStart, ' ');
  }

  const start = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
  return replaceRange(state, start, selectionEnd, '');
}

function handleText(state: EditorState, text: string, preferences: EditorPreferences): EditorState {
  if (text === ' ') {
    const { value, selectionStart, selectionEnd } = state;
    const collapsing = selectionStart === selectionEnd;
    const beforeCaret = value.slice(lineStartIndex(value, selectionStart), selectionStart);

    if (preferences.listMode && collapsing && PENDING_LIST_ITEM.test(beforeCaret)) {
      return replaceRange(state, selectionStart, selectionStart, ' ');
    }

    if (preferences.spaceToPunctuation && collapsing) {
      const punctuation = choosePunctuation(value, selectionStart);
      return replaceRange(state, selectionStart, selectionEnd, punctuation, selectionStart);
    }
  }

  return replaceRange(state, state.selectionStart, state.selectionEnd, text);
}

/** Insertion of a whole block (e.g. a transcript) that should not be transformed by input rules. */
export function insertText(state: EditorState, text: string): EditorState {
  return replaceRange(state, state.selectionStart, state.selectionEnd, text);
}

export function setValue(value: string): EditorState {
  return emptyEditorState(value);
}
