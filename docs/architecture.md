# 架构说明

## 总览

```
┌──────────────── 单个 Cloudflare Worker（同源部署） ────────────────┐
│  /            → 静态资源（SPA、PWA manifest、service worker）      │
│  /api/v1/*    → Hono 路由                                          │
│                 ├─ auth      注册 / 登录 / 2FA / 密保恢复 / 会话    │
│                 ├─ me        资料、2FA、密保问题、设备             │
│                 ├─ notes     笔记 CRUD + 版本历史                  │
│                 ├─ sync      pull / push（变更日志）               │
│                 ├─ ai        LLM 接口（SSE 流式）                  │
│                 └─ stt       语音转写接口                          │
│  Bindings: D1（关系数据） · R2（音频） · Secrets（密钥）           │
└──────────────────────────────────────────────────────────────────┘
                                  ▲
                    httpOnly 会话 Cookie（同源，无 CORS）
                                  │
┌──────────────────────── Web PWA（Vite + React） ──────────────────┐
│  IndexedDB（Dexie）本地优先存储 + outbox ──► 同步引擎              │
│  路由层拆分：/desktop/* 与 /mobile/*（两套独立组件树）             │
│  Service Worker：离线外壳，断网也能立即记录                        │
└──────────────────────────────────────────────────────────────────┘
```

**为什么是单 Worker 同源部署**：没有 CORS、Cookie 天然可用、只有一个部署目标，而且 PWA 与 API 同源——对一个离线优先的可安装应用来说这点很重要。

## 分层

| 包          | 职责                             | 依赖                            |
| ----------- | -------------------------------- | ------------------------------- |
| `core`      | 领域类型、zod 契约、错误码、常量 | 无                              |
| `editor`    | 输入规则引擎（纯函数、无框架）   | 无                              |
| `versions`  | 快照策略、行级 diff、保留策略    | `core`                          |
| `providers` | LLM / STT / 分词接口与实现       | `core`                          |
| `worker`    | HTTP 层、鉴权、D1 访问、定时任务 | `core`、`versions`、`providers` |
| `web`       | 界面与离线仓库                   | 以上全部                        |

界面层永远不直接读服务器数据：所有渲染都来自 IndexedDB。

## 数据模型

```
users(id, username, display_name, status, two_factor_enabled, ...)
credentials(user_id, password_hash, algo, params_json, changed_at)
totp(user_id, secret_enc, enabled, confirmed_at, backup_codes_hash)
security_questions(id, user_id, question_key, answer_hash, answer_salt, consumed_at)
recovery_state(user_id, must_reset_questions, last_recovery_at, recovery_count)
devices(id, user_id, label, platform, token_hash, trusted, revoked_at)
sessions(id, user_id, device_id, token_hash, scope, expires_at, absolute_expires_at)
auth_challenges(id, user_id, device_id, kind, token_hash, question_id, expires_at)
notes(id, user_id, title, body, pinned, rev, created_at, updated_at, deleted_at)
note_versions(id, note_id, user_id, title, body, source, label, device_id, bytes, pinned,
              restored_from_id, created_at)
change_log(seq AUTOINCREMENT, user_id, entity, entity_id, op, rev, created_at)
sync_cursors(user_id, device_id, last_seq)
audit_log(id, user_id, event, ip_hash, ua_hash, meta_json, created_at)
rate_limits(bucket_key, window_start, count)
```

`notes.rev` 是服务端分配、单调递增的版本号；`change_log.seq` 是全局游标，驱动增量拉取。

## 离线优先与同步

1. 所有写入先落到 IndexedDB，UI 只读本地状态，因此记录是瞬时且不依赖网络的。
2. 写入同时进入 `outbox`（键为 `entity:entityId`，同一对象的多次修改会合并成一条待同步变更）。
3. 同步引擎先 **push** 再 **pull**：先让服务端裁决冲突，客户端再接收结果，用户不会眼睁睁看着自己的文字被覆盖。
4. 冲突策略是 last-write-wins（比较 `updatedAt`）；**失败的一方不会被丢弃**——服务端会把它保存成一个 `source = import`、标签为“冲突副本”的历史版本。
5. `change_log` 由每个用户最慢的设备游标决定保留范围；被撤销设备的游标会被清理，避免一条退役设备永久拖住日志。

同步在三种时机触发：定时（15s）、重新联网、页面重新可见。

## 版本历史

- **自动**：每段编辑会话一次。会话边界由“空闲窗口”（5 分钟）推断——窗口内不重复快照。快照保存的是**编辑前**的内容，也就是用户最可能想找回的那一版。
- **手动**：“保存版本”按钮或 `Ctrl/Cmd+S`。
- 恢复不会改写历史：它会追加一个 `source = restore` 的新版本，并记录 `restored_from_id`。
- 自动快照会被**去重**（与上一版完全相同则跳过）并按天折叠保留 90 天；手动、固定（pinned）、恢复版本永不清理。

## 界面隔离

移动端与桌面端是两棵组件树，只共享 `packages/ui` 级别的原子组件。这条约束由 ESLint 的 `no-restricted-imports` 分区规则强制，而不是靠约定：

- `apps/web/src/mobile/**` 不得引用 `desktop/**`
- `apps/web/src/desktop/**` 不得引用 `mobile/**`

布局由视口与指针类型自动判定，也可以在设置里手动覆盖（方便在桌面上预览移动端）。

## 输入规则引擎

编辑体验是整个产品的核心，所以规则被抽成不依赖 DOM 的纯函数（`packages/editor`），让移动端和桌面端行为完全一致，并且可以在没有浏览器的情况下测试。

组件是完全受控的 textarea：所有按键都先经过 `applyInput`，再采用它返回的状态。这样“空格转标点后按一次退格还原”这类行为才是确定性的。

## 定时任务

每天 03:17（UTC）运行一次：

- 折叠超过保留期的自动版本（每天保留一条，固定/手动版本不动）
- 清理已被所有设备消费的 `change_log` 行与失效设备的同步游标
- 删除过期的登录挑战与过期的限流计数
