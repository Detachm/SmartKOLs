# SmartKOLs Backend Architecture

## 1. 目标定义

SmartKOLs 的后端不是一个普通 CMS 后台。

它的本质是一个多 Agent 协同系统，用来管理一个 KOL 矩阵：

- 有账号资产
- 有独立 persona
- 有信息源与热点发现
- 有草稿生成与审核
- 有定时发布
- 有评论 / 回复 / 私信处理
- 有风控、审计、监控

系统必须回答三个问题：

1. 谁在操作：人类运营者、系统任务、具体 Agent
2. 操作什么：账号、人格、草稿、互动任务、消息线程
3. 为什么可以操作：策略、权限、状态机、风控约束

## 2. 第一性原理拆解

从第一性原理出发，系统里真正需要长期存在的对象只有 8 类：

1. `Workspace`
   多租户隔离边界
2. `Account`
   被运营的 Twitter/X 账号资产
3. `Persona`
   每个账号的行为与表达约束
4. `SourceDocument`
   信息源抓取后的标准化内容
5. `Trend`
   从多个 source document 聚合出的热点对象
6. `Draft`
   待审核或已排期的内容资产
7. `EngagementThread`
   评论、回复、私信、合作邀约等互动上下文
8. `TaskRun`
   Agent 或系统发起的一次可追踪执行

其他对象都只是这 8 类对象的派生、索引、快照或审计记录。

## 3. 总体分层

```text
┌────────────────────────────────────────────────────────────┐
│                     Product Control Plane                  │
│  Auth / Workspace / Policy / Orchestration / Audit        │
└────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌─────────────────┐
│ Content Plane │ │EngagementPlane│ │ Execution Plane │
│ sources/trends│ │ replies/dm    │ │ scheduler/publish│
│ drafts/review │ │ moderation    │ │ queue/retry      │
└───────────────┘ └───────────────┘ └─────────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────┐
│                    Shared Data Plane                       │
│ SQLite / Artifact Files / Structured Logs / Metrics       │
└────────────────────────────────────────────────────────────┘
```

## 3.1 当前运行现实

当前代码已经明确采用下面这套执行规则：

- HTTP 入口只负责同步短操作、查询和长任务入队
- worker 负责消费 SQLite 中的任务和作业
- `failed` 是 dead-letter 状态，不自动重试
- retry 必须是显式操作，不允许系统偷偷重放
- provider / connector 失败必须返回结构化错误，不允许静默 fallback

当前还没完全对齐目标架构的部分：

- operator control surface
- production ops

这些不是“以后再优化”的细节，而是当前执行闭环剩余的主要缺口

## 4. 服务边界

### 4.1 Control Plane

职责：

- 工作区、用户、角色、权限
- 账号注册与接入
- persona 管理
- 配置管理
- Agent 编排
- 审计与策略约束

建议服务：

- `identity-service`
- `workspace-service`
- `account-service`
- `persona-service`
- `policy-service`
- `orchestrator-service`
- `audit-service`

### 4.2 Content Plane

职责：

- 信息源管理
- 抓取调度
- 内容抽取、清洗、去重
- 热点聚类与排序
- 草稿生成
- 草稿审核与版本管理

建议服务：

- `source-service`
- `ingestion-worker`
- `trend-service`
- `draft-service`
- `review-service`

### 4.3 Engagement Plane

职责：

- 评论 / 回复 / 私信统一建模
- 自动互动规则执行
- 合作邀约分类
- 线程上下文维护

建议服务：

- `inbox-service`
- `engagement-service`
- `engagement-worker`

### 4.4 Execution Plane

职责：

- 排期
- 任务队列
- 外部平台调用
- 发布幂等
- 重试策略
- 失败可观测性

建议服务：

- `scheduler-service`
- `publisher-worker`
- `connector-x`

## 5. Agent 集群设计

Agent 不应该直接彼此裸调。所有 Agent 都通过 `orchestrator-service` 和 `tool gateway` 工作。

### 5.1 Agent 类型

- `AccountOpsAgent`
  负责账号分组、状态检查、接入校验
- `PersonaAgent`
  负责人设生成、蒸馏、模板应用、一致性检查
- `TrendScoutAgent`
  负责热点发现、聚类命名、热度评分
- `WriterAgent`
  负责依据 persona + trend + source 生成 tweet drafts
- `ReviewerAgent`
  负责审核建议、风险标注、重复度判断、拒稿理由
- `SchedulerAgent`
  负责排期建议，不负责直接发布
- `EngagementAgent`
  负责评论 / 回复策略生成
- `InboxAgent`
  负责私信分类、合作邀约提取、建议回复
- `RiskAgent`
  负责风控异常检测，不负责静默修改策略

### 5.2 Agent 工作方式

每个 Agent 都必须：

- 接受结构化输入
- 产出结构化输出
- 带上 `workspace_id`、`account_id`、`task_run_id`
- 所有工具调用必须审计
- 不允许隐式修改核心对象

### 5.3 Agent 输出约束

Agent 只能做三类输出：

1. `proposal`
   提案，比如生成一个 draft 或一条回复建议
2. `classification`
   分类，比如将私信判断为合作邀约
3. `decision-support`
   给出建议，不直接替代人工或状态机

关键原则：

- Agent 不能绕过状态机直接写最终状态
- Agent 不能在失败时“自己找个差不多的结果”
- Agent 不能吞掉工具错误

## 6. 主工作流

### 6.1 热点到草稿

```text
sources -> ingestion -> normalized documents -> trend clustering
-> trend selection -> writer task -> draft candidates
-> reviewer task -> human review -> approved draft -> schedule
```

### 6.2 评论 / 回复 / 私信

```text
incoming mention/dm -> inbox classification -> thread enrichment
-> engagement policy check -> reply proposal
-> auto-send or manual approval -> delivery log -> audit
```

### 6.3 自动发布

```text
approved draft + schedule policy -> publish job
-> preflight risk check -> connector call
-> success/failure event -> account metrics update
```

## 7. 当前前端对应的后端域

基于现有前端页面，后端必须覆盖这些业务域：

- `/accounts`
  - account registry
  - groups
  - account health snapshot
- `/accounts/[id]/persona`
  - persona
  - persona templates
  - persona distillation jobs
- `/accounts/[id]/sources`
  - sources
  - fetch runs
  - normalized source documents
- `/accounts/[id]/autopost`
  - autopost policies
  - publishing windows
- `/accounts/[id]/engagement`
  - engagement policies
  - engagement logs
- `/accounts/[id]/preview`
  - draft candidates / preview renders
- `/drafts`
  - draft queue
  - review actions
  - draft versions
- `/calendar`
  - schedules
  - publish jobs
- `/monitoring`
  - inbox messages
  - message classification
  - alerts
- `/settings`
  - workspace settings
  - team members
  - model / provider config

## 8. API 边界建议

不要一上来做一个巨大的 `/api/state`。

应按领域拆分：

- `/api/workspaces`
- `/api/accounts`
- `/api/account-groups`
- `/api/personas`
- `/api/persona-templates`
- `/api/sources`
- `/api/source-documents`
- `/api/trends`
- `/api/drafts`
- `/api/draft-reviews`
- `/api/schedules`
- `/api/publish-jobs`
- `/api/engagement-policies`
- `/api/engagement-threads`
- `/api/messages`
- `/api/notifications`
- `/api/health-scores`
- `/api/agent-tasks`
- `/api/agent-runs`

## 9. 基础设施建议

### 9.1 数据层

- `SQLite`
  业务真相源，承担核心对象、状态机、审计、任务记录
- `Artifact files`
  保存抓取原文、原始模型输出、长日志、prompt artifact

### 9.2 异步执行

- 所有抓取、生成、审核建议、发布、回复都必须走队列
- HTTP 请求不承担长任务执行
- 每个任务都必须可重放、可取消、可审计

当前阶段队列不引入独立中间件，直接基于 SQLite 中的任务表驱动 worker。

### 9.3 观测性

- 结构化日志
- task_run 级别 tracing
- 每个外部调用必须记录 request_id / target / latency / outcome

## 10. 失败策略

按你的原则，这里必须写死：

- 不做默认回退
- 不做静默失败
- 不做隐式降级
- 不用伪成功掩盖失败

因此：

- source 抓取失败：任务显式失败，记录错误，保留原始错误上下文
- Agent 输出非法：拒绝写入，记录 schema violation
- 发布失败：job 标记失败，不自动伪装成“已排期”
- connector 不可用：返回不可执行，不切换到未知替代路径

## 11. 开发顺序

推荐从最小闭环开始：

### Phase 1

- identity / workspace
- accounts / groups
- personas / templates
- drafts / review
- schedules

### Phase 2

- sources / ingestion
- trends
- writer agent
- reviewer agent

### Phase 3

- engagement threads
- inbox classification
- reply generation
- publish connector

### Phase 4

- risk engine
- analytics
- audit explorer
- multi-workspace hardening

## 12. 外部系统是主系统约束，不是附属依赖

SmartKOLs 最难的不是内部 CRUD，而是两个外部系统：

- `Twitter/X API`
- `LLM provider APIs`

它们必须作为一等架构对象处理，而不是散落在业务代码中的 SDK 调用。

### 12.1 Twitter/X API 是执行基础设施

它负责：

- 多账号接入
- 多凭证管理
- 发布、回复、私信、读流、搜索
- 限流、幂等、重试、错误归一
- 账号级和 endpoint 级隔离

结论：

- Twitter/X API 交互必须全部收口到 `connector-x`
- 任何业务服务不得直接调用第三方 SDK

### 12.2 LLM APIs 是智能基础设施

它负责：

- Agent 推理
- 结构化输出
- prompt 版本控制
- tool 调用
- schema 校验
- provider 错误归一

结论：

- LLM 调用必须全部收口到 `model-gateway` 和 `agent-runtime`
- 任何业务服务不得自行拼 prompt 直接调用模型

### 12.3 三个最关键的系统边界

必须严格区分：

1. `draft generated` 不等于 `draft approved`
2. `reply proposed` 不等于 `reply sent`
3. `twitter accepted request` 不等于 `business action succeeded`

否则所有鲁棒性都是伪命题。

## 13. 深化设计文档

- [Twitter/X Connector 设计](./TWITTER_CONNECTOR.md)
- [LLM Agent Runtime 设计](./AGENT_RUNTIME.md)
- [后端代码骨架与接口边界](./BACKEND_LAYOUT.md)
