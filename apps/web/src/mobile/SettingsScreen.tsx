import { useState } from 'react';
import { useDevices, useLogout, useProviderStatus, useRevokeDevice, useSession } from '../lib/auth';
import { useOnline, usePendingCount } from '../lib/notes';
import { updateSettings, useSettings, type LayoutPreference } from '../lib/settings';

/** Mobile settings keep the essentials: who you are, how writing behaves, and what is signed in. */
export function SettingsScreen() {
  const session = useSession();
  const settings = useSettings();
  const devices = useDevices();
  const providers = useProviderStatus();
  const logout = useLogout();
  const revokeDevice = useRevokeDevice();
  const pending = usePendingCount();
  const online = useOnline();
  const [showDevices, setShowDevices] = useState(false);

  const user = session.data?.session?.user;

  return (
    <div className="mobile-settings">
      <h1 className="history__title">我的</h1>

      <section className="settings__section">
        <h2>{user?.displayName ?? '未登录'}</h2>
        <p className="muted">@{user?.username}</p>
        <p className="muted">
          {online ? '已连接' : '离线'}
          {pending > 0 ? ` · ${pending} 项待同步` : ' · 全部已同步'}
        </p>
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
          换行自动空一行
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
          空格自动转标点
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.editor.listMode}
            onChange={(event) =>
              updateSettings({ editor: { ...settings.editor, listMode: event.target.checked } })
            }
          />
          “-” 自动开始列表
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
        <h2>账号安全</h2>
        <p className="muted">两步验证：{user?.twoFactorEnabled ? '已启用' : '未启用'}</p>
        <p className="muted">剩余可用密保问题：{user?.unusedSecurityQuestions ?? 0} 个</p>
        {user?.mustResetQuestions ? (
          <p className="notice">需要重设密保问题后才能继续使用笔记功能。</p>
        ) : null}
        <p className="muted">完整的安全设置（2FA、密保问题、密码修改）请在桌面端完成。</p>
      </section>

      <section className="settings__section">
        <h2>登录设备</h2>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setShowDevices((v) => !v)}
        >
          {showDevices ? '收起' : `查看（${devices.data?.devices.length ?? 0}）`}
        </button>
        {showDevices ? (
          <ul className="devices">
            {(devices.data?.devices ?? []).map((device) => (
              <li key={device.id}>
                <span>
                  {device.label}
                  {device.trusted ? ' · 已信任' : ''}
                  {device.current ? ' · 当前设备' : ''}
                </span>
                {!device.current ? (
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => void revokeDevice.mutateAsync(device.id)}
                  >
                    移除
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="settings__section">
        <h2>服务状态</h2>
        <p className="muted">模型：{providers.data?.llm.provider ?? '…'}</p>
        <p className="muted">语音：{providers.data?.stt.provider ?? '…'}</p>
      </section>

      <section className="settings__section">
        <button type="button" className="button button--danger" onClick={() => logout.mutate()}>
          退出登录
        </button>
      </section>
    </div>
  );
}
