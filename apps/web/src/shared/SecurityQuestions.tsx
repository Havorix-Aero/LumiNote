import type { SecurityQuestionPrompt } from '@luminote/core';
import { SECURITY_QUESTION_COUNT } from '@luminote/core';
import { TextInput } from '../components/Field';

export interface SecurityQuestionPickerProps {
  catalog: readonly SecurityQuestionPrompt[];
  selected: readonly string[];
  answers: Record<string, string>;
  onToggle: (key: string) => void;
  onAnswer: (key: string, value: string) => void;
  /** Questions currently provisioned on the account, shown as pending replacement. */
  replaced?: ReadonlySet<string>;
  disabled?: boolean;
}

/**
 * The catalogue of security questions with an inline answer box per selection.
 *
 * Shared by the settings screen and the forced reset after a recovery sign-in so the two stay
 * visually and behaviourally identical. The `questions__*` class names are part of the
 * end-to-end contract.
 */
export function SecurityQuestionPicker({
  catalog,
  selected,
  answers,
  onToggle,
  onAnswer,
  replaced,
  disabled = false,
}: SecurityQuestionPickerProps) {
  return (
    <ul className="questions__catalog flex flex-col gap-2">
      {catalog.map((question) => {
        const isSelected = selected.includes(question.key);
        return (
          <li key={question.key}>
            <label
              className={[
                'questions__option flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                isSelected
                  ? 'border-accent bg-accent-soft'
                  : 'border-line hover:border-line-strong hover:bg-surface-2',
                disabled ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={disabled || (!isSelected && selected.length >= SECURITY_QUESTION_COUNT)}
                onChange={() => onToggle(question.key)}
                className="size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1 text-sm text-fg">{question.prompt}</span>
              {replaced?.has(question.key) ? (
                <em className="shrink-0 text-xs text-fg-subtle not-italic">（已停用）</em>
              ) : null}
            </label>

            {isSelected ? (
              <div className="mt-2 pl-2">
                <TextInput
                  className="questions__answer"
                  aria-label={`${question.prompt} 的答案`}
                  value={answers[question.key] ?? ''}
                  onChange={(event) => onAnswer(question.key, event.target.value)}
                  placeholder="你的答案（不区分大小写与空格）"
                  disabled={disabled}
                  required
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
