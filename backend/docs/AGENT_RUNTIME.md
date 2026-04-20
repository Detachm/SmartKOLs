# LLM Agent Runtime Design

## 1. 定位

`agent-runtime` 是 SmartKOLs 的智能基础设施。

它不是“调一下大模型然后返回字符串”，而是：

- 统一 Agent 执行模型
- 统一 prompt 与工具协议
- 统一结构化输出校验
- 统一 provider 错误处理
- 统一运行时追踪

## 2. 目标

### 必须做到

- Agent 输入结构化
- Agent 输出结构化
- prompt 版本可追踪
- tool 调用受控
- provider 错误显式暴露
- schema 不合法时立即失败
- 一次 agent run 可完整回放

### 明确不做

- 不直接返回自由文本作为业务真相
- 不在 schema 解析失败时“凑合解析”
- 不在 provider 失败时静默切模型
- 不让 Agent 直接写关键领域状态

## 3. 运行时分层

```text
agent-runtime/
├── orchestrator/
├── runtime/
├── model-gateway/
├── prompt-registry/
├── tool-gateway/
├── validators/
└── traces/
```

## 4. 核心对象

### 4.1 AgentDefinition

定义一个 Agent 的不可变契约：

- `code`
- `version`
- `system_prompt`
- `input_schema`
- `output_schema`
- `tool_policy`
- `result_type`

### 4.2 AgentTask

一条待执行任务，包含：

- 为什么触发
- 针对哪个对象
- 输入上下文
- 需要哪个 Agent

### 4.3 AgentRun

一次真实执行，包含：

- 选用模型
- prompt artifact
- tool calls
- 最终输出
- 校验结果
- 错误信息

### 4.4 ModelRequest

一次对外部模型 provider 的调用尝试容器。

重要边界：

- 一个 `AgentRun` 可以有多个 `ModelRequestAttempt`
- 一个 `ModelRequest` 的失败不等于整个 `AgentRun` 一定成功或失败，最终由 runtime 判定

## 5. Agent 执行生命周期

```text
agent task queued
-> runtime loads agent definition
-> validate input schema
-> materialize prompt artifact
-> create model request
-> call provider
-> parse structured output
-> validate output schema
-> optionally run tools
-> produce final typed result
-> persist run trace
```

## 6. 输出类型约束

所有 Agent 只能输出这三类之一：

- `proposal`
- `classification`
- `decision_support`

示例：

- WriterAgent 输出 `draft proposal`
- ReviewerAgent 输出 `review decision_support`
- InboxAgent 输出 `message classification`

禁止：

- 直接输出“已发布”
- 直接输出“已审核通过并落库”
- 直接偷偷修改 persona / policy

## 7. Provider 鲁棒性

### 7.1 需要明确处理的失败类型

- 超时
- 429
- provider 5xx
- 网络失败
- 返回非结构化内容
- 返回结构化但不符合 schema
- 工具调用计划非法

### 7.2 错误码建议

- `MODEL_TIMEOUT`
- `MODEL_RATE_LIMITED`
- `MODEL_UPSTREAM_5XX`
- `MODEL_NETWORK_ERROR`
- `MODEL_INVALID_OUTPUT`
- `MODEL_SCHEMA_VIOLATION`
- `MODEL_TOOL_PLAN_INVALID`

### 7.3 严格规则

- schema 不通过即失败
- 工具参数不合法即失败
- 不能因为“看起来差不多”就接受输出
- provider 不可用时显式失败，不做隐藏 provider fallback

如果未来要做多 provider，也必须是显式策略：

- 在任务级别明确声明可用 provider 列表
- 每次切换 provider 都要写运行记录
- 不允许 runtime 偷偷切换

## 8. Tool Gateway

Agent 所有工具必须经过 `tool-gateway`，不能直连数据库或服务。

工具类型建议：

- `accounts.get_profile`
- `personas.get_current`
- `sources.list_recent_documents`
- `trends.get_topic`
- `drafts.create_candidate`
- `drafts.list_recent`
- `engagement.get_thread_context`
- `connector-x.search_posts`

每次工具调用必须：

- 校验是否在 tool policy 内
- 记录 `tool_call`
- 记录输入、输出、耗时、错误

## 9. Prompt Registry

Prompt 必须版本化，而不是散落在代码里。

每个 prompt artifact 至少包含：

- `agent_code`
- `prompt_version`
- `system_prompt`
- `developer_prompt`
- `tool_contract_ref`
- `schema_ref`

## 10. WriterAgent 示例

### 输入

- account id
- current persona
- selected trend
- recent source documents
- autopost policy
- recent published content summary

### 输出

```json
{
  "type": "proposal",
  "proposal_kind": "draft",
  "topic": "Bitcoin ETF 资金流入",
  "candidates": [
    {
      "content": "....",
      "reasoning_summary": "....",
      "risk_flags": ["none"]
    }
  ]
}
```

### 后续动作

- runtime 校验 schema
- draft-service 创建 `draft + draft_version`
- 不直接标记 approved

## 11. ReviewerAgent 示例

### 输入

- draft content
- persona
- recent drafts
- policy constraints

### 输出

```json
{
  "type": "decision_support",
  "decision": "reject",
  "reasons": [
    "内容与 persona 写作风格不一致",
    "与最近 3 条草稿语义重复"
  ],
  "risk_flags": [
    "duplication"
  ]
}
```

关键点：

- 这是建议，不是最终审核结果
- 真正的状态迁移仍然由 review-service 执行

## 12. Orchestrator 职责

`orchestrator-service` 负责：

- 把业务事件转成 agent tasks
- 编排前后置依赖
- 跟踪 task 和 run 状态
- 决定何时需要人工介入

它不负责：

- 直接写业务对象
- 直接调用 provider
- 绕过 runtime 校验

## 13. P0 必须实现的能力

- agent definitions
- prompt registry
- model gateway
- tool gateway
- output schema validation
- agent task queue
- agent run tracing
- writer agent
- reviewer agent
- inbox classifier agent
