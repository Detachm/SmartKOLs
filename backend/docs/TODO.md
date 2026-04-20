# Backend Todo

## 1. 说明

这份 todo 只保留现在真正还要做的事。

已经完成的历史阶段不再继续展开。

状态约定：

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成

## 2. 已完成基线

- [x] 真实 X adapter
- [x] 真实 OpenAI Responses transport
- [x] 真实 RSS/Atom source fetch transport
- [x] prompt / tool policy / structured output / provider error normalization
- [x] 关键长任务 worker 化
  - draft generate
  - draft review
  - inbox classify
  - reply proposal generate
  - source fetch
  - publish execute
- [x] 显式 retry / dead-letter 基础语义
- [x] 启动配置统一加载与环境变量校验

## 3. P0: 执行闭环剩余缺口

- [x] 为 `agent_tasks / publish_jobs / source_fetch_runs` 增加 lease / timeout / stuck-run recovery
- [x] 把 `mentions.pull` 改成 queue + worker job
- [x] 把 `dm.pull` 改成 queue + worker job
- [x] 把 `engagement.reply.execute` 改成 queue + worker job
- [x] 补完 connector idempotency guard
- [x] 持久化原始 model/source artifacts，而不是只保留业务投影

## 4. P1: Source Coverage

- [x] `website` source fetch adapter
- [x] `substack` source fetch adapter
- [x] `youtube` source fetch adapter
- [x] `telegram` source fetch adapter
- [x] `twitter` source fetch adapter

## 5. P2: Operator Control Surface

- [x] `/api/messages`
- [x] `/api/account-groups`
- [x] `/api/persona-templates`
- [x] `/api/draft-reviews`
- [x] queue / dead-letter explorer queries
- [x] run trace explorer query
- [x] audit explorer query

## 6. 内容平面剩余项

- [x] stronger similarity / duplication guard

## 7. P3: Production Ops

- [x] secret / vault
- [x] structured logs
- [x] metrics
- [x] worker supervision strategy
- [x] operator runbook

## 8. 当前顺序

现在最合理的执行顺序：

1. 保持 TODO 与真实代码同步
2. 新增能力时优先补真实 query / contract，而不是先扩 UI 想象面

原因很直接：

- operator surface 应该建立在真实执行链之上
- ops 硬化必须放在真实执行闭环之后
