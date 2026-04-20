# Backend Source Layout And Interfaces

## 1. 目标

这份文档回答两个问题：

1. `backend/src` 应该怎么拆目录
2. 每层代码允许依赖什么，不允许依赖什么

目标是让后续实现保持简洁，不把项目做成一团 service spaghetti。

## 2. 建议目录结构

```text
backend/src/
├── app/
│   ├── http/
│   ├── workers/
│   └── bootstrap/
├── core/
│   ├── errors/
│   ├── ids/
│   ├── logging/
│   ├── time/
│   ├── validation/
│   └── result/
├── modules/
│   ├── identity/
│   ├── workspaces/
│   ├── accounts/
│   ├── personas/
│   ├── sources/
│   ├── trends/
│   ├── drafts/
│   ├── schedules/
│   ├── engagement/
│   ├── notifications/
│   ├── risk/
│   ├── connector-x/
│   ├── agent-runtime/
│   └── audit/
├── infrastructure/
│   ├── db/
│   ├── redis/
│   ├── queue/
│   ├── secrets/
│   ├── llm/
│   └── twitter/
└── contracts/
    ├── api/
    ├── events/
    └── jobs/
```

## 3. 每个模块内部结构

每个业务模块统一采用同样的形状：

```text
modules/<name>/
├── domain/
├── application/
├── infrastructure/
└── interfaces/
```

### 3.1 domain

只放：

- 实体
- 值对象
- 领域规则
- 状态机

不放：

- HTTP
- ORM
- LLM provider
- Twitter SDK

### 3.2 application

只放：

- use cases
- command handlers
- query handlers
- ports

### 3.3 infrastructure

只放：

- repository implementation
- external adapters
- queue producers / consumers

### 3.4 interfaces

只放：

- REST handlers
- worker handlers
- DTO mappers

## 4. 依赖规则

必须遵守：

- `domain` 不依赖 `application/infrastructure/interfaces`
- `application` 只能依赖 `domain` 和抽象 ports
- `infrastructure` 实现 `application` 定义的 ports
- `interfaces` 只能调用 `application`

严格禁止：

- controller 直接写数据库
- agent runtime 直接改业务表
- connector-x 直接决定业务状态迁移
- 任意模块直接拼第三方 SDK 请求并绕过公共层

## 5. P0 模块清单

### 5.1 accounts

职责：

- 账号注册
- 分组
- 账号状态
- credential 关联

暴露命令：

- `CreateAccount`
- `ImportAccounts`
- `MoveAccountsToGroup`
- `PauseAccount`
- `ValidateAccountCredential`

### 5.2 personas

职责：

- persona CRUD
- 模板应用
- persona 蒸馏任务创建

暴露命令：

- `UpdatePersona`
- `ApplyPersonaTemplate`
- `CreatePersonaDistillationJob`

### 5.3 sources

职责：

- source 管理
- 抓取任务
- 文档标准化入库

暴露命令：

- `AddSource`
- `RemoveSource`
- `FetchSource`
- `IngestSourceDocuments`

### 5.4 trends

职责：

- 文档聚类
- 热度评分
- trend 生成

### 5.5 drafts

职责：

- 创建草稿
- 版本管理
- 审核状态机

暴露命令：

- `CreateDraftCandidate`
- `EditDraft`
- `ApproveDraft`
- `RejectDraft`
- `RegenerateDraft`

### 5.6 schedules

职责：

- 排期
- 发布 job
- 发布结果同步

暴露命令：

- `ScheduleDraft`
- `QueuePublishJob`
- `MarkPublishSucceeded`
- `MarkPublishFailed`

### 5.7 engagement

职责：

- engagement policy
- 线程聚合
- 回复建议
- 发送动作记录

### 5.8 connector-x

职责：

- 封装全部 Twitter/X 交互
- 凭证解析
- 限流
- 幂等
- 错误归一

### 5.9 agent-runtime

职责：

- agent task queue
- prompt registry
- model gateway
- tool gateway
- structured output validation

## 6. HTTP 接口边界

### REST API 只做三件事

- 参数校验
- 调用 application command/query
- 返回结构化结果

不做：

- 业务拼装
- 跨模块事务
- provider 调用细节
- 隐式 fallback

## 7. Worker 边界

worker 只消费明确的 job 类型：

- `source.fetch`
- `trend.compute`
- `draft.generate`
- `draft.review`
- `publish.execute`
- `mentions.pull`
- `dm.pull`
- `engagement.reply.generate`
- `engagement.reply.execute`

每种 job 都要有固定 payload schema。

## 8. 接口契约风格

统一返回：

### 成功

```json
{
  "ok": true,
  "data": {}
}
```

### 失败

```json
{
  "ok": false,
  "error": {
    "code": "DRAFT_STATE_INVALID",
    "message": "draft cannot transition from rejected to approved"
  }
}
```

规则：

- 不返回 `null` 当成功
- 不返回模糊的 `"something went wrong"`
- 不吞掉上游错误上下文

## 9. 建议的首批文件

开始编码时，建议先建这些文件：

```text
backend/src/app/bootstrap/http-server.ts
backend/src/app/bootstrap/worker-runner.ts
backend/src/core/errors/app-error.ts
backend/src/core/result/result.ts
backend/src/modules/accounts/application/commands/create-account.ts
backend/src/modules/personas/application/commands/update-persona.ts
backend/src/modules/drafts/application/commands/approve-draft.ts
backend/src/modules/connector-x/application/commands/create-post.ts
backend/src/modules/agent-runtime/application/commands/run-agent-task.ts
backend/src/contracts/api/accounts.ts
backend/src/contracts/api/drafts.ts
backend/src/contracts/jobs/publish-execute.ts
```

## 10. 第一版实现顺序

1. `core + db + queue`
2. `accounts + personas + drafts`
3. `connector-x createPost/listMentions/listDMs`
4. `agent-runtime writer/reviewer/inbox-classifier`
5. `schedules + engagement`
