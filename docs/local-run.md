# SmartKOLs Local Run

## Goal

把本地运行拆成两层：

- 非 LLM 主链现在就能跑
- LLM 主链只差填一个 provider key: `.env.zhipu.local` 或 `.env.openai.local`

## Local Files

- `.env.local`
  - Next.js 前端使用
  - 当前已经指向 backend tunnel
  - 当前已经指向部署好的 Vercel OAuth bridge
- `.env.backend-http.local`
  - backend HTTP 入口使用
- `.env.backend-worker.local`
  - backend worker 使用
- `.env.openai.local`
  - 只放 OpenAI 配置
  - 默认只缺 `OPENAI_API_KEY`
  - 其余默认值已经对齐到你当前的 OpenAI-compatible gateway:
    - `OPENAI_BASE_URL=https://claudecode.love/v1`
    - `OPENAI_MODEL=gpt-5.4`
    - `OPENAI_REVIEW_MODEL=gpt-5.4`
    - `OPENAI_REQUEST_TIMEOUT_MS=120000`
    - `OPENAI_REASONING_EFFORT=xhigh`
    - `OPENAI_STORE=false`
- `.env.zhipu.local`
  - 只放智谱 GLM 配置
  - 默认只缺 `ZHIPU_API_KEY`
  - 默认值：
    - `ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4`
    - `ZHIPU_MODEL=glm-5.1`
    - `ZHIPU_REVIEW_MODEL=glm-5.1`
    - `ZHIPU_REQUEST_TIMEOUT_MS=120000`
    - `ZHIPU_AUTH_MODE=jwt`

如果两个 provider 的本地 env 都存在：

- 本地脚本默认优先 `zhipu`
- 想强制切到某个 provider，可以在 `.env.backend-http.local` / `.env.backend-worker.local` 显式写 `LLM_PROVIDER=openai` 或 `LLM_PROVIDER=zhipu`

示例文件：

- `.env.local.example`
- `.env.backend-http.example`
- `.env.backend-worker.example`
- `.env.openai.example`
- `.env.zhipu.example`

## Start Order

先检查：

```bash
npm run doctor
```

先启动 backend HTTP：

```bash
npm run backend:dev:local
```

LLM key 还没填时，只启动这些 worker：

```bash
npm run backend:worker:local -- publisher-worker
npm run backend:worker:local -- ingestion-worker
npm run backend:worker:local -- engagement-worker
```

填完 `.env.zhipu.local` 里的 `ZHIPU_API_KEY`，或者 `.env.openai.local` 里的 `OPENAI_API_KEY` 以后，再启动：

```bash
npm run backend:worker:local -- agent-worker
```

## Why The OAuth Bridge Matters

本地前端现在可以直接跳到：

- `NEXT_PUBLIC_SMARTKOLS_X_AUTH_BASE_URL/auth/x/start`

这样本地 UI 不需要再额外配置一套 `X_CLIENT_ID / X_CLIENT_SECRET / X_REDIRECT_URI / X_AUTH_STATE_SECRET`。

## Remaining Manual Step

只剩一个人工步骤：

1. 在 `.env.zhipu.local` 填 `ZHIPU_API_KEY`
2. 或者在 `.env.openai.local` 填 `OPENAI_API_KEY`

填完以后：

- start script 会自动把 `LLM_ENABLED` 切成 `true`
- 会自动选中可用 provider
- `agent-worker` 可以直接启动

## Current Mapping

当前项目已经能直接消费这些字段：

- `baseURL` -> `OPENAI_BASE_URL`
- `apiKey` -> `OPENAI_API_KEY`
- `model` -> `OPENAI_MODEL`
- `review_model` -> `OPENAI_REVIEW_MODEL`
- `model_reasoning_effort` -> `OPENAI_REASONING_EFFORT`
- `store=false` / `disable_response_storage=true` -> `OPENAI_STORE=false`

智谱 GLM 当前项目已经能直接消费这些字段：

- `apiKey` -> `ZHIPU_API_KEY`
- `baseURL` -> `ZHIPU_BASE_URL`
- `model` -> `ZHIPU_MODEL`
- `review_model` -> `ZHIPU_REVIEW_MODEL`
- `auth_mode=jwt|api_key` -> `ZHIPU_AUTH_MODE`

当前项目还不会消费这些字段：

- context/output limit 元数据
- `network_access`
- auto compact token limit
