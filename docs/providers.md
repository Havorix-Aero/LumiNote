# 替换模型 / 语音 / 分词 provider

所有模型能力都收敛到 `packages/providers` 的三个接口，业务代码只依赖接口，不依赖具体厂商：

```ts
interface LlmProvider {
  chat(messages, options): AsyncIterable<ChatDelta>;
}
interface SttProvider {
  transcribe(audio: Blob, options): Promise<Transcript>;
}
interface SegmenterProvider {
  segment(text, locale?): Segment[];
}
```

## 运行时选择

`packages/worker/src/services/provider-config.ts` 从 Worker 环境变量构造这三个 provider：

| 变量               | 说明                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `LLM_PROVIDER`     | `mock` 表示离线；其它值被当作 OpenAI 兼容厂商名（如 `deepseek`） |
| `LLM_BASE_URL`     | 例如 `https://api.deepseek.com/v1`                               |
| `LLM_MODEL`        | 例如 `deepseek-chat`                                             |
| `DEEPSEEK_API_KEY` | API 密钥（`wrangler secret put`，绝不下发到浏览器）              |
| `STT_PROVIDER`     | 目前为 `mock`，真实实现接入点见下                                |

浏览器只与 `/api/v1/ai/chat`、`/api/v1/stt/transcribe` 通信，密钥始终留在 Worker 内。

## 当前默认：离线 mock

默认配置（`LLM_PROVIDER=mock`）不需要任何密钥即可跑通“记录 → 讨论”的完整链路，方便开发和测试。mock 会返回一段确定性的说明性文字，并在末尾提示如何切换到真实模型。

## 切换到 DeepSeek（或任意 OpenAI 兼容服务）

DeepSeek、Moonshot、Together、vLLM、OpenAI 本身都遵循 `/chat/completions` 协议，因此切换只是改配置：

```bash
pnpm --filter @luminote/worker exec wrangler secret put DEEPSEEK_API_KEY
```

并在 `wrangler.toml` 中调整：

```toml
[env.production.vars]
LLM_PROVIDER = "deepseek"
LLM_BASE_URL = "https://api.deepseek.com/v1"
LLM_MODEL    = "deepseek-chat"
```

换成自建服务只需把 `LLM_BASE_URL` 指向它，并把 `LLM_PROVIDER` 改成任意标识名。

## 接入真实语音转写

`createSttProvider` 目前返回 `MockSttProvider`。接入真实服务有两种方式：

1. **服务端**：在 `packages/providers/src/stt/` 下新增一个 `WhisperCompatibleSttProvider`（POST 音频到 `/audio/transcriptions`），然后在 `createSttProvider` 中按 `STT_PROVIDER` 选择它。
2. **浏览器端**：直接使用 Web Speech API，把结果通过 `Editor` 的插入能力写进正文——此时完全不需要服务端。

两条路径都不需要改动界面或 API 契约，因为 `Transcript` 的形状是固定的。

## 分词

`IntlSegmenterProvider` 使用运行时内置的 `Intl.Segmenter`，对中文能做真正的词典切分，且无需随包分发词典——这正是关键词提取与词云需要的。若需要 jieba 级别的切分，实现 `SegmenterProvider` 并在 `resolveProviders` 中替换即可，界面无需改动。

## 添加新 provider 的检查清单

1. 在 `packages/providers/src/<kind>/` 下实现对应接口。
2. 在 `resolveProviders` 中按配置选择它。
3. 若需要新密钥，加入 `Env` 类型、`wrangler.toml` 的 `[vars]`（非敏感）或 `wrangler secret put`（敏感）。
4. 为它补一个单元测试（可参考 `packages/providers/src/providers.test.ts` 中对 mock 与 OpenAI 兼容实现的测试）。
5. 必要时更新 `docs/deployment.md` 与 `SettingsView` 里展示的服务状态。
