# SmartKOLs Database Design

## 1. 设计原则

数据库只存三类东西：

1. 领域真相对象
2. 状态机与审计
3. Agent / job 执行记录

不存“为前端页面临时拼出来的视图对象”作为真相源。

当前唯一数据库基线：`SQLite`

约束：

- 不讨论兼容层
- 不预留双写
- 不引入额外数据库中间件
- 所有核心状态、任务、审计都直接落 SQLite

## 2. 核心表总览

### 租户与权限

- `workspaces`
- `users`
- `workspace_members`
- `roles`
- `role_permissions`

### 账号域

- `accounts`
- `account_groups`
- `account_credentials`
- `account_status_history`

### Persona 域

- `personas`
- `persona_templates`
- `persona_template_versions`
- `persona_distillation_jobs`

### 内容源与热点

- `sources`
- `source_fetch_runs`
- `source_documents`
- `source_document_embeddings`
- `trends`
- `trend_documents`
- `trend_scores`

### 内容生产与审核

- `drafts`
- `draft_versions`
- `draft_reviews`
- `draft_labels`

### 排期与发布

- `publish_schedules`
- `publish_jobs`
- `publish_attempts`
- `published_posts`

### 互动与收件箱

- `engagement_policies`
- `engagement_threads`
- `engagement_messages`
- `engagement_actions`
- `engagement_action_attempts`

### 监控与通知

- `alerts`
- `notifications`
- `health_scores`
- `health_score_factors`

### Agent 与任务系统

- `agent_definitions`
- `agent_tasks`
- `agent_runs`
- `agent_run_steps`
- `tool_calls`
- `model_requests`
- `model_request_attempts`

### 审计

- `audit_logs`
- `state_transitions`

## 3. 关键表设计

下面列 P0 必要表。

### 3.1 workspaces

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 工作区 |
| name | text | 名称 |
| slug | text unique | 稳定标识 |
| status | text | `active`, `suspended`, `closed` |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 3.2 users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 用户 |
| email | text unique | 登录邮箱 |
| name | text | 名称 |
| status | text | `active`, `disabled` |
| created_at | datetime | 创建时间 |

### 3.3 workspace_members

| 字段 | 类型 | 说明 |
|---|---|---|
| workspace_id | text fk | 工作区 |
| user_id | text fk | 用户 |
| role_code | text | `owner`, `admin`, `editor`, `viewer` |
| joined_at | datetime | 加入时间 |

唯一键：

- `(workspace_id, user_id)`

### 3.4 account_groups

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 分组 |
| workspace_id | text fk | 所属工作区 |
| name | text | 分组名 |
| color | text | UI 色值 |
| created_at | datetime | 创建时间 |

唯一键：

- `(workspace_id, name)`

### 3.5 accounts

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 账号 |
| workspace_id | text fk | 工作区 |
| group_id | text fk nullable | 分组 |
| platform | text | 先固定为 `x` |
| handle | text | `@handle` |
| display_name | text | 显示名 |
| avatar_url | text nullable | 头像 |
| status | text | `active`, `paused`, `disabled`, `error` |
| follower_count | integer | 粉丝数 |
| following_count | integer | 关注数 |
| post_count | integer | 推文数 |
| external_account_id | text nullable | 平台侧账号 id |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

唯一键：

- `(workspace_id, platform, handle)`

### 3.6 account_credentials

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 凭证 |
| account_id | text fk | 账号 |
| provider | text | `x_oauth1`, `x_oauth2`, `api_key` |
| secret_ref | text | 指向外部 secret manager 的引用 |
| status | text | `valid`, `invalid`, `expired`, `revoked` |
| last_validated_at | datetime nullable | 最近校验时间 |
| created_at | datetime | 创建时间 |

约束：

- 凭证明文不入库
- 只存 secret reference

### 3.6.1 connector rate limit buckets

Twitter/X 的限制不是单一维度，因此需要显式建模配额桶。

建议新增表：

- `connector_rate_limit_buckets`
- `connector_requests`

#### connector_rate_limit_buckets

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 配额桶 |
| platform | text | `x` |
| credential_id | text fk nullable | 凭证维度 |
| account_id | text fk nullable | 账号维度 |
| endpoint_code | text | 如 `post.create`, `dm.list` |
| window_key | text | 平台窗口标识 |
| limit_count | integer | 限额 |
| remaining_count | integer | 剩余额度 |
| resets_at | datetime | 重置时间 |
| updated_at | datetime | 更新时间 |

#### connector_requests

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 一次平台调用 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| credential_id | text fk | 凭证 |
| endpoint_code | text | 平台接口语义名 |
| idempotency_key | text nullable | 幂等键 |
| request_payload | text(json) | 结构化请求 |
| response_payload | text(json) nullable | 结构化响应 |
| platform_status_code | text nullable | 第三方状态 |
| status | text | `succeeded`, `failed`, `rate_limited` |
| error_code | text nullable | 内部错误码 |
| error_message | text nullable | 错误消息 |
| started_at | datetime | 发起时间 |
| finished_at | datetime nullable | 结束时间 |

必要约束：

- 所有真正触达 Twitter/X 的动作都必须留下 `connector_requests`
- 发布、回复、私信必须带 `idempotency_key`

### 3.7 personas

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | persona 记录 |
| workspace_id | text fk | 工作区 |
| account_id | text fk unique | 一账号一主 persona |
| version | integer | 版本号 |
| gender | text | 性别 |
| nationality | text | 国籍 |
| age | integer | 年龄 |
| interests | text(json) | 兴趣标签 |
| personality_traits | text(json) | 性格标签 |
| writing_style | text | 写作风格 |
| bio | text | 简介 |
| distillation_sample_tweets | text | 蒸馏样本 |
| source | text | `manual`, `template`, `distilled`, `generated` |
| created_by_type | text | `user`, `agent`, `system` |
| created_by_id | text nullable | 操作者 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 3.8 persona_templates

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 模板 |
| workspace_id | text nullable | null 表示系统模板 |
| name | text | 模板名 |
| description | text | 描述 |
| template_body | text(json) | persona 结构化模板 |
| is_active | boolean | 是否启用 |
| created_at | datetime | 创建时间 |

### 3.9 sources

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 信息源 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| type | text | `rss`, `website`, `twitter`, `youtube`, `substack`, `telegram` |
| name | text | 来源名 |
| url | text | 地址 |
| status | text | `active`, `paused`, `error` |
| last_fetched_at | datetime nullable | 最近抓取时间 |
| created_at | datetime | 创建时间 |

唯一键：

- `(account_id, url)`

### 3.10 source_fetch_runs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 一次抓取任务 |
| source_id | text fk | 信息源 |
| status | text | `queued`, `running`, `succeeded`, `failed` |
| fetched_count | integer | 抓到条数 |
| error_code | text nullable | 错误码 |
| error_message | text nullable | 错误信息 |
| started_at | datetime | 开始时间 |
| finished_at | datetime nullable | 结束时间 |

### 3.11 source_documents

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 标准化文档 |
| workspace_id | text fk | 工作区 |
| source_id | text fk | 来源 |
| external_doc_id | text nullable | 外部文档 id |
| canonical_url | text | 标准 url |
| title | text | 标题 |
| summary | text | 摘要 |
| body_text | text | 正文 |
| language | text | 语言 |
| published_at | datetime nullable | 发布时间 |
| content_hash | text | 去重 hash |
| created_at | datetime | 入库时间 |

索引：

- `(source_id, published_at desc)`
- `(workspace_id, content_hash)`

### 3.12 trends

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 热点 |
| workspace_id | text fk | 工作区 |
| topic | text | 热点标题 |
| category | text | 分类 |
| score | numeric | 热度分 |
| status | text | `active`, `cooling`, `archived` |
| detected_at | datetime | 首次识别时间 |
| updated_at | datetime | 更新时间 |

### 3.13 drafts

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 草稿 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| trend_id | text fk nullable | 关联热点 |
| current_version_id | text nullable | 当前版本 |
| status | text | `pending`, `approved`, `rejected`, `scheduled`, `published`, `failed` |
| topic | text | 主题 |
| scheduled_for | datetime nullable | 排期时间 |
| generated_by_run_id | text nullable | 生成任务 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### 3.14 draft_versions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 版本 |
| draft_id | text fk | 草稿 |
| version_no | integer | 版本号 |
| content | text | 正文 |
| metadata | text(json) | 模型、prompt、引用 source 等 |
| created_by_type | text | `user`, `agent`, `system` |
| created_by_id | text nullable | 操作者 |
| created_at | datetime | 创建时间 |

唯一键：

- `(draft_id, version_no)`

### 3.15 draft_reviews

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 审核记录 |
| draft_id | text fk | 草稿 |
| reviewer_type | text | `user`, `agent` |
| reviewer_id | text nullable | 审核者 |
| action | text | `approve`, `reject`, `edit`, `request_regenerate` |
| comment | text nullable | 备注 |
| created_at | datetime | 时间 |

### 3.16 publish_schedules

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 排期 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| draft_id | text fk | 草稿 |
| scheduled_for | datetime | 计划发布时间 |
| status | text | `scheduled`, `queued`, `published`, `failed`, `cancelled` |
| created_at | datetime | 创建时间 |

### 3.17 publish_jobs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 发布任务 |
| schedule_id | text fk | 排期 |
| status | text | `queued`, `running`, `succeeded`, `failed` |
| idempotency_key | text unique | 幂等键 |
| error_code | text nullable | 错误码 |
| error_message | text nullable | 错误 |
| run_after | datetime | 最早执行时间 |
| started_at | datetime nullable | 开始 |
| finished_at | datetime nullable | 结束 |

### 3.17.1 published_posts

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 已发布记录 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| draft_id | text fk nullable | 来源草稿 |
| connector_request_id | text fk | 对应平台调用 |
| external_post_id | text | 平台 post id |
| external_post_url | text nullable | 平台 url |
| content | text | 实际发送内容 |
| published_at | datetime | 发布时间 |

约束：

- 只有 connector 明确成功回执后才能写入 `published_posts`

### 3.18 engagement_policies

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 策略 |
| workspace_id | text fk | 工作区 |
| account_id | text fk unique | 账号 |
| policy_body | text(json) | 自动关注/转发/评论/回复配置 |
| status | text | `active`, `paused` |
| updated_at | datetime | 更新时间 |

### 3.19 engagement_threads

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 互动线程 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| channel | text | `mention`, `reply`, `dm`, `comment` |
| external_thread_id | text | 平台线程 id |
| counterpart_handle | text nullable | 对方 handle |
| classification | text | `collab`, `commerce`, `spam`, `normal`, `support` |
| status | text | `open`, `pending_action`, `closed`, `ignored` |
| last_message_at | datetime | 最近消息时间 |
| created_at | datetime | 创建时间 |

### 3.20 engagement_messages

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 消息 |
| thread_id | text fk | 线程 |
| direction | text | `incoming`, `outgoing` |
| sender_handle | text nullable | 发送方 |
| content | text | 内容 |
| raw_payload | text(json) | 原始负载 |
| created_at | datetime | 时间 |

### 3.21 notifications

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 通知 |
| workspace_id | text fk | 工作区 |
| type | text | `post`, `message`, `health`, `action`, `engagement` |
| title | text | 标题 |
| body | text | 内容 |
| link | text nullable | 跳转地址 |
| read_at | datetime nullable | 已读时间 |
| created_at | datetime | 创建时间 |

### 3.22 health_scores

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 健康分快照 |
| workspace_id | text fk | 工作区 |
| account_id | text fk | 账号 |
| score | integer | 0-100 |
| risk_level | text | `low`, `medium`, `high` |
| computed_at | datetime | 计算时间 |

### 3.23 agent_definitions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | Agent 定义 |
| code | text unique | `writer`, `reviewer`, `trend_scout` |
| name | text | 名称 |
| version | text | 版本 |
| input_schema | text(json) | 输入约束 |
| output_schema | text(json) | 输出约束 |
| tool_policy | text(json) | 工具权限 |
| is_active | boolean | 是否启用 |

### 3.24 agent_tasks

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 任务 |
| workspace_id | text fk | 工作区 |
| agent_definition_id | text fk | Agent |
| task_type | text | 任务类型 |
| target_type | text | 目标对象类型 |
| target_id | text | 目标对象 |
| payload | text(json) | 结构化输入 |
| status | text | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| created_at | datetime | 创建时间 |

### 3.25 agent_runs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 一次运行 |
| task_id | text fk | 任务 |
| run_no | integer | 第几次尝试 |
| model_name | text | 模型 |
| status | text | `running`, `succeeded`, `failed` |
| output | text(json) nullable | 输出 |
| error_code | text nullable | 错误码 |
| error_message | text nullable | 错误消息 |
| started_at | datetime | 开始时间 |
| finished_at | datetime nullable | 结束时间 |

### 3.26 tool_calls

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 工具调用 |
| agent_run_id | text fk | Agent run |
| tool_name | text | 工具名 |
| request_payload | text(json) | 请求 |
| response_payload | text(json) nullable | 响应 |
| status | text | `succeeded`, `failed` |
| started_at | datetime | 开始 |
| finished_at | datetime nullable | 结束 |

### 3.26.1 model_requests

模型调用不等同于 agent run，需要单独建模。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 一次模型请求 |
| workspace_id | text fk | 工作区 |
| agent_run_id | text fk nullable | 关联 agent run |
| provider | text | `openai`, `anthropic` 等 |
| model_name | text | 模型名 |
| request_schema_version | text | 请求结构版本 |
| prompt_artifact_ref | text nullable | prompt artifact 引用 |
| tool_spec_ref | text nullable | 工具规范引用 |
| status | text | `running`, `succeeded`, `failed`, `invalid_output` |
| started_at | datetime | 开始 |
| finished_at | datetime nullable | 结束 |

### 3.26.2 model_request_attempts

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 单次 provider 尝试 |
| model_request_id | text fk | 模型请求 |
| attempt_no | integer | 第几次尝试 |
| provider_request_id | text nullable | 供应商 request id |
| raw_response_ref | text nullable | 原始响应引用 |
| parsed_output | text(json) nullable | 解析结果 |
| validation_error | text nullable | schema 校验错误 |
| error_code | text nullable | 失败码 |
| error_message | text nullable | 错误信息 |
| started_at | datetime | 开始 |
| finished_at | datetime nullable | 结束 |

必要约束：

- 原始 provider 输出和解析后的结构化输出必须分开
- schema 不通过时状态必须是 `invalid_output`，不能当成功

### 3.27 audit_logs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text pk | 审计 |
| workspace_id | text fk | 工作区 |
| actor_type | text | `user`, `agent`, `system` |
| actor_id | text nullable | 操作者 |
| entity_type | text | 对象类型 |
| entity_id | text | 对象 id |
| action | text | 动作 |
| before_state | text(json) nullable | 变更前 |
| after_state | text(json) nullable | 变更后 |
| created_at | datetime | 时间 |

## 4. 状态机约束

### 4.1 Draft 状态机

```text
pending -> approved -> scheduled -> published
pending -> rejected
pending -> failed
approved -> failed
scheduled -> failed
```

禁止：

- 直接从 `pending` 跳到 `published`
- 未生成版本就进入 `approved`
- `rejected` 再静默恢复成 `approved`

### 4.2 Publish Job 状态机

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> cancelled
```

### 4.3 Agent Task 状态机

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> cancelled
failed -> queued   (only by explicit retry)
```

## 5. 必要索引

- `accounts(workspace_id, handle)`
- `personas(account_id)`
- `sources(account_id, status)`
- `source_documents(workspace_id, published_at desc)`
- `drafts(workspace_id, status, created_at desc)`
- `publish_schedules(account_id, scheduled_for)`
- `engagement_threads(account_id, last_message_at desc)`
- `notifications(workspace_id, created_at desc)`
- `agent_tasks(workspace_id, status, created_at desc)`
- `audit_logs(workspace_id, entity_type, entity_id, created_at desc)`

## 6. SQLite 约束下的实现要求

- 所有主键统一使用 `text`
- 所有时间统一使用 `datetime`
- 结构化字段统一使用 `text(json)`
- 队列依赖任务表和状态字段驱动，不引入独立 broker
- 审计、connector 请求、model request 都是 SQLite 中的一等记录

## 7. 明确不做的事

为了遵守你给的原则，这些方案不采用：

- 不用一个 `json state` 大对象充当永久真相源
- 不用“字段缺了就给默认值继续跑”的静默回退
- 不用“失败就先记成功，异步再修”的伪一致性
- 不把 Agent 输出直接当最终状态，不经过状态机和审计
