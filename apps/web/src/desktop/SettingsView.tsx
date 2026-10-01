import { SECURITY_QUESTION_COUNT } from '@luminote/core';
import { useEffect, useState } from 'react';
import { ApiClientError } from '../lib/api';
import {
  useChangePassword,
  useDevices,
  useDisableTwoFactor,
  useEnableTwoFactor,
  useProviderStatus,
  useRevokeDevice,
  useSecurityQuestions,
  useSession,
  useSetSecurityQuestions,
  useTwoFactorSetup,
  useUpdateProfile,
} from '../lib/auth';
import { useSettings, updateSettings, type LayoutPreference } from '../lib/settings';

export function SettingsView() {
  const session = useSession();
  const settings = useSettings();
  const providers = useProviderStatus();
  const devices = useDevices();
  const securityQuestions = useSecurityQuestions();

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const setupTwoFactor = useTwoFactorSetup();
  const enableTwoFactor = useEnableTwoFactor();
  const disableTwoFactor = useDisableTwoFactor();
  const setQuestions = useSetSecurityQuestions();
  const revokeDevice = useRevokeDevice();

  const user = session.data?.session?.user;

  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setDisplayName(user.displayName);
  }, [user]);

  function reportError(value: unknown) {
    setError(value instanceof ApiClientError ? value.message : '操作失败，请稍后重试。');
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
    } catch (value) {
      reportError(value);
    }
  }

  const catalog = securityQuestions.data?.catalog ?? [];
  const entries = securityQuestions.data?.entries ?? [];

  return (
    <div className="settings">
      <h1 className="settings__title">设置</h1>
      {error ? <p className="auth__error">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}

      <section className="settings__section">
        <h2>个人资料</h2>
        <label>
          昵称
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <button
          type="button"
          className="button"
          onClick={() => void run(() => updateProfile.mutateAsync(displayName), '昵称已更新。')}
        >
          保存昵称
        </button>
        <p className="muted">用户名：{user?.username}</p>
      </section>

      <section className="settings__section">
        <h2>写作偏好</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.editor.autoBlankLine}
            onChange={(event) =>
              updateSettings({
                editor: { ...settings.editor, autoBlankLine: event.target.checked },
              })
            }
          />
          换行时自动空一行，保持段落可读
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.editor.spaceToPunctuation}
            onChange={(event) =>
              updateSettings({
                editor: { ...settings.editor, spaceToPunctuation: event.target.checked },
              })
            }
          />
          空格自动转为 “，” 或 “。”（按一次退格还原）
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.editor.listMode}
            onChange={(event) =>
              updateSettings({ editor: { ...settings.editor, listMode: event.target.checked } })
            }
          />
          输入 “-” 加空格自动开始列表
        </label>
        <label>
          界面布局
          <select
            value={settings.layout}
            onChange={(event) => updateSettings({ layout: event.target.value as LayoutPreference })}
          >
            <option value="auto">自动</option>
            <option value="desktop">桌面端</option>
            <option value="mobile">移动端</option>
          </select>
        </label>
      </section>

      <section className="settings__section">
        <h2>修改密码</h2>
        <label>
          当前密码
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          新密码
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="button"
          onClick={() =>
            void run(async () => {
              await changePassword.mutateAsync({ currentPassword, newPassword });
              setCurrentPassword('');
              setNewPassword('');
            }, '密码已更新，其它设备需要重新登录。')
          }
        >
          更新密码
        </button>
      </section>

      <section className="settings__section">
        <h2>两步验证（2FA）</h2>
        {user?.twoFactorEnabled ? (
          <>
            <p className="muted">已启用。关闭后新设备登录将不再需要动态验证码。</p>
            <label>
              输入密码以关闭
              <input
                type="password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="button button--danger"
              onClick={() =>
                void run(async () => {
                  await disableTwoFactor.mutateAsync(disablePassword);
                  setDisablePassword('');
                }, '两步验证已关闭。')
              }
            >
              关闭两步验证
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="button"
              onClick={() =>
                void run(async () => {
                  const result = await setupTwoFactor.mutateAsync();
                  setTotpSecret(result.secret);
                }, '请用验证器扫描或手动输入密钥，然后输入 6 位验证码完成绑定。')
              }
            >
              开始设置
            </button>
            {totpSecret ? (
              <>
                <p className="settings__secret">
                  密钥：<code>{totpSecret}</code>
                </p>
                <label>
                  验证码
                  <input value={code} onChange={(event) => setCode(event.target.value)} />
                </label>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() =>
                    void run(async () => {
                      const result = await enableTwoFactor.mutateAsync(code);
                      setBackupCodes(result.backupCodes);
                      setTotpSecret(null);
                      setCode('');
                    }, '两步验证已启用，请妥善保存备用码。')
                  }
                >
                  确认启用
                </button>
              </>
            ) : null}
            {backupCodes ? (
              <div className="settings__backup">
                <p>备用码（每个只能用一次）：</p>
                <ul>
                  {backupCodes.map((value) => (
                    <li key={value}>
                      <code>{value}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="settings__section">
        <h2>密保问题</h2>
        <p className="muted">
          已启用 {entries.filter((entry) => entry.active).length} / {SECURITY_QUESTION_COUNT}，
          已消耗 {entries.filter((entry) => !entry.active).length}。 在无法使用 2FA
          的新设备上，可消耗一个问题登录。
        </p>
        <ul className="questions__catalog">
          {catalog.map((question) => {
            const isSelected = selected.includes(question.key);
            return (
              <li key={question.key}>
                <label className={`questions__option${isSelected ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(question.key)
                          ? current.filter((item) => item !== question.key)
                          : current.length >= SECURITY_QUESTION_COUNT
                            ? current
                            : [...current, question.key],
                      )
                    }
                  />
                  <span>{question.prompt}</span>
                </label>
                {isSelected ? (
                  <input
                    className="questions__answer"
                    value={answers[question.key] ?? ''}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.key]: event.target.value }))
                    }
                    placeholder="你的答案"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="button"
          disabled={selected.length !== SECURITY_QUESTION_COUNT}
          onClick={() =>
            void run(async () => {
              await setQuestions.mutateAsync(
                selected.map((key) => ({ key, answer: answers[key] ?? '' })),
              );
              setSelected([]);
              setAnswers({});
            }, '密保问题已更新。')
          }
        >
          保存密保问题（已选 {selected.length}/{SECURITY_QUESTION_COUNT}）
        </button>
      </section>

      <section className="settings__section">
        <h2>登录设备</h2>
        <ul className="devices">
          {(devices.data?.devices ?? []).map((device) => (
            <li key={device.id}>
              <span>
                {device.label}
                {device.trusted ? ' · 已信任' : ''}
                {device.current ? ' · 当前设备' : ''}
              </span>
              <span className="muted">最近使用 {new Date(device.lastSeenAt).toLocaleString()}</span>
              {!device.current ? (
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() =>
                    void run(() => revokeDevice.mutateAsync(device.id), '设备已移除。')
                  }
                >
                  移除
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="settings__section">
        <h2>模型与语音服务</h2>
        <p className="muted">
          大语言模型：{providers.data?.llm.provider ?? '…'}
          {providers.data ? (providers.data.llm.configured ? '（已配置）' : '（未配置密钥）') : ''}
        </p>
        <p className="muted">语音转写：{providers.data?.stt.provider ?? '…'}</p>
        <p className="muted">分词：{providers.data?.segmenter.provider ?? '…'}</p>
      </section>
    </div>
  );
}
