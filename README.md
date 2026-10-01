# LumiNote

灵感导向的笔记本。创意来的那一刻，先把它留住——之后再整理、分词、和 AI 一起把方案想清楚。

- **随时可记**：离线优先的 PWA，断网也能立刻写下，联网后自动同步。
- **上手即写**：不区分标题和正文，第一条有内容的行就是临时标题；“-” + 空格开始列表；空格按语义自动变成“，”或“。”，按一次退格即可还原。
- **历史可回溯**：自动留下编辑快照（每段编辑会话一次）+ 手动“保存版本”，可对比 diff 并一键恢复，且恢复本身也会成为新的历史版本。
- **账号安全**：密码 + 可选的 TOTP 两步验证；新设备无法使用 2FA 时，可消耗一个密保问题登录，并在之后强制重设全部密保问题。
- **多端一致**：桌面端有“灵感中心”（问候语 + 建议操作 + 完整功能），移动端进来就是一张空白页，历史单独放菜单里。
- **可替换的 AI 与语音**：所有模型调用都走 provider 接口，默认 mock，可切成 DeepSeek 或任意 OpenAI 兼容服务。

## 快速开始

前置：Node 20+、pnpm。

```bash
pnpm install

# 生成 packages/worker/.dev.vars（本地开发用的密钥，不要提交）
node tools/write-dev-vars.mjs
```

生成的文件可参考仓库根目录的 `.dev.vars.example`，然后：

```bash
# 终端 1：API（默认 http://127.0.0.1:8787），会使用本地 D1
pnpm --filter @luminote/worker db:migrate:local
pnpm dev:worker

# 终端 2：前端（默认 http://127.0.0.1:5173，/api 已代理到 8787）
pnpm dev:web
```

打开 http://127.0.0.1:5173 ，注册一个账号即可开始写。

> 前端开发服务器显式绑定 IPv4（`server.host`），因为 Node 默认只会挑选一个协议族，
> 在 Windows 上通常是 IPv6，导致解析到 `127.0.0.1` 的工具连不上。

## 线上部署

- 生产地址：**https://luminote.havorix.cn** —— 部署在 Cloudflare Worker `luminote` 上，同源提供
  `/api/v1/*` 与前端静态资源，数据落在同账号的 D1（`luminote`）与 R2（`luminote-audio`）。
- 域名边界：只允许在 `luminote.havorix.cn` **前面加前缀**（如 `www.luminote.havorix.cn`），
  不要占用 `havorix.cn` 顶级域。Workers 自定义域名接口不支持通配符，每个前缀要单独声明。
- GitHub 仓库 `Havorix-Aero/LumiNote` 同时挂在 Cloudflare Pages 项目 `luminote`
  （默认域名 `luminote-b5c.pages.dev`）上，**仅链接仓库、不绑定自定义域名**；对外流量一律走 Worker。

完整步骤见 [docs/deployment.md](docs/deployment.md)。

## 端到端测试（Playwright）

`pnpm test:e2e` 会驱动真实的栈：`wrangler dev`（Hono + 本地 D1）加上代理 `/api` 的 Vite
开发服务器。两个服务会按需自动启动，已在运行则直接复用。

```bash
pnpm exec playwright install chromium   # 首次运行需要下载浏览器
pnpm db:migrate:local                   # 首次运行需要建好本地 D1 表结构
pnpm test:e2e
pnpm test:e2e --ui                      # 交互式调试
```

用例覆盖注册/登录、2FA 新设备验证、密保问题恢复与强制重设、编辑器输入规则、
版本历史（保存/对比/恢复/同步）、离线写入与补同步、桌面端与移动端两套布局。
截图会写入 `test-results/screens`，方便直接查看界面样式。

## 常用脚本

| 命令                               | 作用                               |
| ---------------------------------- | ---------------------------------- |
| `pnpm typecheck`                   | 全仓库类型检查                     |
| `pnpm lint` / `pnpm format`        | ESLint / Prettier                  |
| `pnpm test`                        | 全部单元测试与 Worker 集成测试     |
| `pnpm test:e2e`                    | Playwright 端到端测试              |
| `pnpm build`                       | 构建所有包与前端                   |
| `pnpm dev:worker` / `pnpm dev:web` | 本地开发                           |
| `pnpm deploy`                      | 构建前端并部署 Worker              |
| `node tools/generate-icons.mjs`    | 重新生成 PWA 图标                  |
| `node tools/write-dev-vars.mjs`    | 生成本地开发密钥（`--force` 覆盖） |

## 目录结构

```
apps/web                  Vite + React PWA（桌面端 / 移动端两套组件树）
  src/shared                两端共享的编辑器、版本面板、鉴权页
  src/lib                   离线仓库（Dexie）、同步引擎、API 客户端
packages/core             领域类型、zod 校验、错误码、常量
packages/worker           Hono API + D1 迁移（同时承载静态资源与 cron）
packages/editor           纯函数的输入规则引擎（自动空行、列表、空格转标点）
packages/versions         快照策略、diff、保留策略
packages/providers        LLM / 语音 / 分词 provider 接口与实现
docs                      架构、鉴权、部署、provider 说明
```

## 文档

- [架构说明](docs/architecture.md)
- [鉴权与恢复流程](docs/auth.md)
- [部署到 Cloudflare](docs/deployment.md)
- [替换模型 / 语音 provider](docs/providers.md)

## 许可

见 [LICENSE](LICENSE)。
