# Backend Roadmap

## 1. 当前判断

当前后端的真实状态应该这样定义：

- `Internal Platform Live`
  - 核心领域、状态机、审计、trace、monitoring 已经成型
- `External Execution Partially Live`
  - X 已真实接入
  - LLM 已真实接入
  - source fetch 已对 `rss/atom/website/substack/youtube/twitter/telegram` 真实接入
- `Execution Closed`
  - 长任务已经进入 queue + worker
  - dead-letter / retry / lease recovery 已经具备
- `Operator And Ops Pending`
  - operator surface 还不完整
  - production ops 还未收口

所以现在的重点不再是“造更多骨架”，而是把剩余关键闭环补齐。

## 2. 非谈判原则

后面的所有规划都必须服从这些原则：

- 不做默认 fallback
- 不做静默处理
- 不做隐式降级
- 不用伪成功掩盖失败
- 长任务必须走 queue + worker
- dead-letter 只能显式 retry
- provider/platform 错误必须结构化暴露

补充：

- source coverage 不是目标本身
- 真正要交付的是“source-backed content pipeline”
- 相关专项设计见 [../../docs/source-backed-content-pipeline-plan.md](../../docs/source-backed-content-pipeline-plan.md)

## 3. 里程碑重排

### M1: Execution Closed

目标：

把剩余执行链收成一致、可恢复、可重放的系统。

完成定义：

- 所有长任务都进入 queue + worker
- worker crash 后不会留下永久 `running`
- retry / dead-letter 语义一致
- connector idempotency 不再留缺口
- 原始执行 artifacts 可追

当前进度：

- queue + worker 已覆盖 publish / source fetch / agent task / mentions pull / dm pull / engagement reply execute
- stale `running` lease 现在会自动收敛成 failed dead-letter
- connector idempotency 与 raw artifacts persistence 已完成

### M2: Source Coverage Useful

目标：

让 content plane 不再只依赖 RSS。

完成定义：

- `website` 可抓
- `substack / youtube / telegram / twitter` 有明确 adapter
- 各 source type 的错误语义一致

当前进度：

- `website` 已完成
- `substack` 已完成
- `youtube` 已完成
- `twitter` 已完成
- `telegram` 已完成

### M3: Operator Surface Complete

目标：

让运营和排障不再需要绕 SQLite。

完成定义：

- messages API 可用
- account groups / persona templates / draft reviews API 可用
- queue / dead-letter / trace / audit explorer 可用

### M4: Production Ops Ready

目标：

把系统从“能真实执行”推进到“能长期运行”。

完成定义：

- secret/vault 接入
- structured logs
- metrics
- worker supervision
- operator runbook

当前进度：

- shared managed secret vault 已接入，并统一承载 `connector_x` / `alert_channel` managed secret
- `runtime_processes` heartbeat 与 `runtime_events` structured log 已接入 HTTP / worker 启停与故障路径
- `/ops/health` 与 `/ops/overview` 已可用，monitoring 页面已接入 runtime health / queue metrics / secret inventory
- runbook 已落在 [RUNBOOK.md](./RUNBOOK.md)

## 4. 当前最短路径

从现在开始，执行顺序应该固定为：

1. `M3 Operator Surface Complete`
2. `M4 Production Ops Ready`

这个顺序不能反过来。

原因：

- 没有 `M3`，真实系统也没有足够操作面
- 没有 `M4`，系统无法稳定长期运行

## 5. 现在不该做什么

- 不再新增“骨架式”抽象层
- 不再把 mock / fake adapter 当成里程碑
- 不再让 HTTP 线程顺手执行长任务
- 不再先补 API，再回头补执行语义
