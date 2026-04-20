# SmartKOLs Backend

这个目录承载 SmartKOLs 的独立后端实现。

它不是一个“给前端喂数据的 CRUD 层”，而是一个有明确状态机、明确执行边界、明确失败语义的 `control plane + execution plane`。

## 当前状态

当前已经真实落地的能力：

- SQLite 真相源、核心领域对象、状态机、审计、trace
- 真实 X adapter
  - credential validation
  - account profile
  - create post
  - reply
  - mentions pull
  - direct messages pull
- 真实 LLM transport
  - OpenAI Responses API
  - writer / reviewer / inbox-classifier / reply-proposer
- 真实 source fetch transport
  - `rss / atom`
  - `website`
  - `substack`
  - `youtube`
  - `twitter`
  - `telegram`
- 真实异步执行链
  - draft generate
  - draft review generate
  - inbox classify
  - reply proposal generate
  - mentions pull
  - direct messages pull
  - engagement reply execute
  - source fetch
  - publish execute
- lease-based stuck-run recovery
- connector intent ledger + idempotency guard
- raw model/source artifacts 落盘

当前还没闭环的部分：

- operator API / explorer 还没补齐
- secret/vault、structured logs、metrics、runbook 还没做

结论：

- 系统已经不是骨架阶段
- 系统已经具备部分真实外部执行能力
- 当前瓶颈不再是“能不能接 API”，而是“把剩余执行链和运维面收完整”

## 第一性原理

系统里需要长期稳定存在的核心对象只有这些：

- `Workspace`
- `Account`
- `Persona`
- `SourceDocument`
- `Trend`
- `Draft`
- `EngagementThread`
- `TaskRun`

其他对象都是这些核心对象的派生、执行记录、索引或审计快照。

从这个前提出发，后端必须始终遵守下面这些约束：

- 长任务和外部调用必须走队列与 worker，HTTP 不承担执行
- 失败就是失败，不做默认 fallback，不做静默降级
- `failed` 就是 dead-letter，只有显式 retry 才能重新入队
- provider / platform 错误必须结构化暴露，并保留 trace
- Agent 输出不是业务真相，必须经过 schema 校验、状态机和审计

## 运行拓扑

- `backend:dev`
  - HTTP 入口
  - 负责同步查询、同步短操作、长任务入队
- `backend:worker`
  - worker 入口
  - 负责消费 SQLite 中的任务和作业
- `SQLite`
  - 业务真相源
  - 任务队列
  - 审计 / trace / connector / model ledger

这不是一个“HTTP 服务自己顺手把任务跑完”的系统。

## 配置

### Core

- `BACKEND_PORT`
- `BACKEND_DB_PATH`
- `BACKEND_ARTIFACTS_DIR`

### X

- `X_API_KEY`
- `X_API_SECRET`
- `X_OAUTH2_CLIENT_ID`
- `X_OAUTH2_CLIENT_SECRET`
- `X_API_BASE_URL`
- `X_API_REQUEST_TIMEOUT_MS`

`account_credentials.secret_ref` 现在分两类：

- `x_oauth1` / `api_key`
  - 必须使用 `env:VAR_NAME`
- `x_oauth2`
  - 不允许再依赖 `env:`
  - 必须通过账号授权结果写入后端 managed secret store

环境变量 JSON 格式：

- `x_oauth1`: `{"access_token":"...","access_token_secret":"..."}`
- `api_key`: `{"bearer_token":"..."}`

说明：

- 当前 X 的 account profile / create post / reply / mentions / direct messages 都要求 user-context
- `api_key` 不能伪装成 user token 使用；不满足就显式失败
- `X_API_KEY / X_API_SECRET` 只在 `x_oauth1` 请求签名时必需
- 如果当前部署只承载 `x_oauth2` 账号绑定链路，可以不提供 `X_API_KEY / X_API_SECRET`
- `x_oauth2` 现在要求同时持有 `access_token + refresh_token`
- 后端会在 token 即将过期或收到 401 时自动 refresh，并把新 token 原子写回 managed secret store

### LLM

- `LLM_ENABLED`
  - 必须显式设置为 `true` 或 `false`
- `LLM_PROVIDER`
  - 当前只接受 `openai`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `OPENAI_REQUEST_TIMEOUT_MS`

### Source Fetch

- `SOURCE_FETCH_REQUEST_TIMEOUT_MS`
- `SOURCE_FETCH_USER_AGENT`
- `SOURCE_FETCH_MAX_ITEMS`

### Worker

- `WORKER_NAME`
  - `all`
  - `agent-worker`
  - `publisher-worker`
  - `ingestion-worker`
  - `engagement-worker`
- `WORKER_POLL_INTERVAL_MS`
- `WORKER_MAX_JOBS_PER_TICK`

## 当前最重要的事

现在的推进顺序应该非常明确：

1. 先补执行闭环剩余缺口
   - 已完成
2. 先补 operator control surface
3. 最后补 production ops

不应该再回去做“骨架建设”。

## 当前文档

- [架构设计](./docs/ARCHITECTURE.md)
- [运行与部署事实](./docs/OPERATIONS.md)
- [数据库设计](./docs/DATABASE.md)
- [Twitter/X Connector 设计](./docs/TWITTER_CONNECTOR.md)
- [LLM Agent Runtime 设计](./docs/AGENT_RUNTIME.md)
- [后端代码骨架与接口边界](./docs/BACKEND_LAYOUT.md)
- [Roadmap](./docs/ROADMAP.md)
- [Todo List](./docs/TODO.md)
