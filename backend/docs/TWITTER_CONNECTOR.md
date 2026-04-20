# Twitter/X Connector Design

## 1. 定位

`connector-x` 是 SmartKOLs 的执行基础设施。

职责不是“封装几个 SDK 方法”，而是：

- 管理多账号、多凭证
- 收口所有 Twitter/X API 交互
- 提供稳定的内部语义接口
- 实现幂等、限流、错误归一、审计

原则：

- 上层服务不能直接调用 Twitter/X SDK 或 HTTP API
- 所有对平台的真实写操作都必须通过 `connector-x`

## 2. 设计目标

### 必须做到

- 多账号隔离
- 多凭证隔离
- endpoint 配额管理
- 幂等发布
- 显式失败
- 请求级审计
- 与业务语义脱钩

### 明确不做

- 不做 silent retry
- 不做“请求失败但业务先记成功”
- 不做“不知道是否成功就默认成功”
- 不做无上下文的全局 fallback credential

## 3. 内部语义接口

不要暴露平台原生 endpoint 名，内部统一使用语义接口。

建议接口：

- `connectAccount(input)`
- `validateCredential(input)`
- `getAccountProfile(input)`
- `createPost(input)`
- `deletePost(input)`
- `replyToPost(input)`
- `listMentions(input)`
- `listReplies(input)`
- `listDirectMessages(input)`
- `searchPosts(input)`
- `followUser(input)`
- `retweetPost(input)`
- `likePost(input)`

每个接口都必须要求：

- `workspace_id`
- `account_id`
- `credential_id`
- `request_id`
- 写操作场景下的 `idempotency_key`

## 4. 模块拆分

```text
connector-x/
├── application/
│   ├── commands/
│   ├── queries/
│   └── policies/
├── domain/
│   ├── credentials/
│   ├── rate-limits/
│   ├── requests/
│   └── deliveries/
├── infrastructure/
│   ├── twitter-client/
│   ├── secret-store/
│   ├── repositories/
│   └── mappers/
└── interfaces/
    └── http/
```

## 5. 核心子组件

### 5.1 Credential Resolver

职责：

- 根据 `account_id` 找到唯一有效凭证
- 校验凭证状态
- 拒绝失效、撤销或歧义凭证

约束：

- 一个真实平台请求只能绑定一个明确的 credential
- 找不到就失败，不能偷偷拿别的 credential 顶上

### 5.2 Rate Limit Manager

职责：

- 按 credential / account / endpoint 跟踪配额桶
- 调用前做 preflight 检查
- 调用后更新平台返回的 rate limit 信息

关键点：

- 限流不是错误恢复逻辑，而是执行前约束
- 命中限流应返回明确不可执行状态

### 5.3 Request Ledger

职责：

- 为每次平台调用生成 `connector_request`
- 记录请求、响应、错误、耗时、平台 request id

关键点：

- 所有写操作必须持久化审计
- 所有读操作至少要可追踪到 task_run 级别

### 5.4 Idempotency Guard

职责：

- 对发帖、回复、私信这类写操作做幂等保护
- 使用 `idempotency_key + endpoint_code + account_id` 唯一约束

关键点：

- 网络超时后重试必须先查幂等账本
- 不知道结果时，状态应是 `unknown_outcome`，不是 `success`

### 5.5 Error Normalizer

职责：

- 统一第三方异常为内部错误码

建议内部错误码：

- `X_AUTH_INVALID`
- `X_AUTH_EXPIRED`
- `X_RATE_LIMITED`
- `X_PERMISSION_DENIED`
- `X_RESOURCE_NOT_FOUND`
- `X_DUPLICATE_ACTION`
- `X_NETWORK_ERROR`
- `X_UPSTREAM_5XX`
- `X_UNKNOWN_OUTCOME`

## 6. 请求生命周期

### 6.1 createPost

```text
business command
-> resolve credential
-> check account state
-> check rate limit bucket
-> reserve idempotency key
-> persist connector_request(started)
-> call twitter/x api
-> normalize response
-> persist connector_request(finished)
-> if success write published_posts
-> return typed result
```

### 6.2 listMentions / listDMs

```text
polling job
-> resolve credential
-> check rate limit
-> persist connector_request(started)
-> call api
-> normalize payload
-> upsert engagement threads/messages
-> persist connector_request(finished)
```

## 7. 输出契约

所有 connector 输出都必须结构化。

### 7.1 成功输出

```json
{
  "ok": true,
  "platform": "x",
  "endpoint_code": "post.create",
  "connector_request_id": "uuid",
  "external_resource_id": "123456",
  "rate_limit": {
    "limit": 300,
    "remaining": 299,
    "resets_at": "2026-04-13T12:00:00Z"
  }
}
```

### 7.2 失败输出

```json
{
  "ok": false,
  "platform": "x",
  "endpoint_code": "post.create",
  "connector_request_id": "uuid",
  "error_code": "X_RATE_LIMITED",
  "error_message": "rate limit exceeded for endpoint post.create",
  "retryable": false
}
```

## 8. 发布一致性规则

必须遵守：

- 平台成功回执之前，不写 `published_posts`
- connector 未返回成功，不得把 draft/schedule 标为 `published`
- 超时且结果未知时，job 标记为 `unknown_outcome` 或 `failed`，并进入人工/显式补偿流程

## 9. 与业务服务的边界

### Draft / Scheduler 服务负责

- 决定发什么
- 什么时候发
- 是否允许发

### connector-x 负责

- 用哪个 credential 发
- 是否命中限流
- 如何调用平台
- 如何记录平台回执

## 10. P0 必须实现的能力

- account credential validation
- create post
- reply to post
- list mentions
- list direct messages
- rate limit tracking
- connector request ledger
- idempotent write actions
