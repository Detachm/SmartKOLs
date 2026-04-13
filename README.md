# SmartKOLs

AI 驱动的 Twitter KOL 矩阵管理平台 —— 从一个后台管理数百个 Twitter 账号，每个账号都有独立人格、独立互动行为、独立风控指标。

**Demo**：https://smartkols.vercel.app/

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

# 启动开发服务器
npm run dev

# 浏览器打开
open http://localhost:3000
```

---

## 项目结构

```
src/
├── app/                    # 页面路由（Next.js App Router）
│   ├── dashboard/          # 概览看板
│   ├── accounts/           # 账号管理 + 账号详情（6 个子页）
│   ├── calendar/           # 内容日历
│   ├── drafts/             # 内容审核
│   ├── monitoring/         # 监控中心
│   ├── settings/           # 设置 + 团队
│   └── login/              # 登录页
├── components/
│   ├── ui/                 # 基础 UI 组件（button/input/dialog 等）
│   ├── layout/             # 导航、侧边栏、Cmd+K、通知中心
│   ├── accounts/           # 账号相关组件（健康分卡片等）
│   ├── persona/            # 人格配置组件（表单、蒸馏、标签输入）
│   └── tour/               # 产品导览组件
├── data/                   # Mock 数据（JSON）
└── lib/                    # 状态管理、工具函数、导览步骤定义
```

---

## 技术栈

- **框架**：Next.js 14 (App Router) + TypeScript
- **样式**：Tailwind CSS（响应式，支持桌面端 + 移动端）
- **UI**：自建 shadcn 风格组件 + Radix UI
- **状态**：React Context + localStorage 伪持久化
- **部署**：Vercel（push 自动构建）

---

## 当前状态

这是一个前端 Demo 原型（PRD 中的 M0 里程碑）。所有数据为 Mock，AI 功能为模拟。用于验证产品逻辑与交互流程。

Demo 包含：
- 12 个核心页面
- 200 个 Mock 账号，5 个分组
- 30 条 AI 草稿，50 条互动日志
- 首次访问的 12 步产品导览
- 所有操作 localStorage 持久化（刷新不丢失）

---

## 文档

| 文档 | 说明 |
|---|---|
| [PRD.md](PRD.md) | 产品需求文档 —— 产品定位、用户场景、功能定义、商业模式、里程碑 |
| [DEMO_TECHNICAL.md](DEMO_TECHNICAL.md) | Demo 技术文档 —— 技术栈、目录结构、数据模型、关键实现细节 |

---

## 部署

当前通过 Vercel 自动部署：

```bash
# 推送到 main 分支即触发自动构建
git push origin main
```

线上地址：https://smartkols.vercel.app/
