# SmartKOLs

AI 驱动的 Twitter KOL 矩阵管理平台 —— 从一个后台管理数百个 Twitter 账号，每个账号都有独立人格、独立互动行为、独立风控指标。

当前线上临时入口已经弃用，后续建议直接按 AWS 部署文档上线。

---

## 核心能力

**独立人格系统**
每个账号有自己的性别、国籍、年龄、兴趣、性格特征和写作风格。200 个账号就是 200 套独立的人格配置，AI 生成内容时以此为基础，避免矩阵推文同质化。

**互动自动化引擎**
不只是发推 —— 每个账号独立配置自动关注、自动转发、自动评论、自动回复粉丝。带延迟随机化（30 分钟~2 小时）和每日频率限制，模拟真人行为模式。

**内容生产线**
信息源聚合 → AI 生成推文草稿 → 人工审核（批准/编辑/拒绝/重新生成） → 内容日历排期 → 按计划发布。全流程可控，AI 是副驾，运营者是驾驶员。

**账号安全风控**
每个账号 0-100 健康评分（发帖频率 / 互动率 / 内容一致性 / 风险信号），绿/黄/红三档分级。异常时通知中心推送预警。

**矩阵级运营视图**
概览看板一眼看全局 · 内容日历展示整个矩阵的周排期 · 热门话题一键批量生成草稿 · Cmd+K 全局搜索 · 监控中心自动分类私信并报警到飞书/Telegram。

---

## 快速开始

```bash
# 安装依赖
npm install

# 检查本地配置
npm run doctor

# 启动后端 HTTP
npm run backend:dev:local

# 启动前端
npm run dev

# 如需跑真实异步执行链，再启动 worker
npm run backend:worker:local -- all

# 浏览器打开
open http://localhost:3000
```

完整本地说明见 [docs/local-run.md](docs/local-run.md)。

---

## 项目结构

```
src/
├── app/                    # 页面路由（Next.js App Router）
│   ├── dashboard/          # 概览看板
│   ├── accounts/           # 账号管理 + 账号详情（6 个子页）
│   ├── calendar/           # 内容日历
│   ├── drafts/             # 内容审核
│   ├── ai-bd/              # AI BD 触达工作台
│   ├── monitoring/         # 监控中心
│   ├── settings/           # 设置 + 团队
│   ├── api/                # Next Route Handlers 后端代理
│   ├── auth/               # X OAuth 回调
│   └── login/              # 登录页
├── components/
│   ├── ui/                 # 基础 UI 组件（button/input/dialog 等）
│   ├── layout/             # 导航、侧边栏、Cmd+K、通知中心
│   ├── accounts/           # 账号相关组件（健康分卡片等）
│   └── persona/            # 人格配置组件（表单、蒸馏、标签输入）
└── lib/                    # 后端 API 客户端、session、工具函数
```

---

## 技术栈

- **框架**：Next.js 14 (App Router) + TypeScript
- **样式**：Tailwind CSS（响应式，支持桌面端 + 移动端）
- **UI**：自建 shadcn 风格组件 + Radix UI
- **状态**：真实 backend 读写 + SQLite 持久化
- **部署**：本地开发可走 Next + backend + worker；正式环境建议走 AWS EC2 + Docker Compose + Caddy

---

## 当前状态

当前仓库已经不是纯前端演示项目。

- 前端通过 Next Route Handlers 代理真实 backend
- 本地登录使用真实 `user + workspace` session cookie
- 主要页面默认读取真实 SQLite 数据
- 长任务仍由独立 worker 执行，不在 HTTP 请求里偷偷跑完

当前主链是“前端 + backend + worker”的真实运行模式；历史前端假数据层已经移除。

---

## 文档

当前优先使用这些文档：

- [docs/local-run.md](docs/local-run.md)
  - 本地运行说明
- [docs/aws-deployment.md](docs/aws-deployment.md)
  - AWS 部署说明
- [docs/vercel-x-auth.md](docs/vercel-x-auth.md)
  - X OAuth 与 Vercel 回调说明
- [backend/docs/RUNBOOK.md](backend/docs/RUNBOOK.md)
  - 运行排障说明

---

## 部署

生产部署请直接看：

- [docs/aws-deployment.md](docs/aws-deployment.md)

这份文档覆盖：

- 前端正式公网域名
- backend 正式公网域名
- worker 常驻运行
- SQLite / artifacts 持久化
- 适合直接在 AWS EC2 落地
