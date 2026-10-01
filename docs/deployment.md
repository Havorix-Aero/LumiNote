# 部署到 Cloudflare

本项目是一个 **单个 Worker**：既提供 `/api/v1/*`，也通过 `assets` 绑定提供前端静态资源。同源部署意味着没有 CORS，Cookie 直接可用。

## 1. 登录

```bash
pnpm --filter @luminote/worker exec wrangler login
```

## 2. 创建资源

```bash
pnpm --filter @luminote/worker exec wrangler d1 create luminote
pnpm --filter @luminote/worker exec wrangler r2 bucket create luminote-audio
```

`d1 create` 会打印 `database_id`，把它填进 `packages/worker/wrangler.toml` 中 `database_id` 的位置（当前是占位符 `REPLACE_WITH_D1_DATABASE_ID`）。

## 3. 配置密钥

```bash
node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('base64url'))"   # 生成一个
pnpm --filter @luminote/worker exec wrangler secret put SESSION_PEPPER
pnpm --filter @luminote/worker exec wrangler secret put TOTP_MASTER_KEY
```

若要启用真实模型（默认是离线 mock），再设置：

```bash
pnpm --filter @luminote/worker exec wrangler secret put DEEPSEEK_API_KEY
```

`wrangler.toml` 的 `[env.production.vars]` 已经把 `LLM_PROVIDER` 设为 `deepseek`；如需换成别的厂商，改 `LLM_BASE_URL` / `LLM_MODEL` 即可（见 [providers.md](providers.md)）。

> 注意：密钥必须通过 `wrangler secret put` 写入。它们绝不能出现在 `wrangler.toml` 的 `[vars]` 里——那里是明文且会进版本库。

## 4. 应用迁移

```bash
pnpm --filter @luminote/worker exec wrangler d1 migrations apply luminote --remote
```

## 5. 构建并部署

```bash
pnpm deploy
```

等价于先 `vite build` 前端，再 `wrangler deploy`。部署完成后：

- `https://<worker>.<subdomain>.workers.dev/` → 应用
- `https://<worker>.<subdomain>.workers.dev/api/v1/health` → 健康检查

## 6. 安装为应用

- **iOS**：Safari 打开 → 分享 → “添加到主屏幕”。已包含 `apple-mobile-web-app-*` meta 与 touch icon。
- **Android**：Chrome 打开 → 菜单 → “安装应用”（或“添加到主屏幕”）。也可用 WebView 壳应用包一层，只需指向同一地址。

## 定时任务

`wrangler.toml` 已配置 `crons = ["17 3 * * *"]`，用于版本保留与日志清理。可通过 `wrangler tail` 观察输出。

## 本地开发对照

| 生产                           | 本地                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| `wrangler secret put`          | `packages/worker/.dev.vars`（参考根目录 `.dev.vars.example`） |
| `d1 migrations apply --remote` | `d1 migrations apply --local`                                 |
| `pnpm deploy`                  | `pnpm dev:worker` + `pnpm dev:web`                            |

`wrangler dev` 使用本地模拟的 D1/R2，不会触碰云端数据。

## 回滚

Worker 支持版本回滚：`wrangler deployments list` 找到目标版本后 `wrangler rollback [id]`。D1 迁移是单向的，因此破坏性变更请走“新增列 + 双写 + 后续清理”的路径。
