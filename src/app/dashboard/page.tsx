"use client";

import { useState } from "react";
import { useMockStore } from "@/lib/mock-store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Bell, Zap, TrendingUp, ChevronRight, Flame, FileText, Sparkles } from "lucide-react";

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export default function DashboardPage() {
  const { accounts, groups, monitoringMessages, drafts, trendingTopics, engagementLogs, addDraftsFromTopic } = useMockStore();
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);

  const activeAccounts = accounts.filter((a) => a.active).length;
  const totalFollowers = accounts.reduce((s, a) => s + a.followersCount, 0);
  const unreadMessages = monitoringMessages.filter((m) => !m.read).length;
  const collabMessages = monitoringMessages.filter((m) => m.category === "collab").length;
  const pendingDrafts = drafts.filter((d) => d.status === "pending").length;
  const todayEngagements = engagementLogs.filter((l) => new Date(l.at).toDateString() === new Date().toDateString()).length;

  const stats = [
    { label: "总账号数", value: accounts.length, sub: `${activeAccounts} 个运行中`, icon: Users, color: "text-[#111111]" },
    { label: "总粉丝数", value: formatNumber(totalFollowers), sub: "跨所有账号", icon: TrendingUp, color: "text-[#00BA7C]" },
    { label: "待审核草稿", value: pendingDrafts, sub: "条推文待批准", icon: FileText, color: "text-orange-500" },
    { label: "今日互动", value: todayEngagements, sub: "次自动互动", icon: Zap, color: "text-sky-400" },
    { label: "未读消息", value: unreadMessages, sub: `${collabMessages} 条合作邀约`, icon: Bell, color: "text-[#999999]" },
    { label: "账号分组", value: groups.length, sub: "个活跃分组", icon: Sparkles, color: "text-purple-500" },
  ];

  const handleGenerateFromTopic = (topic: string) => {
    setGenerating(topic);

    void addDraftsFromTopic(topic)
      .then((queuedCount) => {
        if (queuedCount > 0) {
          router.push("/drafts");
        }
      })
      .finally(() => {
        setGenerating(null);
      });
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#111111]">概览</h1>
        <p className="text-[#999999] text-sm mt-1">SmartKOLs 运营数据一览</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#999999] text-xs">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-[#111111] text-2xl font-bold">{value}</p>
            <p className="text-[#999999] text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Trending Topics */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-500" />
          <h2 className="text-[#111111] font-semibold text-sm">近 24 小时热门话题</h2>
          <span className="text-xs text-[#999999]">· 点击一键批量生成相关草稿</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {trendingTopics.slice(0, 10).map((t) => (
            <button
              key={t.topic}
              onClick={() => handleGenerateFromTopic(t.topic)}
              disabled={generating !== null}
              className="text-left bg-[#F7F7F7] border border-[#E8E8E8] hover:border-[#111111] rounded-lg p-3 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#999999] uppercase">{t.category}</span>
                <div className="flex items-center gap-1 text-xs text-orange-500">
                  <Flame className="w-3 h-3" />
                  {t.heat}
                </div>
              </div>
              <p className="text-[#111111] text-xs font-medium line-clamp-2">
                {generating === t.topic ? "正在批量生成草稿..." : t.topic}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#111111] font-semibold text-sm">账号列表</h2>
            <Link href="/accounts" className="text-xs text-[#111111] hover:text-[#999999] flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {accounts.slice(0, 5).map((account) => {
              const group = groups.find((g) => g.id === account.groupId);
              return (
                <div key={account.id} className="flex items-center gap-3">
                  <img src={`https://unavatar.io/twitter/${account.avatarSeed}`} className="w-8 h-8 rounded-full bg-[#E8E8E8]" alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${account.avatarSeed}`; }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111111] text-sm font-medium truncate">{account.displayName}</p>
                    <p className="text-[#999999] text-xs">{account.handle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {group && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: group.color + "30", color: group.color }}>{group.name}</span>}
                    <span className={`w-1.5 h-1.5 rounded-full ${account.active ? "bg-[#00BA7C]" : "bg-[#E0E0E0]"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#111111] font-semibold text-sm">最新消息</h2>
            <Link href="/monitoring" className="text-xs text-[#111111] hover:text-[#999999] flex items-center gap-1">
              查看全部 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {monitoringMessages.slice(0, 5).map((msg) => {
              const catColors: Record<string, string> = { collab: "text-[#999999]", commerce: "text-[#00BA7C]", spam: "text-red-400", normal: "text-[#999999]" };
              const catLabels: Record<string, string> = { collab: "🤝 合作", commerce: "💰 商务", spam: "🚨 垃圾", normal: "💬 普通" };
              return (
                <div key={msg.id} className="flex items-start gap-3">
                  <img src={`https://unavatar.io/twitter/${msg.senderAvatar}`} className="w-8 h-8 rounded-full bg-[#E8E8E8] flex-shrink-0" alt="" onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderAvatar}`; }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[#111111] text-xs font-medium">{msg.sender}</p>
                      <span className={`text-[10px] ${catColors[msg.category]}`}>{catLabels[msg.category]}</span>
                    </div>
                    <p className="text-[#999999] text-xs truncate">{msg.preview}</p>
                  </div>
                  {!msg.read && <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 mt-1.5" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
