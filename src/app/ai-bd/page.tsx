"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Filter,
  Mail,
  MessageCircle,
  PauseCircle,
  Plus,
  Radar,
  RefreshCw,
  Send,
  ShieldAlert,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TabKey = "radar" | "leads" | "review" | "accounts";

const tabs = [
  { key: "radar" as const, label: "资产雷达", icon: Radar },
  { key: "leads" as const, label: "线索池", icon: Target },
  { key: "review" as const, label: "触达审核", icon: Send },
  { key: "accounts" as const, label: "账号池", icon: Users },
];

const stats = [
  { label: "监控资产", value: "128", sub: "LBank 已上线", icon: Radar },
  { label: "新增讨论", value: "864", sub: "24h X 讨论", icon: MessageCircle },
  { label: "高价值线索", value: "37", sub: "可触达", icon: Target },
  { label: "待审核触达", value: "12", sub: "评论 / 私信", icon: Clock3 },
  { label: "今日已触达", value: "24", sub: "人工批准后", icon: Send },
  { label: "继续沟通", value: "5", sub: "回复或私信", icon: Mail },
];

const assets = [
  {
    symbol: "SOL",
    pair: "SOL/USDT",
    name: "Solana",
    heat: 92,
    momentum: "+38%",
    sentiment: "偏多",
    valuable: 14,
    action: "评论优先",
    lastScan: "3 分钟前",
    topic: "生态应用收入、链上活跃、ETF 预期",
  },
  {
    symbol: "TON",
    pair: "TON/USDT",
    name: "Toncoin",
    heat: 78,
    momentum: "+21%",
    sentiment: "分化",
    valuable: 8,
    action: "私信跟进",
    lastScan: "6 分钟前",
    topic: "Telegram 分发、小游戏留存、钱包入口",
  },
  {
    symbol: "SUI",
    pair: "SUI/USDT",
    name: "Sui",
    heat: 71,
    momentum: "+16%",
    sentiment: "偏多",
    valuable: 6,
    action: "评论优先",
    lastScan: "11 分钟前",
    topic: "DeFi TVL、Move 生态、交易体验",
  },
  {
    symbol: "ENA",
    pair: "ENA/USDT",
    name: "Ethena",
    heat: 64,
    momentum: "+9%",
    sentiment: "中性",
    valuable: 5,
    action: "暂缓",
    lastScan: "14 分钟前",
    topic: "收益来源、稳定币需求、风险折价",
  },
  {
    symbol: "BTC",
    pair: "BTC/USDT",
    name: "Bitcoin",
    heat: 88,
    momentum: "+12%",
    sentiment: "偏多",
    valuable: 11,
    action: "评论优先",
    lastScan: "18 分钟前",
    topic: "ETF 流入、宏观流动性、减半后供给",
  },
];

const leads = [
  {
    id: "lead-1",
    asset: "SOL",
    author: "ChainPulse",
    handle: "@chainpulse_io",
    channel: "评论",
    score: 91,
    followers: "148K",
    post: "Solana revenue is becoming harder to ignore. The debate is shifting from speed to sustainable demand.",
    reason: "讨论聚焦交易需求和收入质量，适合切入 LBank SOL 深度与现货入口。",
    risk: "低",
  },
  {
    id: "lead-2",
    asset: "TON",
    author: "Web3 Scout",
    handle: "@web3scout",
    channel: "私信",
    score: 84,
    followers: "62K",
    post: "TON still needs better retail on-ramps if Telegram distribution is going to become real liquidity.",
    reason: "作者明确讨论交易入口和流动性，可用私信提供 LBank 上币与交易入口信息。",
    risk: "中",
  },
  {
    id: "lead-3",
    asset: "SUI",
    author: "Move Daily",
    handle: "@movedaily",
    channel: "评论",
    score: 79,
    followers: "34K",
    post: "Sui DeFi is getting more attention, but the real question is where new users actually trade first.",
    reason: "问题天然指向交易平台选择，适合轻量评论补充 LBank 可交易信息。",
    risk: "低",
  },
];

const reviews = [
  {
    id: "review-1",
    asset: "SOL",
    target: "@chainpulse_io",
    account: "@LBankGrowth_01",
    type: "评论",
    status: "待审核",
    copy: "Useful framing. For traders tracking SOL demand, LBank has SOL/USDT live with spot depth and a simple mobile entry.",
  },
  {
    id: "review-2",
    asset: "TON",
    target: "@web3scout",
    account: "@LBankGrowth_03",
    type: "私信",
    status: "需编辑",
    copy: "Saw your TON liquidity thread. LBank has TON listed and can support users looking for a direct trading venue.",
  },
  {
    id: "review-3",
    asset: "SUI",
    target: "@movedaily",
    account: "@LBankGrowth_02",
    type: "评论",
    status: "待审核",
    copy: "Agree that first trading venue matters. SUI/USDT is available on LBank for users who want a straightforward spot route.",
  },
];

const outreachAccounts = [
  {
    handle: "@LBankGrowth_01",
    role: "主账号",
    focus: "BTC / SOL / ETH",
    quota: 40,
    used: 18,
    health: "正常",
    lastAction: "12 分钟前",
  },
  {
    handle: "@LBankGrowth_02",
    role: "生态账号",
    focus: "SUI / Aptos / Move",
    quota: 32,
    used: 9,
    health: "正常",
    lastAction: "25 分钟前",
  },
  {
    handle: "@LBankGrowth_03",
    role: "BD 账号",
    focus: "TON / GameFi / Wallet",
    quota: 28,
    used: 21,
    health: "限速观察",
    lastAction: "41 分钟前",
  },
  {
    handle: "@LBankGrowth_04",
    role: "备用账号",
    focus: "Meme / 新资产",
    quota: 20,
    used: 4,
    health: "暂停",
    lastAction: "2 小时前",
  },
];

export default function AiBdPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("radar");
  const watchCount = useMemo(() => assets.filter((asset) => asset.action !== "暂缓").length, []);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[#666666]">
            <Bot className="h-4 w-4" />
            <span>AI BD</span>
            <span className="rounded-full border border-[#E8E8E8] bg-white px-2 py-0.5 text-xs text-[#777777]">界面预览</span>
          </div>
          <h1 className="text-2xl font-bold text-[#111111]">资产讨论监控台</h1>
          <p className="mt-1 max-w-3xl text-sm text-[#999999]">
            定时扫描 LBank 已上线资产在 X 的讨论，筛出高价值线索后进入评论或私信审核队列。
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button className="gap-2 border border-[#111111] bg-[#111111] text-white hover:bg-[#333333]" disabled>
            <Plus className="h-4 w-4" />
            新建监控任务
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            <Upload className="h-4 w-4" />
            导入资产
          </Button>
          <Button variant="outline" size="icon" disabled aria-label="刷新资产讨论">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[#E8E8E8] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#666666]">{label}</span>
              <Icon className="h-4 w-4 text-[#999999]" />
            </div>
            <div className="mt-3 text-2xl font-bold text-[#111111]">{value}</div>
            <div className="mt-1 text-xs text-[#999999]">{sub}</div>
          </div>
        ))}
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E8E8]">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm transition-colors",
                  active
                    ? "border-[#111111] text-[#111111]"
                    : "border-transparent text-[#777777] hover:text-[#333333]",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pb-3 text-sm text-[#666666]">
          <Filter className="h-4 w-4" />
          <span>{watchCount} 个资产处于可触达观察</span>
        </div>
      </div>

      {activeTab === "radar" ? <AssetRadar /> : null}
      {activeTab === "leads" ? <LeadPool /> : null}
      {activeTab === "review" ? <ReviewQueue /> : null}
      {activeTab === "accounts" ? <AccountPool /> : null}
    </div>
  );
}

function AssetRadar() {
  return (
    <section className="overflow-x-auto rounded-xl border border-[#E8E8E8] bg-white">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[1.15fr_0.95fr_0.7fr_0.65fr_0.7fr_1.35fr_0.8fr] border-b border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3 text-xs font-medium text-[#666666]">
          <span>资产</span>
          <span>讨论热度</span>
          <span>趋势</span>
          <span>情绪</span>
          <span>高价值</span>
          <span>关键讨论</span>
          <span className="text-right">建议动作</span>
        </div>
        {assets.map((asset) => (
          <div
            key={asset.symbol}
            className="grid grid-cols-[1.15fr_0.95fr_0.7fr_0.65fr_0.7fr_1.35fr_0.8fr] items-center border-b border-[#F0F0F0] px-4 py-4 text-sm last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111111] text-xs font-bold text-white">
                {asset.symbol}
              </span>
              <div>
                <p className="font-semibold text-[#111111]">{asset.pair}</p>
                <p className="text-xs text-[#999999]">{asset.name} · {asset.lastScan}</p>
              </div>
            </div>
            <div className="pr-6">
              <div className="h-2 rounded-full bg-[#ECECEC]">
                <div className="h-2 rounded-full bg-[#111111]" style={{ width: `${asset.heat}%` }} />
              </div>
              <p className="mt-1 text-xs text-[#999999]">{asset.heat}/100</p>
            </div>
            <span className="text-[#00BA7C]">{asset.momentum}</span>
            <span>{asset.sentiment}</span>
            <span>{asset.valuable} 条</span>
            <span className="truncate pr-5 text-[#666666]">{asset.topic}</span>
            <div className="flex justify-end">
              <StatusBadge label={asset.action} tone={asset.action === "暂缓" ? "neutral" : asset.action === "私信跟进" ? "amber" : "green"} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeadPool() {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      {leads.map((lead) => (
        <article key={lead.id} className="rounded-xl border border-[#E8E8E8] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge label={lead.asset} tone="dark" />
                <StatusBadge label={lead.channel} tone={lead.channel === "私信" ? "amber" : "green"} />
              </div>
              <h2 className="mt-3 text-lg font-semibold text-[#111111]">{lead.author}</h2>
              <p className="text-sm text-[#999999]">{lead.handle} · {lead.followers} followers</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#111111]">{lead.score}</p>
              <p className="text-xs text-[#999999]">线索分</p>
            </div>
          </div>
          <p className="mt-4 min-h-20 rounded-lg bg-[#FAFAFA] p-3 text-sm leading-6 text-[#333333]">{lead.post}</p>
          <div className="mt-4 border-t border-[#E8E8E8] pt-4">
            <p className="text-xs text-[#999999]">判断理由</p>
            <p className="mt-1 text-sm leading-6 text-[#333333]">{lead.reason}</p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-[#666666]">
              <ShieldAlert className="h-4 w-4" />
              风险：{lead.risk}
            </span>
            <Button variant="outline" size="sm" className="gap-2" disabled>
              查看线索
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}

function ReviewQueue() {
  return (
    <section className="space-y-3">
      {reviews.map((item) => (
        <article key={item.id} className="rounded-xl border border-[#E8E8E8] bg-white p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={item.asset} tone="dark" />
                <StatusBadge label={item.type} tone={item.type === "私信" ? "amber" : "green"} />
                <StatusBadge label={item.status} tone={item.status === "需编辑" ? "amber" : "neutral"} />
              </div>
              <p className="mt-3 text-sm text-[#999999]">{item.account} → {item.target}</p>
              <p className="mt-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-4 text-sm leading-6 text-[#111111]">{item.copy}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" disabled>
                <CheckCircle2 className="h-4 w-4" />
                批准发送
              </Button>
              <Button variant="outline" size="sm" disabled>编辑</Button>
              <Button variant="destructive" size="sm" disabled>驳回</Button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function AccountPool() {
  return (
    <section className="grid gap-4 xl:grid-cols-4">
      {outreachAccounts.map((account) => {
        const ratio = Math.round((account.used / account.quota) * 100);
        return (
          <article key={account.handle} className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#111111]">{account.handle}</h2>
                <p className="mt-1 text-sm text-[#999999]">{account.role}</p>
              </div>
              {account.health === "暂停" ? <PauseCircle className="h-5 w-5 text-[#999999]" /> : account.health === "限速观察" ? <ShieldAlert className="h-5 w-5 text-[#C58A00]" /> : <CheckCircle2 className="h-5 w-5 text-[#00BA7C]" />}
            </div>
            <p className="mt-4 text-xs text-[#999999]">适配资产</p>
            <p className="mt-1 min-h-10 text-sm text-[#333333]">{account.focus}</p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[#999999]">
                <span>今日额度</span>
                <span>{account.used}/{account.quota}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#ECECEC]">
                <div
                  className={cn("h-2 rounded-full", ratio > 75 ? "bg-[#C58A00]" : "bg-[#111111]")}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <StatusBadge label={account.health} tone={account.health === "正常" ? "green" : account.health === "暂停" ? "neutral" : "amber"} />
              <span className="text-[#999999]">{account.lastAction}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "dark" | "green" | "amber" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "dark" ? "border-[#111111] bg-[#111111] text-white" : null,
        tone === "green" ? "border-[#D7F3E6] bg-[#F4FCF8] text-[#008F5B]" : null,
        tone === "amber" ? "border-[#F4DFB8] bg-[#FFF8E8] text-[#A66A00]" : null,
        tone === "neutral" ? "border-[#E8E8E8] bg-[#F5F5F5] text-[#666666]" : null,
      )}
    >
      {label}
    </span>
  );
}
