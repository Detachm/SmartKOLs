# Source-Backed Content Pipeline Plan

日期：`2026-04-17`

实现状态：`2026-04-19`

- `C0` 已完成
- `C1` 已完成
- `C2` 已完成
- `C3` 已完成
- `C4` 已完成

当前代码已具备：

- evidence-backed brief / draft 主链
- explicit source scope 与 selected documents 两种显式证据输入
- brief evidence persistence / quality summary / diversity signals
- source watchlists
- recurring brief plans
- campaign-level topic queues
- recurring plan 失败状态持久化与 worker 启动重建

补充状态：`2026-04-19`

- autopost 已具备真实执行域
- 支持 policy scheduling / run history / worker restart reconciliation
- 支持 brief -> draft -> auto-approve -> auto-schedule -> auto-queue-publish 的显式编排
- manual review policy 会显式停在 `awaiting_review`
- source-backed originality guard 已升级为多维判定
  - char overlap
  - token n-gram overlap
  - reused fragment ratio / max fragment length

这份文档定义 SmartKOLs 的核心能力之一：

- 从外部信息源抓取内容
- 归并成可操作的 topic / angle / evidence
- 基于账号 persona 生成原创社媒稿件
- 显式保留来源依据、生成理由和排障链路

这里说的“信息源”不局限于资讯聚合站，也包括：

- `rss`
- `website`
- `substack`
- `youtube`
- `twitter`
- `telegram`

但这份文档的重点是“外部内容 -> 自有稿件”的内容平面，而不是 connector 覆盖率本身。

## 1. 当前判断

当前系统已经具备这条链的基础执行能力，但还没有达到“核心功能已收口”的标准。

### 1.1 已经存在的真实能力

- source fetch adapter 已覆盖 `rss / website / substack / youtube / twitter / telegram`
- source documents 会真实入库
- trends 可以从 recent documents 做基础聚类
- writer agent 可以读取 `persona + trend + recent_documents` 生成 draft
- draft / review / schedule / publish 主链已真实存在

### 1.2 还不够的地方

当前实现更像：

- “基于最近几条 source documents 辅助写一条推文”

而不是：

- “围绕某个 topic / signal / source bundle 做有依据、有角度、有约束的内容改写系统”

关键缺口是：

- 没有显式的 `brief / evidence bundle` 领域对象
- writer 当前读取的是 workspace 级最近 documents，而不是针对 topic、source scope、account intent 选出的证据集
- 没有把 citation / evidence usage 持久化到 draft version
- trends 目前只是标题词聚类，不足以承担编辑层 topic selection
- 没有“抓取 -> 选题 -> brief -> 出稿”的一体化 operator surface

## 2. 第一性原则

这条能力必须严格服从已有工程原则，并再补充三条内容平面专属约束。

### 2.1 证据先于写作

- source-backed draft 必须先有 evidence，再有 generation
- 不允许 writer 在“没有选定证据”的情况下假装自己基于资讯写作
- 当 evidence 不足时，必须显式失败，而不是偷偷退化成“只按 topic 空写”

### 2.2 来源必须可追

- 每一条 source-backed draft 都必须能追溯到具体 source documents
- operator 必须能看到：
  - 用了哪些 documents
  - 每个 document 的 canonical URL
  - brief 如何概括这些 document
  - draft 为什么这样写

### 2.3 原创性不能靠口头承诺

- 系统不能把单篇文章简单改写后当作“原创”
- 必须显式控制：
  - angle
  - audience
  - claim selection
  - persona alignment
  - evidence coverage
- 后续应补 similarity / duplication guard，但在 guard 没落地前也不能伪装这件事已经存在

## 3. 目标能力定义

### 3.1 用户真正要的能力

用户要的不是“保存一堆 source”，而是下面这个闭环：

1. 配好某个账号关注的内容源
2. 系统抓取并归档外部内容
3. 系统识别值得写的主题和角度
4. 系统把若干 source documents 收敛成一个可审查的 brief
5. 系统基于 persona 和 brief 生成原创 draft
6. operator 可以审核、修改、排期、发布

### 3.2 最小可用产品形态

最小正确版本应该支持三种入口：

1. `从 trend 生成`
   - 先刷新 trends，再针对某个 trend 生成 brief 和 draft
2. `从选定 documents 生成`
   - operator 手动勾选若干 source documents，直接出 brief 和 draft
3. `从 source scope 生成`
   - 指定 account 当前 active sources 或某类 source，然后系统自动选择最近有效 documents 出 brief

### 3.3 明确非目标

下面这些不是当前阶段的目标：

- 自动生成长篇博客 CMS
- 悄悄替用户做事实核验后不给出依据
- 从单篇外文资讯机械翻译改写成长文
- 用“模型说它参考了 sources”替代真实 evidence persistence

## 4. 当前实现与目标实现的差距

### 4.1 当前 source 侧

已有：

- source fetch
- document normalization
- 去重
- raw artifact persistence

缺少：

- source scope 到 content intent 的映射
- document relevance ranking
- source pause/resume
- source quality / trust / freshness signal

### 4.2 当前 trend 侧

已有：

- 从 recent documents 按标题词做基础 topic cluster

缺少：

- 多文档摘要
- 事件去重
- topic canonicalization
- novelty / urgency / source diversity 评分

### 4.3 当前 writer 侧

已有：

- persona
- optional trend
- recent documents
- draft generation

缺少：

- brief object
- evidence bundle
- citation persistence
- source-scoped generation
- generation mode distinction
- anti-copy / overlap guard

## 5. 目标架构

这条核心能力要拆成四层，不能继续让 writer 直接吃“最近 5 条 documents”。

### 5.1 Ingestion Plane

职责：

- 抓取 source
- 规范化成 document
- 去重
- 持久化 raw artifacts

核心实体：

- `source`
- `source_fetch_run`
- `source_document`

### 5.2 Signal Plane

职责：

- 从 documents 中提取 topic candidates
- 聚类、排序、标记时效性
- 为后续 brief generation 提供候选集合

核心实体：

- `trend`
- 后续可选的 `trend_document_link`

### 5.3 Editorial Plane

职责：

- 从 trend 或 documents 生成可审查的 brief
- 把“写什么、基于什么、以什么角度写”显式化

这里需要新增真正的领域对象：

- `content_brief`
- `content_brief_evidence_item`

`content_brief` 应至少包含：

- `id`
- `workspace_id`
- `account_id`
- `status`
  - `queued`
  - `running`
  - `ready`
  - `failed`
  - `archived`
- `generation_mode`
  - `from_trend`
  - `from_documents`
  - `from_source_scope`
- `topic`
- `angle`
- `audience`
- `outline`
- `source_scope`
- `generated_by_run_id`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`

`content_brief_evidence_item` 应至少包含：

- `brief_id`
- `source_document_id`
- `rank`
- `usage_reason`
- `key_claims`
- `quoted_excerpt`

### 5.4 Writing Plane

职责：

- 基于 `persona + content_brief` 生成 draft
- 持久化 generation evidence
- 审核、排期、发布

这里 writer 的主输入应从：

- `topic + optional trend + workspace recent_documents`

升级为：

- `content_brief_id`

source-backed draft 的真实依赖应该是：

- `persona`
- `content_brief`
- `brief evidence items`
- 可选的 trend context

而不是把“最近 documents”直接塞给 writer 让它自己猜。

## 6. 推荐的数据模型调整

### 6.1 保留现有 drafts 领域

`draft` / `draft_version` / `draft_review` / `publish_schedule` 不需要推倒重来。

需要做的是补齐 metadata，而不是再造一套内容领域。

### 6.2 扩展 draft version metadata

source-backed draft 的 version metadata 至少应记录：

- `generation_mode`
- `content_brief_id`
- `evidence_document_ids`
- `citation_urls`
- `rationale`
- `provider_request_id`
- `trend_id`

### 6.3 不要把 brief 塞回 trend

`trend` 是 signal，不是 editorial object。

不允许：

- 在 `trend` 上硬塞 brief 文本
- 让 `trend` 同时承担 topic cluster 和 operator-facing brief

原因：

- 一个 trend 可以对应多个不同账号、不同 angle、不同 audience 的 brief
- trend 是共享信号，brief 是账号上下文化后的编辑对象

## 7. 推荐 API / 命令模型

### 7.1 新增命令

- `POST /accounts/:id/content-briefs/generate`
  - 输入：
    - `trend_id?`
    - `source_document_ids?`
    - `source_scope?`
    - `topic_hint?`
    - `audience?`
    - `angle_hint?`
- `POST /content-briefs/:id/regenerate`
- `POST /content-briefs/:id/archive`
- `POST /content-briefs/:id/drafts/generate`

### 7.2 新增查询

- `GET /accounts/:id/content-briefs`
- `GET /content-briefs/:id`
- `GET /content-briefs/:id/evidence`
- `GET /accounts/:id/source-documents`
  - 支持 source / type / date range / query / status filtering
- `GET /workspaces/:id/trends`
  - 后续补 trend -> evidence 聚合 read model

### 7.3 现有命令的收口要求

现有 `POST /drafts/generate` 不应该消失，但应明确分成两种模式：

- `manual topic draft`
- `source-backed draft`

对于 source-backed draft：

- 不允许只传 `topic`
- 必须要求 `content_brief_id`

## 8. 页面与操作面

### 8.1 Sources 页面

职责：

- 管理 source
- 查看 fetch runs
- 查看 documents
- 手动触发 fetch / retry

它不是最终内容编辑面。

### 8.2 Dashboard / Trends

职责：

- 展示值得写的趋势与主题
- 提供“从 trend 生成 brief”的入口

### 8.3 新增 Brief Workbench

建议新增独立页面或嵌入 preview 前置步骤：

- 查看 brief 状态
- 查看 topic / angle / audience
- 查看 evidence documents
- 决定是否生成 draft

没有 brief workbench，operator 就无法判断 draft 是否真的基于 sources。

### 8.4 Preview 页面

职责应该收敛为：

- 基于已有 brief 的 draft workbench
- review / edit / approve / schedule / queue publish

而不是既当 brief 页面，又当 draft 页面。

## 9. 执行语义

这条链必须继续遵守 queue + worker。

### 9.1 长任务

以下步骤都必须是异步任务：

- source fetch
- trend refresh
- content brief generate
- source-backed draft generate
- review generate

### 9.2 错误语义

不能静默吞掉这些失败：

- source fetch upstream failure
- evidence 不足
- brief generation invalid output
- writer invalid output
- citation persistence failure

失败必须显式落到：

- task / run status
- audit logs
- alerts
- operator-readable error message

## 10. 当前实现必须修正的关键点

这是最重要的一节。

### 10.1 Writer 不应再直接读取 workspace 最近 5 条 documents

当前做法的问题：

- 不按 account source scope 过滤
- 不按 trend/topic 过滤
- 不按 relevance 排序
- 可能把无关 documents 混进生成上下文

这会直接伤害：

- 质量
- 可解释性
- 可控性

### 10.2 Source-backed draft 必须有 evidence persistence

当前 draft metadata 还不够表达“这条稿件基于哪些 sources 写出来”。

如果不补：

- operator 无法追责
- review 无法验证是否偏题
- 后续 analytics 也无法判断哪些 sources 真正产生价值

### 10.3 Trend 不能承担 brief

trend 应继续是候选信号。

真正面向写作和审核的对象应该是 `content_brief`。

### 10.4 页面必须显式区分 manual draft 和 source-backed draft

否则产品会继续把两条语义不同的链混在一起：

- 给一个 topic 让模型空写
- 基于 evidence bundle 写

这两者的成功条件、错误语义、operator 预期都不同。

## 11. Todo 与优先级

### C0: Contract Freeze

目标：

- 定义 source-backed content plane 的真实 contract

Todo：

- 定义 `content_brief` 与 `content_brief_evidence_item`
- 定义 source-backed draft metadata schema
- 定义 `manual draft` 与 `source-backed draft` 的命令边界

依赖：

- 无

### C1: Evidence-Backed Generation MVP

目标：

- 让 source-backed draft 真正建立在 evidence bundle 上

Todo：

- 新增 brief domain / repository / router / task
- 新增 brief generate 命令
- writer 改为按 `content_brief_id` 生成
- version metadata 持久化 citation / evidence ids
- preview 页面切到“brief -> draft”两段式

依赖：

- `C0`

### C2: Operator Surface

目标：

- 让内容运营能看见并控制这条链

Todo：

- sources 页面增加 document filter / selection 能力
- dashboard / trend 页面增加“从 trend 生成 brief”
- 新增 brief list / detail / evidence read model
- monitoring 页面补 brief / writer / review trace 聚合

依赖：

- `C1`

### C3: Relevance And Originality Hardening

目标：

- 提升内容质量和原创性控制

Todo：

- relevance ranking
- source diversity signal
- duplicate / overlap guard
- claim extraction / evidence coverage summary

依赖：

- `C1`

### C4: Advanced Editorial Modes

目标：

- 支持更复杂的内容运营场景

Todo：

- source collections / watchlists
- recurring briefs
- campaign-level topic queues
- account-level source preference model

依赖：

- `C2`

## 12. 推荐执行顺序

最短正确路径：

1. `C0`
2. `C1`
3. `C2`
4. `C3`
5. `C4`

这个顺序不能反过来。

原因：

- 没有 `C0`，后续实现会继续漂移
- 没有 `C1`，系统仍然只是“recent documents 辅助写作”
- 没有 `C2`，operator 看不见 evidence 和 brief
- 没有 `C3`，内容质量和原创性不可控

## 13. Definition Of Done

当且仅当满足下面条件，才算这条核心功能真正完成：

- source-backed draft 有独立的 `content_brief`
- 每条 source-backed draft 都能追溯到具体 evidence documents
- writer 不再直接读取 workspace 最近 documents 作为主输入
- operator 能在 UI 里看见 brief、evidence、draft、review、publish 全链
- source 不足、evidence 不足、brief 失败、writer 失败都会显式失败
- 没有任何“没有 evidence 但看起来像 source-backed generation 成功”的路径
