import { SECURITY_QUESTION_COUNT } from '@luminote/core';
import { useState } from 'react';
import { ApiClientError } from '../lib/api';
import { useSecurityQuestions, useSetSecurityQuestions } from '../lib/auth';

/**
 * Non-skippable screen shown after a security-question login.
 *
 * Consuming a question is only safe if the account immediately gets a fresh, full set — otherwise
 * the recovery path degrades a little with every use.
 */
export function QuestionReset({ onDone }: { onDone: () => void }) {
  const catalog = useSecurityQuestions();
  const save = useSetSecurityQuestions();
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const previouslyUsed = new Set(
    (catalog.data?.entries ?? []).filter((entry) => entry.active).map((entry) => entry.key),
  );

  function toggle(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : current.length >= SECURITY_QUESTION_COUNT
          ? current
          : [...current, key],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (selected.length !== SECURITY_QUESTION_COUNT) {
      setError(`请选择 ${SECURITY_QUESTION_COUNT} 个问题。`);
      return;
    }
    try {
      await save.mutateAsync(selected.map((key) => ({ key, answer: answers[key] ?? '' })));
      onDone();
    } catch (value) {
      setError(value instanceof ApiClientError ? value.message : '保存失败，请重试。');
    }
  }

  return (
    <div className="auth">
      <div className="auth__card auth__card--wide">
        <h1 className="auth__title">重设密保问题</h1>
        <p className="auth__subtitle">
          你刚刚用密保问题登录，需要重新设置全部 {SECURITY_QUESTION_COUNT} 个问题后才能继续使用。
        </p>
        {error ? <p className="auth__error">{error}</p> : null}
        <form onSubmit={submit} className="questions">
          <ul className="questions__catalog">
            {(catalog.data?.catalog ?? []).map((question) => {
              const isSelected = selected.includes(question.key);
              return (
                <li key={question.key}>
                  <label className={`questions__option${isSelected ? ' is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(question.key)}
                    />
                    <span>{question.prompt}</span>
                    {previouslyUsed.has(question.key) ? (
                      <em className="muted">（已停用）</em>
                    ) : null}
                  </label>
                  {isSelected ? (
                    <input
                      className="questions__answer"
                      value={answers[question.key] ?? ''}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [question.key]: event.target.value,
                        }))
                      }
                      placeholder="你的答案（不区分大小写与空格）"
                      required
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button type="submit" className="button button--primary" disabled={save.isPending}>
            保存并继续（已选 {selected.length}/{SECURITY_QUESTION_COUNT}）
          </button>
        </form>
      </div>
    </div>
  );
}
