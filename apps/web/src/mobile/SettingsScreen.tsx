import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { Checkbox, Select } from '../components/Field';
import { ThemeToggle } from '../components/ThemeToggle';
import { useDevices, useLogout, useProviderStatus, useRevokeDevice, useSession } from '../lib/auth';
import { useOnline, usePendingCount } from '../lib/notes';
import { updateSettings, useSettings, type LayoutPreference } from '../lib/settings';

function MobileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{title}</h2>
        {children}
      </CardBody>
    </Card>
  );
}

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
    <div className="mobile-settings flex flex-col gap-3 p-4">
      <Card>
        <CardBody className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-base font-semibold text-accent-ink"
          >
            {(user?.displayName ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-fg">
              {user?.displayName ?? '未登录'}
            </span>
            <span className="tabular block truncate text-xs text-fg-muted">@{user?.username}</span>
          </span>
          <Badge tone={!online ? 'warning' : pending > 0 ? 'caution' : 'ok'}>
            {!online ? '离线' : pending > 0 ? `${pending} 待同步` : '已同步'}
          </Badge>
        </CardBody>
      </Card>

      <MobileSection title="写作偏好">
        <div className="flex flex-col">
          <Checkbox
            checked={settings.editor.autoBlankLine}
            onChange={(event) =>
              updateSettings({
                editor: { ...settings.editor, autoBlankLine: event.target.checked },
              })
            }
            label="换行自动空一行"
          />
          <Checkbox
            checked={settings.editor.spaceToPunctuation}
            onChange={(event) =>
              updateSettings({
                editor: { ...settings.editor, spaceToPunctuation: event.target.checked },
              })
            }
            label="空格自动转标点"
          />
          <Checkbox
            checked={settings.editor.listMode}
            onChange={(event) =>
              updateSettings({ editor: { ...settings.editor, listMode: event.target.checked } })
            }
            label="“-” 自动开始列表"
          />
        </div>

        <Select
          label="界面布局"
          value={settings.layout}
          onChange={(event) => updateSettings({ layout: event.target.value as LayoutPreference })}
          options={[
            { value: 'auto', label: '自动' },
            { value: 'desktop', label: '桌面端' },
            { value: 'mobile', label: '移动端' },
          ]}
        />

        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-sm text-fg">外观</span>
          <ThemeToggle size="lg" />
        </div>
      </MobileSection>

      <MobileSection title="账号安全">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-muted">两步验证</span>
          <Badge tone={user?.twoFactorEnabled ? 'ok' : 'neutral'}>
            {user?.twoFactorEnabled ? '已启用' : '未启用'}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-muted">剩余可用密保问题</span>
          <span className="tabular font-medium text-fg">{user?.unusedSecurityQuestions ?? 0}</span>
        </div>
        {user?.mustResetQuestions ? (
          <p className="rounded-lg border border-warning/50 bg-warning-soft px-3 py-2 text-xs text-warning">
            需要重设密保问题后才能继续使用笔记功能。
          </p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          完整的安全设置（2FA、密保问题、改密码）请在桌面端完成。
        </p>
      </MobileSection>

      <MobileSection title="登录设备">
        <Button size="lg" block variant="ghost" onClick={() => setShowDevices((value) => !value)}>
          {showDevices ? '收起' : `查看（${devices.data?.devices.length ?? 0}）`}
        </Button>
        {showDevices ? (
          <ul className="devices flex flex-col divide-y divide-line">
            {(devices.data?.devices ?? []).map((device) => (
              <li key={device.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm text-fg">
                    <span className="truncate">{device.label}</span>
                    {device.current ? <Badge tone="accent">当前</Badge> : null}
                    {device.trusted ? <Badge tone="ok">已信任</Badge> : null}
                  </span>
                  <span className="tabular mt-0.5 block text-[11px] text-fg-subtle">
                    最近使用 {new Date(device.lastSeenAt).toLocaleString()}
                  </span>
                </span>
                {!device.current ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void revokeDevice.mutateAsync(device.id)}
                  >
                    移除
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </MobileSection>

      <MobileSection title="服务状态">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-muted">模型</span>
          <span className="tabular text-fg">{providers.data?.llm.provider ?? '…'}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-fg-muted">语音</span>
          <span className="tabular text-fg">{providers.data?.stt.provider ?? '…'}</span>
        </div>
      </MobileSection>

      <Button size="lg" block variant="danger" onClick={() => logout.mutate()}>
        退出登录
      </Button>
    </div>
  );
}
