import { SECURITY_QUESTION_COUNT } from '@luminote/core';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { ApiClientError } from '../lib/api';
import { useSecurityQuestions, useSetSecurityQuestions } from '../lib/auth';
import { SecurityQuestionPicker } from './SecurityQuestions';

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

  const replaced = new Set(
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

  async function submit(event: FormEvent) {
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
    <div className="auth grid min-h-full place-items-center bg-surface-0 px-4 py-10">
      <div className="w-full max-w-2xl rounded-card border border-line bg-surface-1 p-5 shadow-sm sm:p-6">
        <h1 className="text-lg font-semibold text-fg">重设密保问题</h1>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">
          你刚刚用密保问题登录，需要重新设置全部 {SECURITY_QUESTION_COUNT} 个问题后才能继续使用。
        </p>

        {error ? (
          <div className="mt-4">
            <Notice tone="critical">{error}</Notice>
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <SecurityQuestionPicker
            catalog={catalog.data?.catalog ?? []}
            selected={selected}
            answers={answers}
            onToggle={toggle}
            onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
            replaced={replaced}
            disabled={save.isPending}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-xs text-fg-subtle">
              已选 <span className="tabular font-medium text-fg">{selected.length}</span> /{' '}
              {SECURITY_QUESTION_COUNT}
            </span>
            <Button type="submit" variant="primary" size="lg" loading={save.isPending}>
              保存并继续
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
