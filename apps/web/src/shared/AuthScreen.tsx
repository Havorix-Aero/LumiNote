import type { SecurityQuestionPrompt } from '@luminote/core';
import { useState } from 'react';
import { ApiClientError } from '../lib/api';
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
    setError(value instanceof ApiClientError ? value.message : '操作失败，请稍后重试。');
  }

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
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

  async function submitTwoFactor(event: React.FormEvent) {
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

  async function submitRecovery(event: React.FormEvent) {
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

  return (
    <div className="auth">
      <div className="auth__card">
        <h1 className="auth__title">LumiNote</h1>
        <p className="auth__subtitle">
          {stage.kind === 'credentials' && '先记下来，再想清楚。'}
          {stage.kind === 'register' && '创建一个账号，灵感随手可记。'}
          {stage.kind === 'two-factor' && '请完成两步验证。'}
          {stage.kind === 'recovery' && '使用密保问题登录。'}
        </p>

        {error ? <p className="auth__error">{error}</p> : null}

        {(stage.kind === 'credentials' || stage.kind === 'register') && (
          <form onSubmit={submitCredentials} className="auth__form">
            <label>
              用户名
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                required
                minLength={3}
              />
            </label>
            {stage.kind === 'register' ? (
              <label>
                昵称（可选）
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                />
              </label>
            ) : null}
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={stage.kind === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={stage.kind === 'register' ? 10 : undefined}
              />
            </label>
            {stage.kind === 'register' ? (
              <p className="muted">密码至少 10 位，建议使用一句只有你记得的话。</p>
            ) : null}
            <button type="submit" className="button button--primary" disabled={busy}>
              {stage.kind === 'register' ? '注册并登录' : '登录'}
            </button>
          </form>
        )}

        {stage.kind === 'two-factor' ? (
          <form onSubmit={submitTwoFactor} className="auth__form">
            <label>
              动态验证码
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(event) => setTrustDevice(event.target.checked)}
              />
              信任此设备，下次免验证
            </label>
            <button type="submit" className="button button--primary" disabled={busy}>
              验证并登录
            </button>
            {stage.recoveryAvailable ? (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => void beginRecovery()}
                disabled={busy}
              >
                无法使用验证器？用密保问题登录
              </button>
            ) : null}
          </form>
        ) : null}

        {stage.kind === 'recovery' ? (
          <form onSubmit={submitRecovery} className="auth__form">
            <p className="auth__question">{stage.question.prompt}</p>
            <label>
              你的答案
              <input value={answer} onChange={(event) => setAnswer(event.target.value)} required />
            </label>
            <button type="submit" className="button button--primary" disabled={busy}>
              使用密保问题登录
            </button>
            <p className="muted">这个密保问题会被消耗掉。登录后需要重新设置全部密保问题。</p>
          </form>
        ) : null}

        <button
          type="button"
          className="auth__switch"
          onClick={() => {
            setError(null);
            setStage(stage.kind === 'register' ? { kind: 'credentials' } : { kind: 'register' });
          }}
        >
          {stage.kind === 'register' ? '已有账号？去登录' : '还没有账号？去注册'}
        </button>
      </div>
    </div>
  );
}
