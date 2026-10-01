import type { SecurityQuestionPrompt } from '@luminote/core';
import { describeUsernameProblem } from '@luminote/core';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../components/Button';
import { Checkbox, TextInput } from '../components/Field';
import { ThemeToggle } from '../components/ThemeToggle';
import { describeClientError } from '../lib/api';
import {
  useLogin,
  useRegister,
  useStartRecovery,
  useVerifyRecovery,
  useVerifyTwoFactor,
} from '../lib/auth';

type Stage =
  | { kind: 'credentials' }
  | { kind: 'register' }
  | { kind: 'two-factor'; challengeToken: string; recoveryAvailable: boolean }
  | { kind: 'recovery'; recoveryToken: string; question: SecurityQuestionPrompt };

interface AuthScreenProps {
  /** Called after a successful sign-in so the caller can refresh session state. */
  onAuthenticated: () => void;
}

const SUBTITLES: Record<Stage['kind'], string> = {
  credentials: '先记下来，再想清楚。',
  register: '创建一个账号，灵感随手可记。',
  'two-factor': '请完成两步验证。',
  recovery: '使用密保问题登录。',
};

function stageTitle(stage: Stage): string {
  if (stage.kind === 'register') return '注册账号';
  if (stage.kind === 'recovery') return '密保问题登录';
  if (stage.kind === 'two-factor') return '两步验证';
  return '登录';
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'credentials' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [answer, setAnswer] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const login = useLogin();
  const register = useRegister();
  const verifyTwoFactor = useVerifyTwoFactor();
  const startRecovery = useStartRecovery();
  const verifyRecovery = useVerifyRecovery();

  const busy =
    login.isPending ||
    register.isPending ||
    verifyTwoFactor.isPending ||
    startRecovery.isPending ||
    verifyRecovery.isPending;

  function reportError(value: unknown) {
    setError(describeClientError(value));
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Catch a malformed name here: the server only answers 422 "请求参数校验失败", which leaves
    // the user with no idea which field is wrong. Login still accepts any string, because a
    // registered account must never be shut out by a rule introduced after it was created.
    const usernameProblem = describeUsernameProblem(username);
    if (usernameProblem !== null) {
      setError(
        stage.kind === 'register'
          ? usernameProblem
          : `${usernameProblem}。请检查用户名，或改用「还没有账号？去注册」创建账号。`,
      );
      return;
    }

    try {
      const result =
        stage.kind === 'register'
          ? await register.mutateAsync({
              username,
              password,
              displayName: displayName || undefined,
            })
          : await login.mutateAsync({ username, password });
      handleLoginResponse(result);
    } catch (value) {
      reportError(value);
    }
  }

  function handleLoginResponse(result: { status: string; [key: string]: unknown }) {
    if (result.status === 'authenticated') {
      onAuthenticated();
      return;
    }
    if (result.status === 'two_fa_required') {
      setStage({
        kind: 'two-factor',
        challengeToken: result.challengeToken as string,
        recoveryAvailable: result.recoveryAvailable as boolean,
      });
      setPassword('');
      setCode('');
    }
  }

  async function submitTwoFactor(event: FormEvent) {
    event.preventDefault();
    if (stage.kind !== 'two-factor') return;
    setError(null);
    try {
      const result = await verifyTwoFactor.mutateAsync({
        challengeToken: stage.challengeToken,
        code,
        trustDevice,
      });
      handleLoginResponse(result);
    } catch (value) {
      reportError(value);
    }
  }

  async function beginRecovery() {
    if (stage.kind !== 'two-factor') return;
    setError(null);
    try {
      const result = await startRecovery.mutateAsync(stage.challengeToken);
      setStage({
        kind: 'recovery',
        recoveryToken: result.recoveryToken,
        question: result.question,
      });
      setAnswer('');
    } catch (value) {
      reportError(value);
    }
  }

  async function submitRecovery(event: FormEvent) {
    event.preventDefault();
    if (stage.kind !== 'recovery') return;
    setError(null);
    try {
      const result = await verifyRecovery.mutateAsync({
        recoveryToken: stage.recoveryToken,
        answer,
      });
      handleLoginResponse(result);
    } catch (value) {
      reportError(value);
    }
  }

  const isRegister = stage.kind === 'register';

  return (
    <div className="auth relative grid min-h-full place-items-center overflow-hidden bg-surface-0 px-4 py-10">
      {/*
        Decorative glow built from the accent tokens, so it follows the theme instead of being a
        hard-coded colour that only works in one of them.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-80 opacity-70 blur-3xl"
        style={{
          backgroundImage:
            'radial-gradient(45% 60% at 50% 50%, var(--accent-soft) 0%, transparent 100%)',
        }}
      />

      <div className="absolute top-3 right-3 z-10">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-xl bg-accent text-lg text-accent-fg"
          >
            ✦
          </span>
          <div className="min-w-0">
            <h1 className="text-xl leading-tight font-semibold tracking-tight text-fg">LumiNote</h1>
            <p className="text-xs text-fg-muted">想到什么，就先写下来</p>
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface-1 p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-semibold text-fg">{stageTitle(stage)}</h2>
          <p className="mt-1 text-sm text-fg-muted">{SUBTITLES[stage.kind]}</p>

          {error ? (
            <p
              role="alert"
              className="auth__error mt-4 rounded-lg border border-critical/50 bg-critical-soft px-3 py-2 text-sm leading-relaxed text-critical"
            >
              {error}
            </p>
          ) : null}

          {(stage.kind === 'credentials' || stage.kind === 'register') && (
            <form onSubmit={submitCredentials} className="mt-4 flex flex-col gap-3">
              <TextInput
                label="用户名"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                required
                minLength={3}
              />
              {isRegister ? (
                <TextInput
                  label="昵称（可选）"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                />
              ) : null}
              <TextInput
                label="密码"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 10 : undefined}
                hint={isRegister ? '至少 10 位，建议用一句只有你记得的话。' : undefined}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={busy}
                className="mt-1"
              >
                {isRegister ? '注册并登录' : '登录'}
              </Button>
            </form>
          )}

          {stage.kind === 'two-factor' ? (
            <form onSubmit={submitTwoFactor} className="mt-4 flex flex-col gap-3">
              <TextInput
                label="动态验证码"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
              />
              <Checkbox
                checked={trustDevice}
                onChange={(event) => setTrustDevice(event.target.checked)}
                label="信任此设备，下次免验证"
              />
              <Button type="submit" variant="primary" size="lg" block loading={busy}>
                验证并登录
              </Button>
              {stage.recoveryAvailable ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void beginRecovery()}
                  disabled={busy}
                  block
                >
                  无法使用验证器？用密保问题登录
                </Button>
              ) : null}
            </form>
          ) : null}

          {stage.kind === 'recovery' ? (
            <form onSubmit={submitRecovery} className="mt-4 flex flex-col gap-3">
              <p className="auth__question rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg">
                {stage.question.prompt}
              </p>
              <TextInput
                label="你的答案"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                autoFocus
                required
              />
              <Button type="submit" variant="primary" size="lg" block loading={busy}>
                使用密保问题登录
              </Button>
              <p className="text-xs leading-relaxed text-fg-subtle">
                这个密保问题会被消耗掉，登录后需要重新设置全部密保问题。
              </p>
            </form>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          block
          className="auth__switch mt-4"
          onClick={() => {
            setError(null);
            setStage(isRegister ? { kind: 'credentials' } : { kind: 'register' });
          }}
        >
          {isRegister ? '已有账号？去登录' : '还没有账号？去注册'}
        </Button>
      </div>
    </div>
  );
}
