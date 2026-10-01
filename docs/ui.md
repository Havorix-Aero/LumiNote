# 界面与设计系统

前端与 Havorix 其它前端（`platform` / `STAFF` / `WEB`）保持同一套架构：**Tailwind v4 + 语义化设计令牌 + 组件库**。换一套主题只需要换变量值，组件代码一行都不用动。

## 目录结构

```
apps/web/src
  app/          App 与路由（外壳由 desktop/ 与 mobile/ 提供）
  components/   与产品无关的组件库：Button / Card / Badge / Field / TabBar / Toast / Sheet …
  desktop/      桌面端外壳与页面
  mobile/       移动端外壳与页面
  shared/       两端共用（编辑器、版本历史、diff、关键词、鉴权页、密保问题）
  hooks/        useTheme / useLayout / useBreakpoint / useMediaQuery
  lib/          离线仓库、同步引擎、API 客户端、设置
  styles/       index.css —— 令牌与基础样式
```

## 设计令牌

`src/styles/index.css` 用 Tailwind v4 的 CSS-first 配置（`@theme inline`）把 CSS 变量暴露成语义类名。**组件只写语义名**（`bg-surface-1`、`text-fg-muted`、`border-line`），不写具体色值。

| 令牌                                                       | 用途                           |
| ---------------------------------------------------------- | ------------------------------ |
| `surface-0` … `surface-3`                                  | 页面 / 卡片 / 次级底 / 控件底  |
| `fg` `fg-muted` `fg-subtle`                                | 正文 / 次要文字 / 提示文字     |
| `line` `line-strong`                                       | 分隔线与边框，hover 时加深     |
| `accent` `accent-hover`                                    | 主色填充（金色按钮）           |
| `accent-fg`                                                | 压在 `accent` 上的墨色         |
| `accent-ink`                                               | 把主色当**文字**用时的取值     |
| `accent-soft`                                              | 主色浅底（选中项、标签、光晕） |
| `ok` `info` `caution` `warning` `critical`（各带 `-soft`） | 状态语义                       |

### 为什么 `accent` 要拆成三个值

金色在深浅两个主题里都是**亮色**，所以一个取值无法同时兼任两种角色：

- 当填充 → 需要深色前景（`accent-fg`），实测 8.5:1（浅色）/ 9.9:1（深色）；
- 当文字 → 浅色主题下 `#e8a826` 压白底只有约 2.3:1，必须换成更深一档的 `accent-ink`（5.8:1）。

蓝色主色可以一个值走天下，金色不行，所以这里比其它前端多一个 `accent-ink`。

### 对比度实测（WCAG AA 要求正文 ≥ 4.5:1）

| 组合                          | 浅色  | 深色  |
| ----------------------------- | ----- | ----- |
| `fg` on `surface-1`           | 17.60 | 14.72 |
| `fg-muted` on `surface-1`     | 6.00  | 6.93  |
| `fg-subtle` on `surface-1`    | 5.32  | 4.79  |
| `accent-ink` on `surface-1`   | 5.81  | 9.36  |
| `accent-ink` on `accent-soft` | 5.27  | 8.51  |
| `accent-fg` on `accent`       | 8.50  | 9.94  |

数值由 `e2e` 的临时审计脚本从 computed style 实时算出；改动令牌后请重新核对。

## 主题

- 三种模式：`light` / `dark` / `system`，存在 `localStorage['luminote.theme']`，由 `useTheme()` 管理。
- **首屏不闪白**：`index.html` 里的内联脚本在第一次绘制前就决定 `<html class="dark">`。存储键与 `useTheme.ts` 的 `THEME_STORAGE_KEY` 必须保持一致。
- 深色不是浅色的反相，而是重新挑的一组值：底更深、字更亮、`accent-ink` 与 `accent` 合并。

## 组件库

`src/components/` 只放与产品无关的原语，产品的语义留在各自的 feature 里。

| 组件                                                                          | 说明                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Button` / `IconButton` / `Spinner`                                           | `primary`·`default`·`ghost`·`danger`·`dangerSolid`，`sm`(32)·`md`(36)·`lg`(44)，支持 `loading` / `block` / `icon` |
| `Card` / `CardHeader` / `CardTitle` / `CardBody` / `EmptyState` / `CopyField` | 卡片与空状态                                                                                                      |
| `Badge`（含 `solid`）/ `Dot`                                                  | 状态徽标与状态圆点                                                                                                |
| `Field` / `TextInput` / `TextArea` / `Select` / `Switch` / `Checkbox`         | 统一「标签 + 控件 + 错误」结构，控件高 44px                                                                       |
| `TabBar` / `Segmented`                                                        | 下划线页签与紧凑分段控件                                                                                          |
| `Toast` + `ToastViewport`                                                     | 全局提示，`toast.ok() / warning() / critical()`                                                                   |
| `Sheet`                                                                       | 移动端底部抽屉（Escape 与点击遮罩都能关闭）                                                                       |
| `Notice` / `PageHeader` / `Section`                                           | 行内状态、页面标题、分区                                                                                          |
| `ThemeToggle`                                                                 | 浅色 → 深色 → 跟随系统 循环切换                                                                                   |

移动端一律使用 `size="lg"`（44px），因为 `sm`/`md` 低于触摸目标建议值。

## 排版

拉丁字母与数字统一走自托管的 **JetBrains Mono**，中文因字体缺字自动回落到系统中文字体——于是「代码感」只落在数字与标识符上，中文排版不受影响。数字另加 `.tabular`（`font-variant-numeric`），避免数值变化时列宽跳动。

## 可访问性约定

- 触摸目标 ≥ 44px（移动端按钮、输入框、`label.checkbox`、关键词胶囊）。
- 编辑器不再用 `outline: none` 抹掉焦点：焦点环画在外层容器上（`focus-within`），写作区本身仍然无边框。
- 尊重 `prefers-reduced-motion`，动画与过渡会被压到接近 0。
- 视口不含 `maximum-scale`，保留双指缩放。

## 端到端测试契约

Playwright 用类名与无障碍名定位，因此下面这些**是接口，不是样式**，重构时不能删：

| 选择器 / 名称                                                                                                                 | 用途                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `.auth` · `.auth__error` · `.auth__question`                                                                                  | 鉴权页与错误提示                                         |
| `.desktop` · `.mobile` · `.capture` · `.history` · `.note-screen` · `.mobile-settings`                                        | 外壳与页面                                               |
| `.desktop__footer`                                                                                                            | 同步状态（文案含「已连接」「离线」「待同步」「已同步」） |
| `.note-list__item` · `.is-active` · `.note-list__preview` · `.note-list__title` · `.note-list__empty`                         | 列表                                                     |
| `.versions` · `.versions__item` · `.diff__summary` · `.notice`                                                                | 版本历史                                                 |
| `.sheet`                                                                                                                      | 移动端抽屉                                               |
| `.settings__secret code` · `.questions__catalog` · `.questions__option` · `input.questions__answer`                           | 设置                                                     |
| `aria-label="笔记内容"`、`input[autocomplete=…]`、`label.checkbox`                                                            | 编辑器与表单                                             |
| 按钮文本：新建灵感 / 新建笔记 / 保存版本 / 恢复此版本 / 立即同步 / 退出登录 / 开始设置 / 确认启用 / 保存密保问题 / 保存并继续 | 操作                                                     |
