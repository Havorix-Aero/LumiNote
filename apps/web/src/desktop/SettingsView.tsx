import { SECURITY_QUESTION_COUNT } from '@luminote/core';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, CardBody } from '../components/Card';
import { Checkbox, Select, TextInput } from '../components/Field';
import { Notice, PageHeader } from '../components/Notice';
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
import { SecurityQuestionPicker } from '../shared/SecurityQuestions';

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{description}</p>
          ) : null}
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

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
  const activeCount = entries.filter((entry) => entry.active).length;
  const consumedCount = entries.filter((entry) => !entry.active).length;

  function toggleQuestion(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : current.length >= SECURITY_QUESTION_COUNT
          ? current
          : [...current, key],
    );
  }

  return (
    <div className="settings mx-auto flex max-w-3xl flex-col gap-5 p-6 lg:p-8">
      <PageHeader title="设置" description="账号安全、写作习惯与模型接入都在这里。" />

      {error ? <Notice tone="critical">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      <SettingsSection title="个人资料">
        <div className="flex flex-col gap-3 sm:max-w-sm">
          <TextInput
            label="昵称"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={() => void run(() => updateProfile.mutateAsync(displayName), '昵称已更新。')}
              loading={updateProfile.isPending}
            >
              保存昵称
            </Button>
            <span className="text-xs text-fg-subtle">用户名：{user?.username}</span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="写作偏好" description="这些开关直接影响编辑器的自动行为。">
        <div className="flex flex-col gap-1">
          <Checkbox
            checked={settings.editor.autoBlankLine}
            onChange={(event) =>
              updateSettings({
                editor: { ...settings.editor, autoBlankLine: event.target.checked },
              })
            }
            label="换行时自动空一行，保持段落可读"
          />
          <Checkbox
            checked={settings.editor.spaceToPunctuation}
            onChange={(event) =>
              updateSettings({
                editor: { ...settings.editor, spaceToPunctuation: event.target.checked },
              })
            }
            label="空格自动转为 “，” 或 “。”"
            hint="按一次退格即可还原成空格。"
          />
          <Checkbox
            checked={settings.editor.listMode}
            onChange={(event) =>
              updateSettings({ editor: { ...settings.editor, listMode: event.target.checked } })
            }
            label="输入 “-” 加空格自动开始列表"
          />
        </div>

        <div className="sm:max-w-xs">
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
        </div>
      </SettingsSection>

      <SettingsSection title="修改密码" description="修改后其它设备需要重新登录。">
        <div className="flex flex-col gap-3 sm:max-w-sm">
          <TextInput
            label="当前密码"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <TextInput
            label="新密码"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <div>
            <Button
              onClick={() =>
                void run(async () => {
                  await changePassword.mutateAsync({ currentPassword, newPassword });
                  setCurrentPassword('');
                  setNewPassword('');
                }, '密码已更新，其它设备需要重新登录。')
              }
              loading={changePassword.isPending}
            >
              更新密码
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="两步验证（2FA）"
        description="开启后，新设备登录需要输入验证器上的 6 位动态验证码。"
      >
        <div className="flex items-center gap-2">
          <Badge tone={user?.twoFactorEnabled ? 'ok' : 'neutral'} solid={user?.twoFactorEnabled}>
            {user?.twoFactorEnabled ? '已启用' : '未启用'}
          </Badge>
        </div>

        {user?.twoFactorEnabled ? (
          <div className="flex flex-col gap-3 sm:max-w-sm">
            <TextInput
              label="输入密码以关闭"
              type="password"
              value={disablePassword}
              onChange={(event) => setDisablePassword(event.target.value)}
            />
            <div>
              <Button
                variant="danger"
                onClick={() =>
                  void run(async () => {
                    await disableTwoFactor.mutateAsync(disablePassword);
                    setDisablePassword('');
                  }, '两步验证已关闭。')
                }
                loading={disableTwoFactor.isPending}
              >
                关闭两步验证
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:max-w-sm">
            <div>
              <Button
                onClick={() =>
                  void run(async () => {
                    const result = await setupTwoFactor.mutateAsync();
                    setTotpSecret(result.secret);
                  }, '请用验证器扫描或手动输入密钥，然后输入 6 位验证码完成绑定。')
                }
                loading={setupTwoFactor.isPending}
              >
                开始设置
              </Button>
            </div>

            {totpSecret ? (
              <>
                <div className="settings__secret flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">
                    密钥（手动输入到验证器）
                  </span>
                  <code className="block rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm tracking-wider break-all text-fg select-all">
                    {totpSecret}
                  </code>
                </div>
                <TextInput
                  label="验证码"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <div>
                  <Button
                    variant="primary"
                    onClick={() =>
                      void run(async () => {
                        const result = await enableTwoFactor.mutateAsync(code);
                        setBackupCodes(result.backupCodes);
                        setTotpSecret(null);
                        setCode('');
                      }, '两步验证已启用，请妥善保存备用码。')
                    }
                    loading={enableTwoFactor.isPending}
                  >
                    确认启用
                  </Button>
                </div>
              </>
            ) : null}

            {backupCodes ? (
              <div className="settings__backup flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
                <p className="text-xs text-fg-muted">备用码（每个只能用一次）：</p>
                <ul className="grid grid-cols-2 gap-1.5">
                  {backupCodes.map((value) => (
                    <li key={value}>
                      <code className="tabular font-mono text-xs text-fg">{value}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="密保问题">
        <p className="text-xs leading-relaxed text-fg-muted">
          已启用 <span className="tabular font-medium text-fg">{activeCount}</span> /{' '}
          {SECURITY_QUESTION_COUNT}，已消耗{' '}
          <span className="tabular font-medium text-fg">{consumedCount}</span>。 在无法使用 2FA
          的新设备上，可消耗一个问题登录。
        </p>

        <SecurityQuestionPicker
          catalog={catalog}
          selected={selected}
          answers={answers}
          onToggle={toggleQuestion}
          onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
          disabled={setQuestions.isPending}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">
            已选 <span className="tabular font-medium text-fg">{selected.length}</span> /{' '}
            {SECURITY_QUESTION_COUNT}
          </span>
          <Button
            disabled={selected.length !== SECURITY_QUESTION_COUNT}
            loading={setQuestions.isPending}
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
            保存密保问题
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="登录设备" description="移除设备会立即结束它上面的会话。">
        <ul className="devices flex flex-col divide-y divide-line">
          {(devices.data?.devices ?? []).map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm text-fg">
                  <span className="truncate">{device.label}</span>
                  {device.current ? <Badge tone="accent">当前设备</Badge> : null}
                  {device.trusted ? <Badge tone="ok">已信任</Badge> : null}
                </span>
                <span className="tabular mt-0.5 block text-xs text-fg-subtle">
                  最近使用 {new Date(device.lastSeenAt).toLocaleString()}
                </span>
              </span>
              {!device.current ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    void run(() => revokeDevice.mutateAsync(device.id), '设备已移除。')
                  }
                >
                  移除
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection title="模型与语音服务" description="由服务端配置，客户端只做展示。">
        <dl className="grid gap-2 sm:grid-cols-3">
          {[
            {
              label: '大语言模型',
              value: providers.data?.llm.provider ?? '…',
              ok: providers.data?.llm.configured ?? false,
            },
            { label: '语音转写', value: providers.data?.stt.provider ?? '…', ok: true },
            { label: '分词', value: providers.data?.segmenter.provider ?? '…', ok: true },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
            >
              <dt className="text-xs text-fg-muted">{row.label}</dt>
              <dd className="flex items-center gap-2">
                <span className="tabular text-xs font-medium text-fg">{row.value}</span>
                {row.label === '大语言模型' ? (
                  <Badge tone={row.ok ? 'ok' : 'caution'}>{row.ok ? '已配置' : '未配置密钥'}</Badge>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </SettingsSection>
    </div>
  );
}
