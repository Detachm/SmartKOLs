# SmartKOLs Chief Orchestrator 架构评估与收敛方案

## 1. 文档目的

本文档基于当前代码库的真实实现，重新定义 SmartKOLs 引入 Chief Orchestrator / 主 Agent 调度的最短正确路径。

目标不是做一次“大重构”，而是在不推翻现有领域模型、执行层和产品面的前提下，把账号级自动化主脑真正加进去。

这份文档明确回答三件事：

- 当前系统到底缺什么
- 哪些方向是对的，但原方案做重了
- 如果必须加入主 Agent 调度，最稳、最小、最符合现有原则的做法是什么

## 2. 非谈判原则

这次改造必须继续服从仓库里已经写死的工程原则，并补充两条收敛原则。

### 2.1 继续成立的原则

- 不做默认 fallback
- 不做静默处理
- 不做隐式降级
- 不用伪成功掩盖失败
- 长任务必须走 queue + worker
- provider / platform 错误必须结构化暴露
- 外部文本只能作为数据，不能作为指令
- 真实状态只能通过领域命令和状态机推进

### 2.2 这次收敛必须新增的原则

- 主 Agent 可以做“选择”，但不能直接定义真实系统状态
- 决策前必须先经过确定性的 eligibility / hard guard 过滤
- 不做一次性替换全部异步原语、策略对象、审批对象的大迁移
- 不新增和现有真相并行的大型中间层
- 迁移必须渐进，但每条已切换能力在任一时刻只能有一个编排 owner

最后一条很关键。

允许渐进切换，不等于允许同一条链路长期双轨运行。

## 3. 当前代码库的真实现状

### 3.1 已经具备的正确基础

当前系统不是“散乱脚本”。

它已经有这些可复用能力：

- 明确的领域对象与状态机
  - `content_briefs`
  - `drafts`
  - `draft_reviews`
  - `publish_schedules`
  - `publish_jobs`
  - `engagement_reply_proposals`
  - `autopost_runs`
- 显式执行层
  - `worker_jobs`
  - `agent_tasks`
  - `worker-runner`
- 运行时观测
  - `agent_runs`
  - `model_requests`
  - `tool_calls`
  - `runtime_events`
  - `alerts`
  - `audit_logs`
- 草稿审批闸门
  - `draft.status = pending -> approved/rejected`
- source-backed content 主链
  - brief evidence persistence
  - draft evidence metadata
  - originality guard

这些不是问题，它们是这次收敛的起点。

### 3.2 当前真实架构形态

当前系统本质上仍然是：

- 多个领域命令
- 多个专用 agent
- 多个专用 worker job
- 多个 operator 页面
- 两条局部自动化链
  - `recurring brief`
  - `autopost`

它还不是一个真正的 account-level 主脑。

更准确地说，当前系统是：

- 多个局部自动化子系统
- 加一个人工控制面

而不是：

- 一个统一的账号级调度系统

### 3.3 当前真正的痛点

结合当前实现，真正需要解决的是下面四个问题。

#### A. 没有账号级统一调度

现在没有一个地方对账号做统一判断：

- 此刻该不该继续生成内容
- 应该优先 brief 还是 draft
- 此刻为什么必须停下来
- 内容、互动、审批积压之间如何取舍

#### B. 编排逻辑散落在多处

当前跨域推进逻辑分散在：

- `RunAgentTask`
- `AutopostAutomationOrchestrator`
- `ExecuteRecurringBriefPlan`

结果是：

- 自动化成立在局部钩子里
- 链路推进是隐式的
- 新路径很容易继续复制这种耦合

#### C. 缺少账号级 blocked reason / backpressure / fairness

当前系统已经能执行，但还缺少统一的账号控制视角：

- 没有明确的 `blocked_reason_code`
- 没有统一的“待审批草稿过多时停止生成”
- 没有统一的“账号当前是否已有自动化动作在飞”
- 没有统一的账号级调度公平性语义

#### D. 上层控制面对 untrusted content 的边界还不够清楚

当前 brief-builder / writer 仍会直接消费 document 标题、摘要和部分正文摘要。

这在 brief / draft agent 层是可以接受的，但不应该继续上升为主脑的输入面。

主 Agent 不应该直接看原始外部文本。

## 4. 对旧方案的独立判断

上一版评估里，对问题的判断大体是对的，但方案做重了。

### 4.1 我同意的部分

- 需要引入 account-level 主脑
- 需要把“允许做什么”和“从中选什么”分开
- 需要把跨域 continuation 从局部钩子里收出来
- 需要把主脑输入限制在结构化状态，而不是原始外部文本
- 需要把人工手动按钮降级为 override，而不是主路径

### 4.2 我不同意的部分

以下几件事，不应该在这一阶段一起做：

- 不应该立刻用 `account_automation_policies` 吞并所有策略对象
- 不应该立刻用 `execution_jobs` 替换 `worker_jobs + agent_tasks`
- 不应该立刻引入完整 `account_agendas + account_agenda_items`
- 不应该立刻把 `draft_approval_requests` 升成新的核心真相
- 不应该要求一次性切换 schema / domain / API / frontend / execution 全部主路径
- 不应该现在就删除 `autopost`、`editorial`、`execution` 现有主实体

原因不是这些方向永远不对，而是它们不是现在的最小痛点。

现在最需要收口的是“调度权”和“链路推进方式”，不是一次性重造整套控制平面。

## 5. 目标架构：薄 Orchestration 层

最合适的目标形态不是“大一统重构”，而是：

- 保留现有领域状态机
- 保留现有 `worker_jobs` 和 `agent_tasks`
- 新增一个薄的 orchestration layer
- 让主 Agent 只负责选择下一步
- 让真实落库仍由现有领域命令负责

### 5.1 分层结构

目标架构应收敛成五层：

1. `Domain State Machines`
   - `content_briefs`
   - `drafts`
   - `publish_schedules`
   - `publish_jobs`
   - `engagement_*`

2. `Eligibility Engine`
   - 确定性代码
   - 算出账号当前允许执行哪些动作
   - 给出 blocked reason / hard guard 结果

3. `Chief Orchestrator / 主 Agent`
   - 只在允许动作集合里做 0-1 个动作选择
   - 只输出 typed decision

4. `Action Applier`
   - 把 typed decision 映射到现有 command
   - 例如 `GenerateContentBrief`、`GenerateDraft` 等现有安全命令

5. `Execution Layer`
   - 继续使用 `worker_jobs` / `agent_tasks`
   - 继续保留 lease / retry / audit / trace

### 5.2 主 Agent 的职责边界

主 Agent 只负责：

- 读取账号级结构化 world model
- 在允许动作集合里选择一条最值得推进的动作
- 明确输出 `no_action + reason_code`

主 Agent 不负责：

- 直接读原始 source document 正文
- 直接 approve draft
- 直接 publish
- 直接改任意领域实体
- 绕过确定性 hard guard

### 5.3 主 Agent 的输出形式

主 Agent 不输出自由文本命令，只输出 typed decision。

第一阶段建议只支持这些动作：

- `no_action`
- `brief.generate.from_trend`
- `brief.generate.from_source_scope`
- `draft.generate.from_brief`
- `engagement.classify`
- `engagement.reply.generate`

第一阶段不让主 Agent 直接做这些动作：

- `draft.approve`
- `publish.queue`
- `reply.send`

这些动作继续由确定性规则和人工闸门控制。

## 6. 第一阶段最小落地方案

### 6.1 新增最小 orchestration 模块

建议新增：

- `backend/src/modules/orchestration/domain/orchestration-decision.ts`
- `backend/src/modules/orchestration/application/commands/tick-account-automation.ts`
- `backend/src/modules/orchestration/application/services/build-account-automation-overview.ts`
- `backend/src/modules/orchestration/application/services/evaluate-account-eligibility.ts`
- `backend/src/modules/orchestration/application/services/chief-orchestrator.ts`
- `backend/src/modules/orchestration/application/services/apply-orchestration-decision.ts`
- `backend/src/modules/orchestration/application/queries/get-account-automation-overview.ts`

这一层的职责只有一个：

- 收口“下一步做什么”

不负责改写所有领域。

### 6.2 只新增两个最小持久化对象

第一阶段只建议新增：

- `account_orchestration_states`
- `orchestration_runs`

不建议第一阶段就上：

- `account_agendas`
- `account_agenda_items`
- `orchestration_steps`
- `execution_jobs`

#### `account_orchestration_states`

作用：

- 记录账号自动化调度状态
- 记录下次 tick 时间
- 记录上一次 blocked reason

建议字段：

- `account_id`
- `workspace_id`
- `status`
- `next_tick_after`
- `last_tick_at`
- `active_run_id`
- `last_decision_type`
- `last_reason_code`
- `updated_at`

#### `orchestration_runs`

作用：

- 记录主脑每次调度的输入摘要与决策结果

建议字段：

- `id`
- `workspace_id`
- `account_id`
- `trigger_kind`
- `eligible_actions_json`
- `chosen_action_json`
- `status`
- `error_code`
- `error_message`
- `created_at`
- `finished_at`

这已经足够支持监控和排障。

### 6.3 保留现有异步原语

第一阶段明确保留：

- `agent_tasks`
- `worker_jobs`
- `publish_jobs`
- `source_fetch_runs`

但增加一个新 job type：

- `orchestration.tick`

这样能直接复用当前：

- queue + worker
- lease recovery
- retry / dead-letter
- runtime monitoring

这比重做 `execution_jobs` 更符合当前仓库的最短路径。

### 6.4 不新增新的审批真相

第一阶段不引入 `draft_approval_requests`。

原因：

- 当前 `draft.status = pending`
- 当前 `draft_reviews`
- 当前 `/drafts` list query

已经足够支撑草稿审批。

如果后续确实需要：

- `priority_score`
- `reason_code`
- inbox 排序

优先先做 read model，不先做第二套持久化审批对象。

## 7. 关键行为改造：停止“任务成功后立即链式推进”

这次收口里最重要的一条，不是加多少新表，而是改推进方式。

### 7.1 新的推进原则

任何 agent task / worker job 成功后：

- 只更新自己负责的领域状态
- 不在同一命令里继续决定下一个跨域动作

下一步做什么，统一交回给下一次 `orchestration.tick`。

### 7.2 内容主链应改成这种节奏

```text
tick(account)
-> chief 选择 brief.generate.from_source_scope
-> GenerateContentBrief 创建 brief + agent_task

brief-builder 成功
-> 只把 brief 落成 ready

下一次 tick(account)
-> chief 看到 ready brief 且允许继续
-> 选择 draft.generate.from_brief
-> GenerateDraft 创建 agent_task

writer 成功
-> 只把 draft 落成 pending

下一次 tick(account)
-> chief 输出 no_action(awaiting_draft_review)
```

这个变化的价值非常大：

- 去掉隐式 continuation
- 调度权回到主脑
- 任何自动链都变成可观测、可解释的离散步进
- 不需要重做执行层

### 7.3 对现有模块的影响

#### `RunAgentTask`

应收敛为：

- 模型调用
- schema 校验
- tool call 审计
- 该 agent 对应领域对象落库

不应继续扩张：

- 新的 automation continuation
- 新的跨域链式推进

#### `AutopostAutomationOrchestrator`

不应再继续充当主路径编排器。

第一阶段建议：

- 不立刻删除
- 但停止新增能力到这里
- 主内容链切到 orchestration tick 后，逐步退役其 continuation 角色

#### `ExecuteRecurringBriefPlan`

第一阶段不必删除。

但它的角色应收敛为：

- 提供配置和触发信号

而不是：

- 长期负责内容主链编排

## 8. 策略对象怎么处理

### 8.1 第一阶段不合并成单一大 policy 表

现有三个对象先保留：

- `autopost_policies`
- `recurring_brief_plans`
- `engagement_policies`

原因很简单：

- 它们的语义并不一样
- 约束并不一样
- 现在强行揉成一个大 blob，收益不够，风险很高

### 8.2 正确做法

第一阶段由 orchestration overview 去聚合读取：

- autopost 的 cadence / source strategy / execution policy
- editorial 的 watchlist / recurring plan / campaign queue
- engagement 的 allow / block / manual approval 规则
- drafts / briefs / publish / message backlog

也就是说：

- 统一的是“读取视角”
- 不是立刻统一“写入真相”

这是现在最稳的做法。

## 9. Hard Guard 和 Backpressure

主 Agent 必须运行在确定性护栏内。

这些规则不能交给 prompt 自觉遵守。

### 9.1 第一阶段必须落地的 guard

- 每个账号同一时刻最多一个 active orchestration run
- 每个账号同一时刻最多一个内容主链生成动作在飞
- 待审批 draft 超过阈值时，禁止继续生成新 draft
- 没有可用 source / trend / brief 时，必须输出 `no_action`
- engagement policy 禁止的 channel / classification 不能被主 Agent 绕过
- draft approval 仍然只能通过现有审批命令完成

### 9.2 blocked reason 需要显式化

第一阶段至少要标准化这些 reason code：

- `awaiting_draft_review`
- `content_task_running`
- `brief_not_ready`
- `no_eligible_sources`
- `policy_paused`
- `engagement_manual_review_required`
- `budget_limited`

reason code 应能直接进入：

- monitoring
- dashboard overview
- account automation overview

## 10. Untrusted Content Boundary

### 10.1 主 Agent 的输入面

主 Agent 只读这些结构化信息：

- account automation overview
- brief 状态与摘要
- trend 元信息
- evidence summary
- pending counts
- policy config
- backlog / health / budget 指标

### 10.2 第一阶段不强制全量 facts 化

当前阶段不要求立刻新增完整：

- `source_document_fact_sets`
- `source_document_facts`

这件事可以作为第二阶段增强。

第一阶段先做到：

- 主 Agent 不直接读原始外部正文
- brief-builder / writer 继续使用 evidence 和 source scope
- monitoring 明确区分 trusted state 与 untrusted content input

### 10.3 第二阶段再补 facts 层

如果后续确认主脑在 topic selection / content risk / source ranking 上需要更强结构化输入，再补：

- facts extraction
- suspicious markers
- confidence / trust / freshness signals

但这不是第一阶段引入主 Agent 的前置条件。

## 11. 渐进切换方案

上一版文档里的“一次性切换全部主路径”不适合当前项目阶段。

这里改成渐进切换，但每条能力在切换完成后只保留一个编排 owner。

### Phase 0: 先把主脑骨架加进去

- 新增 `modules/orchestration`
- 新增 `account_orchestration_states`
- 新增 `orchestration_runs`
- 新增 `worker_jobs.job_type = orchestration.tick`
- 新增 `account automation overview` query

完成定义：

- 可以对某个账号执行一次主脑 tick
- 可以看到 eligible actions / chosen action / blocked reason

### Phase 1: 内容主链先切到主脑

主脑接管：

- `source scope / trend -> brief`
- `ready brief -> draft`

同时收紧旧逻辑：

- `RunAgentTask` 不再新增新的链式 continuation
- 主路径改成“task 完成后回到下一次 tick 再决策”

完成定义：

- brief 和 draft 的自动推进由主脑决定
- `awaiting_draft_review` 成为明确的 `no_action` 结果

### Phase 2: autopost / recurring 从“编排器”降级为“触发器 / 配置源”

第一阶段不用删除：

- `autopost.execute`
- `editorial.recurring_brief.execute`

但它们应逐步收敛成：

- 唤醒账号
- 更新 due 状态
- enqueue `orchestration.tick`

而不是自己继续推进跨域主链。

### Phase 3: engagement 纳入主脑调度

主脑开始统一决定：

- 是否优先分类
- 是否生成 reply proposal
- 是否因为 backlog / policy / manual approval 停止

但：

- `reply.send` 的安全边界仍由现有 engagement policy 决定

### Phase 4: 评估是否值得继续简化底层表

只有当前三阶段稳定后，才评估这些事是否值得做：

- 是否还需要 `autopost_runs`
- 是否要把 `recurring_brief_plans` 再抽薄
- 是否有必要合并部分 policy 读模型
- 是否真的需要 `execution_jobs`

在那之前，不提前重写。

## 12. 前端影响

前端不需要大改布局。

第一阶段只需要补两个读面：

- `account automation overview`
- `orchestration run trace`

页面职责重定义如下：

- `/dashboard`
  - 看账号当前是否 blocked
  - 看 last decision / next tick / backlog
- `/accounts/[id]/briefs`
  - 观察 brief history 和 override
- `/drafts`
  - 继续作为审批面，不新增第二个审批真相
- `/monitoring`
  - 增加 orchestration runs 和 blocked reason explorer

手动按钮可以保留，但语义改成：

- override
- wake account
- force tick

而不是：

- 人工承担正常主路径编排

## 13. 完成定义

以下条件满足，才算这次改造完成：

- 系统已引入账号级主 Agent 调度
- 主 Agent 只在确定性 eligible actions 中做选择
- brief -> draft 的自动推进不再依赖局部 continuation 钩子
- task / job 成功后只更新本域状态，下一步交回下一次 tick
- `worker_jobs` / `agent_tasks` 继续工作，且未发生大规模替换
- `/dashboard` 或 `/monitoring` 能看到 blocked reason 和 last decision
- `draft` 仍然是内容发布前的人工闸门
- engagement 的 manual approval 规则仍被保留
- 外部原始文本不会直接进入主脑输入面

## 14. 最终结论

当前项目确实必须加入主 Agent 调度。

这一点不是可选项。

但正确做法不是：

- 一次性重写整套后端控制平面
- 统一所有策略对象
- 替换所有执行原语
- 重造所有审批对象

正确做法是：

- 新增一个薄 orchestration layer
- 让主 Agent 统一决定下一步动作
- 把链式 continuation 收回到 tick 驱动
- 保留现有领域和执行基础设施
- 用渐进切换替代一次性总重构

一句话总结：

- 主 Agent 必须加
- 调度权必须收口
- 但不应该借这个机会做超出痛点的大重构
