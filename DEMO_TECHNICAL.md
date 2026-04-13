# SmartKOLs 技术文档

**版本**：v1.0
**更新日期**：2026-04-13
**对应 PRD**：PRD v1.0

---

## 1. 当前状态

当前版本为**前端 Demo 原型**（M0 里程碑），所有数据为 Mock，部署在 Vercel。
- **线上地址**：https://smartkols.vercel.app/
- **代码仓库**：https://github.com/yb2999/SmartKOLs

---

## 2. 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | Next.js 14 (App Router) + TypeScript | 文件路由、Server/Client Components 混合 |
| 样式 | Tailwind CSS | 自定义 hex token（不用 CSS 变量），响应式断点 768px (`md`) |
| UI 组件 | 自建 shadcn 风格组件 + Radix UI 原语 | `src/components/ui/`（button/badge/switch/input/textarea/dialog） |
| 图标 | lucide-react | 额外内嵌 SVG（GitHub/Google 官方标识） |
| 状态管理 | React Context | `MockStoreProvider`（全局业务数据）+ `TourProvider`（导览状态） |
| 持久化 | localStorage | Key 前缀 `smartkols_state_v1_*`，加载/保存通过 `useEffect` |
| 部署 | Vercel | GitHub push → 自动构建 → 自动部署，零配置 |

---

## 3. 目录结构

```
src/
├── app/                          # Next.js App Router 路由
│   ├── layout.tsx                # 根布局（MockStoreProvider + TourProvider + Sidebar）
│   ├── page.tsx                  # / → redirect to /dashboard
│   ├── login/page.tsx            # 登录页（Mock OAuth）
│   ├── dashboard/page.tsx        # 概览看板
│   ├── accounts/
│   │   ├── page.tsx              # 账号列表 + 分组 + 批量操作
│   │   └── [id]/
│   │       ├── layout.tsx        # 账号详情 header + tabs
│   │       ├── persona/page.tsx  # 人格配置
│   │       ├── sources/page.tsx  # 信息源管理
│   │       ├── autopost/page.tsx # 自动发帖配置
│   │       ├── engagement/page.tsx # 互动自动化
│   │       ├── preview/page.tsx  # 推文预览
│   │       └── analytics/page.tsx # 数据分析
│   ├── calendar/page.tsx         # 内容日历（周视图）
│   ├── drafts/page.tsx           # 内容审核（草稿队列）
│   ├── monitoring/page.tsx       # 监控中心
│   ├── settings/page.tsx         # 设置 + 团队
│   └── globals.css               # 全局样式
│
├── components/
│   ├── ui/                       # 基础 UI 组件
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── switch.tsx
│   │   └── dialog.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx           # 侧边导航（桌面固定 + 移动端抽屉）
│   │   ├── AccountNav.tsx        # 账号详情 6-tab 导航
│   │   ├── NotificationBell.tsx  # 通知中心铃铛
│   │   └── CommandPalette.tsx    # Cmd+K 命令面板
│   ├── accounts/
│   │   ├── AccountCard.tsx       # 卡片视图（未启用）
│   │   ├── AddAccountModal.tsx   # 单个添加弹窗
│   │   ├── CsvImportModal.tsx    # 批量导入弹窗
│   │   ├── PersonaTemplateModal.tsx # 模板套用弹窗
│   │   └── HealthCard.tsx        # 健康分卡片（compact + full 两种模式）
│   ├── persona/
│   │   ├── PersonaForm.tsx       # 人格配置表单
│   │   ├── TraitTagInput.tsx     # 标签输入组件
│   │   └── DistillationPanel.tsx # AI 蒸馏面板（Mock）
│   └── tour/
│       ├── TourProvider.tsx      # 导览 Context + 跨路由同步
│       ├── TourOverlay.tsx       # SVG 镂空高亮 + tooltip
│       ├── TourButton.tsx        # Sidebar 导览按钮
│       └── TourWelcomeCard.tsx   # 首次访问欢迎浮卡
│
├── data/                         # Mock 数据 JSON
│   ├── accounts.json             # 200 个账号
│   ├── groups.json               # 5 个分组
│   ├── personas.json             # 12 个预置人格
│   ├── persona-templates.json    # 人格模板库
│   ├── autopost.json             # 自动发帖配置
│   ├── sources.json              # 信息源配置
│   ├── tweet-previews.json       # 推文预览文案
│   ├── monitoring.json           # 监控消息
│   ├── drafts.json               # 30 条草稿
│   ├── engagement-configs.json   # 互动自动化配置
│   ├── engagement-logs.json      # 50 条互动日志
│   └── notifications.json        # 15 条通知
│
└── lib/
    ├── mock-store.tsx            # MockStoreProvider + 所有 state/方法 + localStorage
    ├── tour-steps.ts             # 12 步导览数据（文案 + selectors + routes）
    └── utils.ts                  # cn() 工具函数
```

---

## 4. 核心数据模型

### 4.1 Account
```ts
interface Account {
  id: string;            // "acc_001" ~ "acc_200"
  handle: string;        // "@crypto_sarah"
  displayName: string;   // "Sarah Kim"
  avatarSeed: string;    // Twitter handle（用于 unavatar.io）
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  active: boolean;
  createdAt: string;     // ISO date
  groupId?: string;      // "grp_001" ~ "grp_005"
}
```

### 4.2 Persona
```ts
interface Persona {
  gender: string;
  nationality: string;
  age: number;
  interests: string[];
  personalityTraits: string[];
  writingStyle: string;
  bio: string;
  distillationSampleTweets: string;
}
```

### 4.3 EngagementConfig
```ts
interface EngagementConfig {
  autoFollow: { enabled, maxPerDay, rules: {type, value}[] };
  autoRetweet: { enabled, maxPerDay, minLikes, whitelist, keywords, delayMin, delayMax, quoteTweetEnabled };
  autoComment: { enabled, maxPerDay, targets, style, mode };
  autoReply: { enabled, maxPerDay, triggerTypes, onlyFollowers, keywords, style };
}
```

### 4.4 Draft
```ts
interface Draft {
  id: string;
  accountId: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  scheduledTime: string;
  generatedAt: string;
  topic: string;
}
```

### 4.5 HealthScore（计算型，非持久化）
```ts
interface HealthScore {
  score: number;          // 0-100
  breakdown: { label, value, max }[];  // 4 维度
  risk: "low" | "medium" | "high";
}
```
当前实现：基于 accountId 的确定性 hash，保证每次刷新得到相同结果。

完整接口定义见 `src/lib/mock-store.tsx`。

---

## 5. 关键技术实现

### 5.1 头像方案
```
主 src: https://unavatar.io/twitter/{account.avatarSeed}
降级:    https://api.dicebear.com/7.x/avataaars/svg?seed={account.avatarSeed}
```
通过 `<img onError>` 实现自动降级。avatarSeed 存储真实 Twitter handle（如 "elonmusk"）。

### 5.2 localStorage 持久化
`MockStoreProvider` 在 `useEffect` 中：
- mount 时从 localStorage 读取各 state（key 前缀 `smartkols_state_v1_`）
- state 变化时自动写入
- `hydrated` flag 防止 SSR/客户端 mismatch
- `resetDemo()` 清除所有 key 并 reload

### 5.3 产品导览（自研）
为什么不用 driver.js / intro.js：跨路由 DOM 卸载导致高亮位置错乱。

核心逻辑：
- `TourProvider`：管理 active/currentStep，监听 pathname 变化
- 路由不匹配时自动 `router.push`，等 300ms 后定位目标元素
- 目标元素通过 `data-tour="xxx"` attribute selector 定位，找不到时重试 3 次
- `TourOverlay`：SVG `fillRule="evenodd"` 实现镂空高亮
- Tooltip 定位：根据目标元素在视口的位置，自动选择下/上/右/左
- 移动端（<768px）：tooltip 改为底部固定全宽卡片

### 5.4 响应式适配
断点 768px（Tailwind `md`）。核心改动：
- Sidebar：桌面固定 224px → 移动端隐藏，顶部 56px 导航栏 + 汉堡触发左侧抽屉
- 主内容区：`md:ml-56 pt-14 md:pt-0`
- 网格：`grid-cols-N` 统一添加 `md:` 前缀（如 `grid-cols-2 md:grid-cols-6`）
- 表格：`min-w-[760px]` 允许横向滚动
- 监控中心：左右分栏 → 移动端上下堆叠
- 日历：7 列 → 移动端 1 列

### 5.5 配色系统

| 用途 | 颜色 |
|---|---|
| 页面背景 | `#F7F7F7` |
| 卡片/侧边栏 | `#FFFFFF` |
| 边框 | `#E8E8E8` |
| 主文字 | `#111111` |
| 次要文字 | `#999999` |
| 强调/按钮 | `#111111` |
| 成功色 | `#00BA7C` |
| 警告/危险 | `#E05252` |

---

## 6. 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
# → http://localhost:3000

# 构建
npm run build

# 重置 Demo 数据
# 方式 1：浏览器 → Settings → "重置 Demo 数据"
# 方式 2：DevTools → Application → Local Storage → 清除 smartkols_state_v1_* 前缀的 key
```

---

## 7. 部署

当前使用 Vercel，GitHub push 自动触发：
- 仓库：https://github.com/yb2999/SmartKOLs
- 线上：https://smartkols.vercel.app/
- 分支：`main`
- Framework：Next.js（Vercel 自动识别）
- 无需环境变量（所有数据为 Mock）

---

## 8. 后续技术方向（对应 PRD 里程碑）

| 里程碑 | 技术工作 |
|---|---|
| M1 AI 核心 | 后端 API route 或独立 API server；Claude API 集成（人格蒸馏 + 推文生成 + 消息分类） |
| M2 Twitter | Twitter API v2 OAuth 2.0 接入；发推/回复/关注/转发 endpoint |
| M3 后端 | 数据库选型（Postgres / Supabase）；API 服务化；NextAuth 或 Clerk 认证 |
| M4 风控 | 健康分从 hash 算法改为真实数据计算；异常检测 pipeline |
| M5 团队 | RBAC 权限系统；操作审计日志 |
| M6 商业化 | Stripe 订阅集成；用量计量；Landing page |
