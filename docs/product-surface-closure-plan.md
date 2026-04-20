# Product Surface Closure Plan

日期：`2026-04-17`

这份文档的目的不是复述已有进展，而是把 SmartKOLs 从“前端 Demo + 部分真实执行链”收成“产品面与执行面一致”的系统。

它补充 [backend/docs/ROADMAP.md](../backend/docs/ROADMAP.md) 的后端视角，重点回答三件事：

- 现在前端预设了哪些能力
- 后端真实实现到了哪里
- 应该按什么优先级和依赖顺序把产品面收口

关于“外部信息源 -> brief -> draft -> publish”这条核心内容链的专项设计，见
[source-backed-content-pipeline-plan.md](./source-backed-content-pipeline-plan.md)。

## 1. 当前判断

系统现在的真实状态应该定义为：

- `Execution Plane Mostly Real`
  - workspace / account / credential / profile sync / sources / trends / draft pipeline / publish pipeline / monitoring / audit / model requests / connector requests / persona distill 已有真实后端
- `Product Surface Mixed`
  - 真正接到后端的前端页面很少
  - 大多数页面仍然建立在 `useMockStore()` 之上
- `Operator Surface Incomplete`
  - 底层执行与排障数据已经存在
  - 但页面、查询模型、导航入口、聚合读模型还没有补齐

一句话结论：

- 现在最该做的不是继续补零散功能，而是把产品面和真实领域模型对齐

## 2. 第一性原则

后续所有架构和实现都必须服从这些原则。

### 2.1 单一事实来源

- 每一个产品概念只能有一个真实领域模型
- 前端不得维护与后端平行、但语义不一致的“演示版数据模型”
- 页面展示的数据必须来自持久化后的后端状态，或明确标注的本地临时输入态

### 2.2 不做假动作

- 不做静默处理
- 不做默认 fallback
- 不做隐式降级
- 不用 mock 数据伪装真实成功
- 不把 provider/platform 失败包成“看起来没问题”

如果依赖不存在、配置错误、上游失败、权限不足，就必须显式失败，并暴露结构化错误。

### 2.3 查询模型服务页面，不让页面自己拼系统

- 复杂页面应由后端提供页面级 read model
- 前端不能通过一组零散底层接口自己拼接出首页、监控页、日历页
- 页面首屏不能依赖大规模客户端 fan-out / N+1 请求

### 2.4 写路径严格映射领域状态机

- UI 状态必须对应真实领域状态
- 不允许出现前端自造状态名，与后端状态机脱节
- 长任务必须仍然通过 queue + worker 执行
- HTTP 只负责创建任务、读取状态、显式 retry

### 2.5 性能来自边界清晰，而不是偷偷降级

- 分页、过滤、排序、聚合必须在后端完成
- 默认不加载大对象，不默认加载 trace、documents、原始 artifacts
- 不靠“失败时悄悄少返回一点”来换稳定性

### 2.6 先 contract，后 UI

- 先定义 API contract / query model / state machine，再接页面
- 前端组件不得先发明字段，再倒逼后端兼容

## 3. 当前产品面盘点

### 3.1 页面级能力矩阵

| 页面 / 能力 | 前端状态 | 后端状态 | 当前判断 |
| --- | --- | --- | --- |
| `/login` | real | real | 已接真，本地 cookie session + 真实 user/workspace membership |
| `/dashboard` | real | real | 已接真，展示真实 overview / trends / notifications |
| `/accounts` | real | real | 已接真 |
| `/accounts/[id]` 顶部资料 | real | real | 已接真 |
| `/accounts/[id]/persona` | real | real | 已接真 |
| `/accounts/[id]/sources` | real | real | 已接真，支持 list/add/delete/fetch/retry/documents/runs |
| `/accounts/[id]/autopost` | real | real | 已按真实 autopost policy 接真 |
| `/accounts/[id]/engagement` | real | real | 已接真，按真实 inbox/thread/proposal/policy 模型运行 |
| `/accounts/[id]/preview` | real | real | 已接真，作为真实 draft workbench 使用 |
| `/accounts/[id]/analytics` | real | real | 已接真，且只展示真实可追溯聚合指标 |
| `/drafts` | real | real | 已接真，基于真实 drafts list query / review / edit / schedule |
| `/calendar` | real | real | 已接真，展示真实 publish schedules / jobs |
| `/monitoring` | real | real | 已接真，含 queue/trace/channels operator surface |
| `/settings` | real | real | 已接真，workspace/team/session 都走真实 persistence |
| `/auth/x/start` | real | real | 已接真 |
| `/auth/x/callback` | real | real | 已接真 |

### 3.2 全局组件和辅助能力

| 组件 / 能力 | 前端状态 | 后端状态 | 当前判断 |
| --- | --- | --- | --- |
| 侧栏账号分组 / 草稿计数 | real | real | 已接真，走统一 app chrome overview read model |
| 通知铃铛 | real | real | 已接真，直接消费真实 chrome overview 通知流 |
| Command Palette | real | real | 已接真，走 backend global search query |
| CSV 批量导入 | real | real | 已接真，严格校验并进入真实批量创建链 |
| Persona Template | real | real | 已接真，支持模板创建、批量应用、从 persona 保存模板 |
| 删除账号 | real | real | 已接真，显式受 queued/running 任务安全门约束 |

### 3.3 当前仍以底层 route 为主的能力

- operator/debug route
  - `connector-requests / model-requests / audit-logs / ops/* / agent-runs/*` 仍然既服务 UI，也服务 smoke/debug
- demo surface
  - demo 路径仍保留 `useMockStore()`，但已经不再污染 live surface

### 3.4 当前最关键的结构性问题

- live surface 已基本收口，当前重点不再是“去 mock”，而是继续减少残余局部客户端 fan-out
- `selected workspace` 已回收到真实 session，不再允许 dashboard / calendar / monitoring / settings 各自维护局部 workspace 真相
- `chrome / dashboard / monitoring / account header / accounts control plane` 都已有统一 read model，剩余工作更多集中在局部组件和 operator backlog 清理
- monitoring 的 queue surface 现在已经区分“历史失败记录”和“当前仍可操作的 failed backlog”，批量 retry 只命中 workspace 级可操作失败项
- operator 与 product route 已经并存，后续要避免继续让 debug route 反向成为产品 contract
- 生产运维底座已落地，接下来更多是 failed queue 清理、组件收敛和长期硬化，而不是再补假功能

## 4. 目标架构

目标不是“把所有页面都改成请求几个接口”，而是形成清晰分层。

### 4.1 分层要求

#### Frontend

- 只负责渲染状态、提交命令、轮询或订阅任务结果
- 不维护平行业务真相
- 只消费 typed contract

#### Next API Proxy

- 作为浏览器与 backend 的薄适配层
- 不发明业务逻辑
- 统一认证、错误转发、request id 透传

#### Backend Command Layer

- 负责状态迁移
- 长任务只创建 job / task，不直接执行重活

#### Backend Query Layer

- 为页面提供稳定的 read model
- 聚合、分页、过滤、排序在这里完成

#### Workers

- 独立执行 draft / publish / source fetch / inbox / reply 等长任务
- 显式 lease / retry / dead-letter

### 4.2 前端到后端的正确关系

- 页面不该绕过领域模型直接拼“自己理解的产品”
- 页面需要的聚合视图，应由 query API 显式提供
- 如果现有后端只有命令、没有页面所需读模型，先补 query，再接 UI

## 5. 不允许继续做的事

- 不再扩张 `useMockStore()` 的覆盖面
- 不再新增只存在于前端的产品字段和状态
- 不再在后端失败时回退到 demo 数据
- 不再让页面通过大量零散接口自己拼首页、日历页、监控页
- 不再用“默认值”掩盖未配置、未授权、未抓取、未生成的真实状态
- 不再让 HTTP 线程顺手执行长任务

## 6. 执行优先级

### P0: 真相收口

目标：

- 停止产品面继续偏离真实领域
- 建立统一 contract 和 query-first 的页面接入方式

完成定义：

- 明确哪些页面已经 live，哪些页面仍是 demo
- Next proxy 扩到已有真实后端路由
- 新接页面不得依赖 `useMockStore()`
- 前端 state 与后端 state machine 名称对齐

### P1: 先把已有后端能力接到前端

目标：

- 优先兑现后端已经具备的价值

完成定义：

- sources 页面接真
- drafts 页面接真
- monitoring 页面接真
- dashboard 页面接真
- 全局通知和计数接真

### P2: 补足页面所需的读模型和控制面

目标：

- 给页面补齐必要的 query / list / explorer，而不是继续让 UI 假装完整
- 让 drafts / preview / sources 后续演进服从 source-backed content pipeline 的统一模型

完成定义：

- drafts list query
- schedules calendar/range query
- engagement inbox list / thread list / message list query
- source pause/resume API
- queue / dead-letter / trace explorer queries

### P3: 补齐真正缺失的产品域

目标：

- 把 UI 里已经预设但后端尚未建模的能力落地成真实领域

完成定义：

- account groups
- persona templates
- CSV bulk import
- autopost policy
- alert channel config
- account delete

### P4: 多用户、设置、分析、生产运维

目标：

- 把系统从单机可跑推进到多人长期可运营

完成定义：

- auth / session / team / settings
- analytics domain 与 query
- secret / vault
- structured logs
- metrics
- worker supervision
- operator runbook

## 7. 依赖顺序

下面这个顺序不能打乱。

1. 先冻结产品真相边界，再接页面
2. 先接已有真实后端能力，再新增产品域
3. 先补页面所需 query model，再做复杂页面
4. 先把核心内容闭环收口，再做 analytics 和 team/settings
5. 先有 operator surface，再做 production ops 硬化

原因：

- 没有第 1 步，系统会继续分裂成“前端想象中的产品”和“后端真实系统”
- 没有第 2 步，会一直新增模型而不兑现已有执行能力
- 没有第 3 步，页面只能继续 fan-out 拼装，性能和一致性都会失控
- 没有第 5 步，生产运维会建立在不完整的操作面上

## 8. 明确 Todo

### 8.1 P0

| ID | 任务 | 依赖 | 完成定义 |
| --- | --- | --- | --- |
| `T0-1` | 把“live 页面不得依赖 mock store”写成工程约束，并停止继续扩张 mock 路径 | 无 | 新页面和已切真页面不再读取 `useMockStore()` |
| `T0-2` | 扩展 Next backend proxy，覆盖现有真实后端路由 | `T0-1` | sources / drafts / monitoring / trends / notifications / schedules / engagement 所需代理具备 |
| `T0-3` | 统一前端 contract 消费层，禁止组件私自定义平行业务类型 | `T0-2` | 页面只依赖 contract 类型和 page query 类型 |
| `T0-4` | 把根级 `MockStoreProvider` 从 live 路径中移除或隔离 | `T0-1` `T0-3` | live 页面不再受全局 demo 状态污染 |

### 8.2 P1

| ID | 任务 | 依赖 | 完成定义 |
| --- | --- | --- | --- |
| `T1-1` | 接通 sources 页面 | `T0-2` `T0-3` | 能真实 list/add/delete/fetch/retry/list documents/list runs |
| `T1-2` | 接通 dashboard 页面 | `T0-2` `T0-3` | 首页展示真实 accounts / trends / notifications，不再显示 demo 指标 |
| `T1-3` | 接通 monitoring 页面第一版 | `T0-2` `T0-3` | 能真实展示 monitoring feed / audit logs / model requests / connector requests |
| `T1-4` | 已完成: 接通全局通知铃铛、侧栏计数和 command palette 搜索 | `T1-2` `T1-3` | 全局 UI 数字与搜索结果都来自真实 query |

### 8.3 P2

| ID | 任务 | 依赖 | 完成定义 |
| --- | --- | --- | --- |
| `T2-1` | 增加 drafts list query 和对应页面 read model | `T0-2` | `/drafts` 可真实浏览、筛选、进入 draft detail |
| `T2-2` | 增加 schedule range query / calendar projection | `T2-1` | `/calendar` 可真实展示已排期内容 |
| `T2-3` | 增加 engagement inbox list / thread list / message list query | `T0-2` | `/engagement` 有真实列表基础，而不是只有单 thread 详情 |
| `T2-4` | 补 source pause/resume API，而不是只支持 delete/fetch | `T1-1` | sources 页面开关映射真实状态迁移 |
| `T2-5` | 增加 queue / dead-letter / trace explorer query | `T1-3` | operator 可在 UI 内完成排障，不再绕 SQLite |
| `T2-6` | 用真实 draft detail / review / schedule 状态接通 preview 页面 | `T2-1` `T2-2` | preview 不再是独立 mock 面板 |

### 8.4 P3

| ID | 任务 | 依赖 | 完成定义 |
| --- | --- | --- | --- |
| `T3-1` | 已完成: 落地 account groups domain / query / command / router | `T0-3` | 账号分组不再是 UI 假概念 |
| `T3-2` | 已完成: 落地 persona templates domain / repo / query / command / router | `T0-3` | PersonaTemplateModal 对应真实模板系统 |
| `T3-3` | 已完成: 落地 CSV bulk import | `T3-1` | 可批量导入账号并进入真实创建链 |
| `T3-4` | 已完成: 重新定义 autopost 产品模型，并落地真实 policy domain/API | `T0-3` | `/autopost` 只编辑执行器真实需要的 policy 字段 |
| `T3-5` | 已完成: 重新定义 monitoring alert channel config，并落地真实 domain/API | `T1-3` | Lark/Telegram 等报警配置可持久化，secret 不回显 |
| `T3-6` | 已完成: 增加 account delete 命令和安全约束 | `T3-1` | 删除语义清晰、可审计、无脏引用 |

### 8.5 P4

| ID | 任务 | 依赖 | 完成定义 |
| --- | --- | --- | --- |
| `T4-1` | 已完成: 落地真实 auth / session / team / settings | `T0-4` | `/login` `/settings` 不再是 demo |
| `T4-2` | 已完成: 设计并落地 analytics domain 与 query | `T1-2` `T2-2` | `/analytics` 展示真实聚合指标 |
| `T4-3` | 已完成: 补 secret / vault / structured logs / metrics / worker supervision / runbook | `T1-3` `T2-5` | 系统具备长期运行条件 |

## 9. 推荐执行顺序

最短正确路径应该固定为：

1. `T0-1` 到 `T0-4`
2. `T1-1`
3. `T2-1` 与 `T2-6`
4. `T2-2`
5. `T1-3` 与 `T2-5`
6. `T2-3`
7. `T1-2` 与 `T1-4`
8. `T3-1` `T3-2` `T3-3`
9. `T3-4` `T3-5` `T3-6`
10. `T4-1` `T4-2` `T4-3`

这样排的原因：

- `sources` 是后端最完整、最容易兑现的页面之一，适合作为去 mock 的第一块样板
- `drafts` 和 `calendar` 决定内容执行链是否能在产品面闭环
- `monitoring` 和 `queue/trace explorer` 决定系统是否可运维
- `groups/templates/import` 应该建立在真实账户与 persona 体系之上
- `autopost / analytics / settings` 都不应先于核心执行面闭环

## 10. Definition Of Done

当且仅当满足下面这些条件，才算产品面真正收口：

- 根路径上的 live 页面不再依赖 `useMockStore()`
- 页面展示的状态都能追溯到真实后端实体或显式 query model
- 没有任何“后端失败 -> 前端自动回退 demo 数据”的路径
- 核心内容链能在 UI 中完整走通：
  - account
  - persona
  - source
  - draft
  - review
  - schedule
  - publish
  - monitoring
- operator 不需要直接查 SQLite 才能定位常见问题
- 新增页面开发默认先补 contract 与 query model，而不是先写 mock UI

## 11. 下一步建议

现在不要继续分散补页面。

下一步应该直接做：

1. `T0-1` 到 `T0-4`
2. `T1-1`
3. `T2-1`

也就是：

- 先把 live 路径从 mock store 里拔出来
- 先接通 sources
- 再补 drafts list 和真实 drafts 页面

这是当前性价比最高、对系统收口最有决定性的路径。
