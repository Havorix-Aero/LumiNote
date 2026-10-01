import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_PREFERENCES,
  applyInput,
  choosePunctuation,
  emptyEditorState,
  insertText,
  type EditorState,
} from './input-rules';

function state(value: string, caret = value.length): EditorState {
  return { value, selectionStart: caret, selectionEnd: caret, autoPunctuationIndex: null };
}

const prefs = DEFAULT_EDITOR_PREFERENCES;

describe('newline handling', () => {
  it('inserts a blank line between paragraphs when the preference is on', () => {
    const next = applyInput(state('第一行'), { type: 'insertLineBreak' }, prefs);
    expect(next.value).toBe('第一行\n\n');
  });

  it('inserts a single newline when the preference is off', () => {
    const next = applyInput(
      state('第一行'),
      { type: 'insertLineBreak' },
      {
        ...prefs,
        autoBlankLine: false,
      },
    );
    expect(next.value).toBe('第一行\n');
  });

  it('continues a list on the next line', () => {
    const next = applyInput(state('- 买牛奶'), { type: 'insertLineBreak' }, prefs);
    expect(next.value).toBe('- 买牛奶\n- ');
  });

  it('preserves list indentation', () => {
    const next = applyInput(state('  - 子项'), { type: 'insertLineBreak' }, prefs);
    expect(next.value).toBe('  - 子项\n  - ');
  });

  it('ends the list when Enter is pressed on an empty bullet', () => {
    const next = applyInput(state('- '), { type: 'insertLineBreak' }, prefs);
    expect(next.value).toBe('\n');
  });
});

describe('list start on dash + space', () => {
  it('turns a leading dash plus space into a list item', () => {
    const next = applyInput(state('-'), { type: 'insertText', text: ' ' }, prefs);
    expect(next.value).toBe('- ');
    expect(next.autoPunctuationIndex).toBeNull();
  });

  it('does not start a list mid-sentence', () => {
    const next = applyInput(state('今天-'), { type: 'insertText', text: ' ' }, prefs);
    expect(next.value).not.toBe('今天- ');
  });
});

describe('space to punctuation', () => {
  it('uses a comma for a short clause', () => {
    const next = applyInput(state('先做音乐'), { type: 'insertText', text: ' ' }, prefs);
    expect(next.value).toBe('先做音乐，');
  });

  it('uses a full stop once the clause is long enough to be a sentence', () => {
    const next = applyInput(
      state('我想做一个能随时记录灵感的笔记本'),
      { type: 'insertText', text: ' ' },
      prefs,
    );
    expect(next.value.endsWith('。')).toBe(true);
  });

  it('restarts clause length after sentence-ending punctuation', () => {
    const next = applyInput(
      state('第一句已经结束了。新句子'),
      { type: 'insertText', text: ' ' },
      prefs,
    );
    expect(next.value.endsWith('，')).toBe(true);
  });

  it('is disabled when the preference is off', () => {
    const next = applyInput(
      state('先做音乐'),
      { type: 'insertText', text: ' ' },
      {
        ...prefs,
        spaceToPunctuation: false,
      },
    );
    expect(next.value).toBe('先做音乐 ');
  });
});

describe('backspace undo', () => {
  it('turns the auto punctuation back into a space in one press', () => {
    const typed = applyInput(state('先做音乐'), { type: 'insertText', text: ' ' }, prefs);
    expect(typed.value).toBe('先做音乐，');

    const undone = applyInput(typed, { type: 'deleteContentBackward' }, prefs);
    expect(undone.value).toBe('先做音乐 ');
    expect(undone.selectionStart).toBe('先做音乐 '.length);
  });

  it('deletes normally when the caret is not directly after auto punctuation', () => {
    const typed = applyInput(state('先做音乐'), { type: 'insertText', text: ' ' }, prefs);
    const moved: EditorState = { ...typed, selectionStart: 1, selectionEnd: 1 };
    const undone = applyInput(moved, { type: 'deleteContentBackward' }, prefs);
    expect(undone.value).toBe('做音乐，');
  });

  it('deletes normally when there is no auto punctuation to undo', () => {
    const next = applyInput(state('abc'), { type: 'deleteContentBackward' }, prefs);
    expect(next.value).toBe('ab');
  });
});

describe('choosePunctuation', () => {
  it('treats a clause at the threshold as a sentence', () => {
    const clause = '一二三四五六七八九十十一二';
    expect(clause.length).toBe(13);
    expect(choosePunctuation(clause, clause.length)).toBe('。');
  });

  it('ignores whitespace when measuring clause length', () => {
    const value = '一二三四五六   七八九十一二';
    expect(choosePunctuation(value, value.length)).toBe('。');
  });
});

describe('helpers', () => {
  it('emptyEditorState puts the caret at the end', () => {
    expect(emptyEditorState('hello').selectionStart).toBe(5);
  });

  it('insertText bypasses input rules', () => {
    const next = insertText(state('已有一段'), '（模拟转写）新的内容');
    expect(next.value).toBe('已有一段（模拟转写）新的内容');
  });
});
