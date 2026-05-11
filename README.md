# SmartKOLs

SmartKOLs 是一个面向 X / Twitter 账号矩阵运营的 AI 工作台，用来管理多账号人格、信息源、内容生产、审核排期、自动发布、互动触达和运行监控。

它不是纯前端 demo。当前代码包含前端、backend（后端服务）、worker（异步执行进程）和 SQLite（本地持久化数据库）运行链路，适合本地评审、功能演示和后续部署到 AWS。

## 核心能力

### 账号矩阵管理

- 批量管理 X / Twitter 账号
- 账号分组、健康状态、凭证状态、自动化 readiness（就绪度）检查
- 每个账号有独立人格、信息源、发帖策略和互动策略

### 人格与内容生产

- 账号 persona（人格画像）配置与蒸馏
- 信息源抓取、趋势提取、content brief（内容简报）生成
- brief 驱动 draft（草稿）生成，避免只靠主题空写
- X 280 字符限制校验与自动缩短
- AI 味检测和风格守卫，降低模板化内容

### 审核、排期、发布

- 草稿审核：批准、编辑、拒绝、重新生成
- 内容日历按时间窗口排期
- 发布任务由 worker 执行，不把长任务塞进 HTTP 请求
- 失败发布支持错误分类、重试和人工处理

### 互动与监控

- 评论、回复、转发、关注等互动策略建模
- 互动候选池和收件箱拉取任务
- 监控中心展示 worker、队列、失败项、操作队列和运行心跳
- 自动化链路具备显式失败状态，不依赖静默降级

### AI BD

- 新增 AI BD 工作台前端入口
- 用于后续围绕 LBank 已上线资产，监测 X 讨论并沉淀触达线索
- 当前是前端界面和流程骨架，真实触达执行接口后续接入

## 技术架构

```text
Next.js App Router
  ├─ 页面与控制台 UI
  ├─ Route Handlers 代理后端 API
  └─ X OAuth 回调入口

Backend
  ├─ HTTP router
  ├─ 账号、人格、信息源、草稿、排期、互动、监控等模块
  ├─ SQLite repositories / read models
  └─ model gateway / connector-x / source fetch adapters

Worker
  ├─ autopost 执行
  ├─ source fetch 调度
  ├─ trend refresh
  ├─ publish jobs
  └─ engagement automation
```

## 快速开始

环境要求：

- Node.js 20+
- npm

安装依赖：

```bash
npm ci
```

检查配置：

```bash
npm run doctor
```

启动 backend：

```bash
npm run backend:dev:local
```

另开一个终端启动前端：

```bash
npm run dev
```

需要跑自动化链路时，再启动 worker：

```bash
npm run backend:worker:local -- all
```

浏览器打开：

```bash
open http://localhost:3000
```

更完整的本地运行说明见 [docs/local-run.md](docs/local-run.md)。

## 常用命令

```bash
# 前端生产构建
npm run build

# backend TypeScript 类型检查
npm run backend:typecheck

# backend 测试
npm run test:backend

# 当前链路 smoke test
npm run smoke:current

# 路由能力 smoke test
npm run smoke:routes

# 自动化端到端 smoke test
npm run smoke:e2e
```

## 项目结构

```text
src/
  app/                    Next.js 页面、API 代理、登录与 OAuth 回调
  components/             UI、布局、账号、人设相关组件
  lib/                    前端 API client、session、工具函数

backend/
  src/app/                启动、HTTP router、worker runner
  src/contracts/          API / job contract 类型
  src/core/               错误、ID、时间、校验等基础能力
  src/infrastructure/     SQLite、artifact store、外部依赖适配
  src/modules/            业务模块

docs/                     本地运行、部署、X OAuth 文档
deploy/aws/               AWS + Docker Compose + Caddy 部署配置
scripts/                  本地启动、doctor、smoke test 脚本
```

## 环境配置

仓库只提交示例环境文件，不提交真实密钥：

- `.env.local.example`
- `.env.backend-http.example`
- `.env.backend-worker.example`
- `.env.openai.example`
- `.env.zhipu.example`
- `deploy/aws/.env.example`

本地运行时按需复制为实际 `.env` 文件。真实 `.env` 已被 `.gitignore` 排除。

## 当前验证状态

最近一次合并到 `main` 前已通过：

```bash
npm run build
npm run backend:typecheck
npm run test:backend
```

后端测试当前为 101 个用例全通过。

## 已知事项

- `next build` 仍有非阻塞 lint 警告，主要是部分 `<img>` 可迁移到 `next/image`，以及一个 `useEffect` 依赖提示。
- `npm audit` 仍提示 Next.js 14 相关安全公告。自动非破坏性修复已经执行；彻底消除需要强升 Next.js 到 16，属于破坏性升级，建议单独开分支处理。
- AI BD 当前只完成前端工作台和信息架构，真实触达执行链路后续接入。

## 部署

生产部署建议使用：

- AWS EC2
- Docker Compose
- Caddy
- SQLite 持久化目录
- backend HTTP 进程 + worker 常驻进程

部署说明见 [docs/aws-deployment.md](docs/aws-deployment.md)。

X OAuth / Vercel 回调说明见 [docs/vercel-x-auth.md](docs/vercel-x-auth.md)。

运行排障说明见 [backend/docs/RUNBOOK.md](backend/docs/RUNBOOK.md)。
