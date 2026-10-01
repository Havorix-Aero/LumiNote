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

`d1 create` 会打印 `database_id`，把它填进 `packages/worker/wrangler.toml` 的 `database_id`。当前生产库（`luminote`，APAC）的 id 已经写在该文件里，重新创建时换成新值即可。

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

`wrangler.toml` 顶层的 `[vars]` 就是 `wrangler deploy` 发布出去的生产配置。默认 `LLM_PROVIDER = "mock"`（离线可用、不需要 Key）；拿到 Key 之后把它改成 `deepseek`，换厂商则改 `LLM_BASE_URL` / `LLM_MODEL`（见 [providers.md](providers.md)）。本地开发用 `packages/worker/.dev.vars` 覆盖这些值，例如那里把 `ENVIRONMENT` 设回 `development`。

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

- `https://luminote.havorix.cn/` → 应用
- `https://luminote.havorix.cn/api/v1/health` → 健康检查（生产返回 `environment: "production"`）
- `https://luminote.2938949347.workers.dev/` → 同一个 Worker 的 workers.dev 别名

### 自定义域名

`wrangler.toml` 的 `routes` 声明了 `luminote.havorix.cn`（`custom_domain = true`）：DNS 记录和证书都由 Cloudflare 自动签发，`wrangler deploy` 每次都会重新确认。

- **域名边界**：只用 `luminote.havorix.cn` 以及它的前缀子域（如 `www.luminote.havorix.cn`），不要占用 `havorix.cn` 顶级域。
- 要加前缀域名，就再加一条 `{ pattern = "www.luminote.havorix.cn", custom_domain = true }`。Workers 的自定义域名接口**不接受通配符**（`*.luminote.havorix.cn` 会返回 `100113`），每个前缀都得单独声明。
- 想一次性覆盖任意前缀，只能改用 `routes` 里的通配路由 `*.luminote.havorix.cn/*`，并额外建一条代理状态的 `*` DNS 记录——这需要 Zone 的 DNS 编辑权限。

### Cloudflare Pages

仓库同时挂了一个 Pages 项目 `luminote`（默认域名 `luminote-b5c.pages.dev`），只链接 GitHub 仓库 `Havorix-Aero/LumiNote` 的 `main` 分支做构建（`pnpm --filter @luminote/web build` → `apps/web/dist`），**不绑定自定义域名**：对外流量一律走上面的 Worker。

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
