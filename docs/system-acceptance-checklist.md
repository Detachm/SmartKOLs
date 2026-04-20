# SmartKOLs System Acceptance Checklist

## Goal

这份清单只做一件事：

- 把“本地已经能跑”推进到“整套功能可验收、可定位、可上线前回归”

它不是产品说明，也不是架构设计文档。
它只记录：

- 要测什么
- 怎么判定通过
- 当前进度到哪里

## Scope

验收按 5 条主链推进：

1. 控制面与权限
2. 内容生产链
3. 执行链
4. 数据采集与人格链
5. 监控与运维链

## Status Legend

- `[done]` 已实际验证通过
- `[in_progress]` 正在推进
- `[todo]` 尚未执行
- `[blocked]` 被外部条件阻塞

## Current Baseline

截至当前本地环境，已经明确通过的基础项：

- `[done]` backend migration 可兼容仓库现有 `live-smartkols.sqlite`
- `[done]` Next API 代理与 backend shared secret 已收紧
- `[done]` local auth 首 owner bootstrap 已限制
- `[done]` DM send flow 已实现，不再是未实现分支
- `[done]` 已绑定 X 账号 `@SFgrxvU6Zf50395` 的 `credentials/validate`、`profile/sync`、`mentions.pull`、`dm.pull` 可用
- `[done]` X 空列表响应已兼容，不再因 `missing data` 失败
- `[done]` `twitter_handle -> persona.distill` 链路可成功落库
- `[done]` `persona -> draft.generate` 主链可成功生成 draft
- `[done]` 无 persona 时 `draft.generate` 按当前设计会失败，错误为 `persona not found`

## Checklist

### 1. 控制面与权限

- `[done]` 匿名直连 backend 被 `BACKEND_PROXY_SHARED_SECRET` 拦截
- `[done]` 未登录状态下 Next API 受保护 route 返回 `401`
- `[done]` local auth 只允许空 workspace 首 owner bootstrap
- `[todo]` workspace A 无法读取 workspace B 的 account/persona/draft
- `[todo]` OAuth callback 不能把凭证绑到别的 workspace 的 `account_id`
- `[todo]` 生产配置下 local auth 默认关闭且行为符合预期

### 2. 人格链

- `[done]` 手工 persona 可写入并被 writer 使用
- `[done]` 蒸馏 persona 可从公开 X handle 拉样本并落库
- `[done]` 同一主题下，蒸馏 persona 与通用 persona 会产生明显不同文风
- `[done]` 无 persona 时 writer 按真实流程直接失败
- `[todo]` persona template 创建、应用、覆盖更新
- `[todo]` 低样本蒸馏时不出现明显幻觉
- `[todo]` source-backed persona distill 与 direct `twitter_handle` distill 都可用

### 3. 内容生产链

- `[done]` `manual_topic -> draft.generate` 可用
- `[in_progress]` `persona imported vs generic persona` 对照已完成一轮
- `[done]` `content_brief_id -> draft.generate` 可用，已在一次 `MODEL_NETWORK_ERROR` 后通过重试恢复
- `[todo]` `trend_id -> draft.generate` 可用
- `[done]` `draft.review.generate` 可用，provider 限流窗口外已成功完成
- `[done]` `approve / reject / request_regenerate` 三种 review 分支都已有执行入口
- `[todo]` 手工 `edit draft` 后版本号、metadata、当前稿同步正常
- `[done]` `generateDraftFromContentBrief` 闭环可用
- `[done]` source-backed originality guard 能正确写入 evidence 与 metadata

### 4. 执行链

- `[done]` 真实 `post.create` 成功，返回 `external_post_id=2045795303434092550`
- `[done]` 真实 `reply proposal -> approve -> send` 成功
- `[blocked]` 真实 `dm proposal -> approve -> send` 目前缺少可用真实 DM conversation id
- `[done]` `schedule draft` 成功
- `[done]` 改期与取消 schedule 成功
- `[done]` `publish job` 执行成功并正确回写
- `[done]` `retry publish job` 能处理失败稿件

### 5. 数据采集与 source 链

- `[done]` `mentions.pull` 与 `dm.pull` 在空结果场景下可成功返回
- `[done]` `twitter_handle -> recent posts/replies` 可用于 persona distill
- `[done]` `add twitter source -> fetch -> ingest -> list documents` 主链可用
- `[done]` `queued source_fetch_run -> execute -> succeeded` 可通过正式 HTTP route 完成
- `[todo]` source fetch retry 可用
- `[done]` 重复抓取不会生成重复文档
- `[done]` `twitter source` 文档的 `title/summary/body_text/published_at/canonical_url` 合理
- `[done]` 已明确 current limitation: 当前只抓最近帖子/回复，不含 retweet 历史分页

### 6. 自动化链

- `[in_progress]` recurring brief plan 创建、执行、重试
- `[in_progress]` autopost policy 创建、触发、排队、执行
- `[in_progress]` orchestration tick 已接入 recurring/autopost/content follow-up，并开始覆盖 engagement classify / reply proposal 调度，且会遵守 engagement policy；但完整主编排闭环仍未验收完成

### 7. 监控与运维链

- `[done]` `/ops/health` 能正确反映 HTTP / worker 在线状态
- `[done]` worker 失败会进入 `runtime events`
- `[done]` model request / connector request 可追踪关键失败
- `[done]` monitoring overview 能反映 draft / publish / connector / model / source fetch 的最新动作
- `[todo]` audit logs 覆盖 account/persona/draft/review/publish 关键动作
- `[done]` stale heartbeat 恢复路径已验证，`stale_processes` 可从 `12 -> 0`
- `[todo]` failed jobs、critical events 的恢复路径都验证一次

## Recommended Execution Order

按这个顺序推进，能最快暴露真实阻塞：

1. `post.create`
2. `reply proposal -> send`
3. `dm send`
4. `content brief -> draft -> review`
5. `schedule -> publish`
6. `twitter source -> fetch -> ingest`
7. `autopost / recurring brief`
8. `monitoring / audit / ops`
9. `multi-tenant / authz`

## Recent Completed Checks

### Persona Comparison On Same Topic

主题：

- `最近的美伊战争`

对照组：

- `702ed9ea-9fb4-4219-bd58-f6bbed499d91`
  - 导入蒸馏 persona
- `e8e64c57-280e-4836-b2a4-97bb91253124`
  - 通用中文时评 persona
- `45702a39-c349-41f2-95b2-5acf4cd4b3ae`
  - 无 persona

结果：

- `[done]` 导入蒸馏 persona 生成成功，文风明显偏 AI builder / systems framing
- `[done]` 通用 persona 生成成功，文风为标准中文时评号
- `[done]` 无 persona 按真实流程失败：`persona not found`

结论：

- 当前项目中，persona 不是可选增强，而是 writer 的必需输入
- persona 质量直接决定生成稿的辨识度与表达框架

### Real Post Execution

真实账号：

- `9508cc8e-a9c1-47ec-b221-83a1c65dee2a`

结果：

- `[done]` 真实 `post.create` 成功
- `external_post_id=2045795303434092550`
- 测试内容为 `SmartKOLs smoke test 2026-04-19: post.create path verification. Ignore this test post.`

### Source-Backed Brief Findings

brief:

- `7a87b5dd-11c7-4078-bdd4-05e8a7ae4f17`

结果：

- `[done]` `content_brief.generate` 可成功完成
- `[issue]` 当 `source_scope` 没有命中与 `topic_hint` 强相关的文档时，brief 会漂移到当前 source corpus 的既有主题
- 这次请求的 `topic_hint=最近的美伊战争`，最终 brief topic 却变成了 `LLM时代的数据隐私与零信任架构`

### Model Stability Findings

当前 GLM 链路不是全挂，而是同时存在瞬时网络抖动与 provider 限流：

- `[done]` `persona.distill` 已成功
- `[done]` `manual_topic -> draft.generate` 已成功
- `[done]` `content_brief.generate` 已成功
- `[done]` `generateDraftFromContentBrief` 出现过一次 `MODEL_NETWORK_ERROR`，补充 provider retry 后已成功
- `[issue]` `draft.review.generate` 首次报 `MODEL_NETWORK_ERROR`，补充 retry 后进一步暴露为 `MODEL_RATE_LIMITED`

结论：

- 当前更像 provider/network 稳定性与限流问题，不像 schema 或业务逻辑错误
- 已补充 provider 级重试，能覆盖瞬时网络失败
- review 链还需要在 provider 限流窗口外再次验证

### Draft-From-Brief Validation

brief:

- `7a87b5dd-11c7-4078-bdd4-05e8a7ae4f17`

draft:

- `13fe2240-6a6d-4faa-b927-2b06638a3a90`

结果：

- `[done]` `content_brief_id -> draft.generate` 已成功完成
- `[done]` 生成稿 metadata 中包含 `content_brief_id`、evidence document ids、citation URLs、`originality_guard=passed`
- `[issue]` 这条链当前的主要问题不是生成失败，而是上游 brief 主题漂移会把 draft 一并带偏

### Draft Review Findings

draft:

- `a8bae9f1-85d0-4acc-b0c3-dc37ff1e8a77`

结果：

- `[issue]` 首次 `draft.review.generate` 失败为 `MODEL_NETWORK_ERROR`
- `[issue]` 补充 provider retry 后，再次执行失败为 `MODEL_RATE_LIMITED`
- `[done]` 在限流窗口外重试后，`draft.review.generate` 已成功
- `[done]` reviewer 实际给出的结果为 `request_regenerate`
- `[issue]` `request_regenerate` 目前只会落一条 review 记录，没有对应 command / route 承接“重新生成”动作

### Review Action Validation

成功路径：

- `[done]` `approve` 已成功，draft `13fe2240-6a6d-4faa-b927-2b06638a3a90` 状态变为 `approved`
- `[done]` `reject` 已成功，draft `01cf371d-cb6a-4e1a-8ee4-6b12d62e3cea` 状态变为 `rejected`
- `[done]` 两条 review action 都正确写入 `draft_reviews`
- `[done]` 两条 review action 都正确写入 `audit_logs`
- `[done]` 两条 review action 都触发了后续 `orchestration.tick`

补充：

- `[done]` `request_regenerate` 已补执行入口，并能创建新的 `draft.generate` 任务

### Real Execution Validation

真实账号：

- `9508cc8e-a9c1-47ec-b221-83a1c65dee2a`

结果：

- `[done]` 真实 `publish job` 已执行成功，`external_post_id=2045817064318017834`
- `[done]` `draft / schedule / published_posts` 都已正确回写为 published 态
- `[done]` 真实 `reply proposal -> approve -> send` 已执行成功，`external_reply_id=2045820543593852988`
- `[done]` reply send 对应 `connector_request endpoint_code=post.reply`，平台返回 `201`

说明：

- 这轮 reply 验证使用了真实已发布 tweet 作为 reply target，但 thread 本身是本地构造的 smoke thread
- DM send 仍缺少真实 DM conversation id，因此暂未做“真实平台 conversation 上的 send”验收

### Source Fetch Execution Validation

source:

- `730e7643-0c6d-427c-b4ed-a02154364b85`
  - `https://x.com/sama`

结果：

- `[done]` 首次 fetch 导入 `98` 篇文档
- `[done]` 重复 fetch 导入 `0` 篇文档，去重正常
- `[done]` 新增正式 HTTP route：`POST /source-fetch-runs/:id/execute`
- `[done]` run `84a0665c-3434-47e7-8f15-bd036692fd66` 已通过该 route 从 `queued -> succeeded`

### Ops Cleanup Validation

结果：

- `[done]` 新增正式 HTTP route：`POST /ops/runtime-processes/cleanup`
- `[done]` 首次执行时，历史 stale heartbeat 已被清理，`/ops/health` 从 `stale_processes=12` 变为 `stale_processes=0`
- `[done]` 清理后 ops 状态从 `unhealthy` 改善为 `degraded`

当前剩余阻塞：

- `failed_jobs=36`
- `recent critical runtime events=6`
- 说明当前 ops 健康仍未到 `healthy`，但问题已经从“历史脏心跳污染”收敛到“真实失败队列和 critical events 待处理”
- `[done]` source-backed draft 的 `request_regenerate` 会保留 `content_brief_id` 上下文，不会退化成手动 topic 生稿

### Schedule Validation

draft:

- `dac90556-6c93-4a7c-ba1b-69d443bb1e2a`

schedule:

- `f23767fe-93f8-46df-a837-893286ce6621`

结果：

- `[done]` `schedule draft` 已成功
- `[done]` draft 状态已变为 `scheduled`
- `[done]` `publish_schedules` 已正确落库
- `[done]` `publish_schedule.created` audit log 已正确写入
- `[done]` `reschedule schedule` 已成功，schedule 和 draft 的 `scheduled_for` 会同步更新
- `[done]` `cancel schedule` 已成功，draft 会从 `scheduled` 回到 `approved`
- `[done]` queued publish job 存在时，直接 `cancel schedule` 会被保护分支拦截，避免悬空执行

### Publish Failure And Retry Validation

测试对象：

- schedule `2fedd76a-1cf1-489e-a28a-e3139fcb2915`
- publish job `030e1f3e-8716-43cc-ad1a-3e8d20494bde`

结果：

- `[done]` 未绑定账号执行 publish job 会明确失败，错误为 `valid account credential not found`
- `[done]` 失败后 `publish_job / publish_schedule / draft / alert` 会同时回写到失败状态
- `[done]` `retry publish job` 已补成会同时恢复 schedule 与 draft 状态，不再出现 `schedule=queued` 但 `draft=failed` 的分裂
- `[done]` `markPublishFailed` 已补幂等保护，避免旧脏状态下再次失败把 job 卡死在 `running`

### Real Publish Validation

draft:

- `13fe2240-6a6d-4faa-b927-2b06638a3a90`

schedule:

- `024c982c-1758-453c-b789-8781f61a50c1`

publish job:

- `477fdb04-69ec-4f1d-9266-a81beb6ca51f`

结果：

- `[done]` 用真实已绑定账号走通了 `edit -> schedule -> queue -> execute`
- `[done]` 真实发布成功，`external_post_id=2045817064318017834`
- `[done]` `publish_schedules`、`drafts`、`published_posts` 都已正确回写到 `published`
- `[done]` smoke 文本已通过真实外部平台发出，说明当前发布执行面可用

### Source Fetch Validation

source:

- `730e7643-0c6d-427c-b4ed-a02154364b85` (`https://x.com/sama`)

fetch runs:

- `e52c92d7-5225-41f6-b182-aef99a6b7616`
- `bc485653-5206-40ef-b639-b6019d5c144f`

结果：

- `[done]` twitter source fetch 已成功执行并导入 `98` 篇文档
- `[done]` source `last_fetched_at` 已正确更新
- `[done]` 文档样本的 `title / canonical_url / published_at` 合理
- `[done]` 第二次重复抓取 `imported_count=0`，去重逻辑成立

## Next Batch

下一批优先执行这 8 项：

1. `[todo]` 对真实帖子跑一次 reply proposal + send
2. `[todo]` 对真实 DM 线程跑一次 DM send
3. `[todo]` 检查 monitoring / audit / ops 是否完整记录本轮 publish/source 动作
4. `[todo]` 验证多租户 account/persona/draft 读写隔离
5. `[todo]` 评估 `retry publish job` 是否需要同时清理旧 critical alert
6. `[done]` 补前端入口，接入 `request_regenerate` 与 schedule 更新能力
7. `[todo]` source fetch retry 失败后恢复路径验证
8. `[done]` source fetch 已有正式 execute 入口，且 retry 现支持一键 `retry + execute`
