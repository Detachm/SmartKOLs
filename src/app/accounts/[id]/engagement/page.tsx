"use client";

import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useMockStore, EngagementConfig } from "@/lib/mock-store";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TraitTagInput from "@/components/persona/TraitTagInput";
import { UserPlus, Repeat2, MessageCircle, Reply, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

const COMMENT_STYLES = [
  { value: "supportive", label: "支持型" },
  { value: "questioning", label: "提问型" },
  { value: "value-add", label: "补充观点型" },
];

const REPLY_STYLES = [
  { value: "grateful", label: "感谢型" },
  { value: "interactive", label: "互动型" },
  { value: "brief", label: "简短确认" },
];

type EngagementLogType = "follow" | "retweet" | "comment" | "reply";

const DETAIL_CARD_META: Record<EngagementLogType, {
  label: string;
  icon: typeof UserPlus;
  empty: string;
}> = {
  follow: { label: "今日关注", icon: UserPlus, empty: "今天还没有自动关注记录。" },
  retweet: { label: "今日转发", icon: Repeat2, empty: "今天还没有自动转发记录。" },
  comment: { label: "今日评论", icon: MessageCircle, empty: "今天还没有自动评论记录。" },
  reply: { label: "今日回复", icon: Reply, empty: "今天还没有自动回复记录。" },
};

export default function EngagementPage() {
  const params = useParams();
  const id = params.id as string;
  const { getEngagementConfig, updateEngagementConfig, engagementLogs } = useMockStore();
  const [config, setConfig] = useState<EngagementConfig>(getEngagementConfig(id));
  const [saved, setSaved] = useState(false);
  const [detailType, setDetailType] = useState<EngagementLogType | null>(null);

  const accountLogs = useMemo(
    () => engagementLogs.filter((l) => l.accountId === id).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [engagementLogs, id]
  );

  const updateField = <K extends keyof EngagementConfig>(key: K, value: EngagementConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateEngagementConfig(id, config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Today's stats
  const todayStr = new Date().toDateString();
  const todayCount = {
    follow: accountLogs.filter((l) => l.type === "follow" && new Date(l.at).toDateString() === todayStr).length,
    retweet: accountLogs.filter((l) => l.type === "retweet" && new Date(l.at).toDateString() === todayStr).length,
    comment: accountLogs.filter((l) => l.type === "comment" && new Date(l.at).toDateString() === todayStr).length,
    reply: accountLogs.filter((l) => l.type === "reply" && new Date(l.at).toDateString() === todayStr).length,
  };
  const todayLogs = useMemo(
    () => ({
      follow: accountLogs.filter((l) => l.type === "follow" && new Date(l.at).toDateString() === todayStr),
      retweet: accountLogs.filter((l) => l.type === "retweet" && new Date(l.at).toDateString() === todayStr),
      comment: accountLogs.filter((l) => l.type === "comment" && new Date(l.at).toDateString() === todayStr),
      reply: accountLogs.filter((l) => l.type === "reply" && new Date(l.at).toDateString() === todayStr),
    }),
    [accountLogs, todayStr]
  );
  const detailMeta = detailType ? DETAIL_CARD_META[detailType] : null;
  const detailLogs = detailType ? todayLogs[detailType] : [];
  const summaryCards: Array<{ type: EngagementLogType; count: number }> = [
    { type: "follow", count: todayCount.follow },
    { type: "retweet", count: todayCount.retweet },
    { type: "comment", count: todayCount.comment },
    { type: "reply", count: todayCount.reply },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        社交互动自动化
      </h2>
      <p className="text-[#999999] text-sm mb-6">让账号自动去关注、转发、评论、回复 —— 看起来像真人，而不是只会发推的机器</p>

      {/* Today's Summary */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {summaryCards.map(({ type, count }) => {
          const meta = DETAIL_CARD_META[type];
          const Icon = meta.icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setDetailType(type)}
              className="rounded-xl border border-[#E8E8E8] bg-white p-4 text-left transition-colors hover:border-[#CCCCCC] hover:bg-[#FAFAFA]"
            >
              <div className="mb-1 flex items-center gap-2">
                <Icon className="h-4 w-4 text-[#999999]" />
                <span className="text-xs text-[#999999]">{meta.label}</span>
              </div>
              <p className="text-xl font-bold text-[#111111]">{count}</p>
              <p className="mt-2 text-[11px] text-[#999999]">点击查看详情</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Config Cards */}
        <div className="space-y-4">
          {/* Auto Follow */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <h3 className="text-[#111111] font-semibold text-sm">自动关注</h3>
              </div>
              <Switch
                checked={config.autoFollow.enabled}
                onCheckedChange={(v) => updateField("autoFollow", { ...config.autoFollow, enabled: v })}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#999999] mb-1 block">每日最多关注数</label>
                <Input
                  type="number"
                  value={config.autoFollow.maxPerDay}
                  onChange={(e) => updateField("autoFollow", { ...config.autoFollow, maxPerDay: parseInt(e.target.value) || 0 })}
                  className="h-9"
                />
                <p className="text-xs text-[#999999] mt-1">建议 ≤ 30，防触发 Twitter 频率限制</p>
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1 block">关注规则（关键词）</label>
                <TraitTagInput
                  tags={config.autoFollow.rules.map((r) => r.value)}
                  onChange={(tags) => updateField("autoFollow", { ...config.autoFollow, rules: tags.map((t) => ({ type: "keyword", value: t })) })}
                  placeholder="输入关键词后按 Enter，例如：crypto、DeFi"
                />
              </div>
            </div>
          </div>

          {/* Auto Retweet */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Repeat2 className="w-4 h-4" />
                <h3 className="text-[#111111] font-semibold text-sm">自动转发</h3>
              </div>
              <Switch
                checked={config.autoRetweet.enabled}
                onCheckedChange={(v) => updateField("autoRetweet", { ...config.autoRetweet, enabled: v })}
              />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#999999] mb-1 block">每日上限</label>
                  <Input type="number" value={config.autoRetweet.maxPerDay} onChange={(e) => updateField("autoRetweet", { ...config.autoRetweet, maxPerDay: parseInt(e.target.value) || 0 })} className="h-9" />
                </div>
                <div>
                  <label className="text-xs text-[#999999] mb-1 block">最小点赞数</label>
                  <Input type="number" value={config.autoRetweet.minLikes} onChange={(e) => updateField("autoRetweet", { ...config.autoRetweet, minLikes: parseInt(e.target.value) || 0 })} className="h-9" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1 block">白名单账号（优先转发）</label>
                <TraitTagInput
                  tags={config.autoRetweet.whitelist}
                  onChange={(tags) => updateField("autoRetweet", { ...config.autoRetweet, whitelist: tags })}
                  placeholder="@handle 后按 Enter"
                />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-1 block">延迟范围（分钟，模拟真人）</label>
                <div className="flex gap-2 items-center">
                  <Input type="number" value={config.autoRetweet.delayMin} onChange={(e) => updateField("autoRetweet", { ...config.autoRetweet, delayMin: parseInt(e.target.value) || 0 })} className="h-9" />
                  <span className="text-xs text-[#999999]">~</span>
                  <Input type="number" value={config.autoRetweet.delayMax} onChange={(e) => updateField("autoRetweet", { ...config.autoRetweet, delayMax: parseInt(e.target.value) || 0 })} className="h-9" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#111111]">启用 Quote Tweet（转发时带评论）</span>
                <Switch
                  checked={config.autoRetweet.quoteTweetEnabled}
                  onCheckedChange={(v) => updateField("autoRetweet", { ...config.autoRetweet, quoteTweetEnabled: v })}
                />
              </div>
            </div>
          </div>

          {/* Auto Comment */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <h3 className="text-[#111111] font-semibold text-sm">自动评论</h3>
              </div>
              <Switch
                checked={config.autoComment.enabled}
                onCheckedChange={(v) => updateField("autoComment", { ...config.autoComment, enabled: v })}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#999999] mb-1 block">每日评论上限</label>
                <Input type="number" value={config.autoComment.maxPerDay} onChange={(e) => updateField("autoComment", { ...config.autoComment, maxPerDay: parseInt(e.target.value) || 0 })} className="h-9" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-2 block">评论风格</label>
                <div className="flex gap-2">
                  {COMMENT_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateField("autoComment", { ...config.autoComment, style: s.value })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                        config.autoComment.style === s.value ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-2 block">目标选择模式</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateField("autoComment", { ...config.autoComment, mode: "latest" })}
                    className={cn("px-3 py-1.5 rounded-lg text-xs border", config.autoComment.mode === "latest" ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]")}
                  >只评最新一条</button>
                  <button
                    onClick={() => updateField("autoComment", { ...config.autoComment, mode: "random" })}
                    className={cn("px-3 py-1.5 rounded-lg text-xs border", config.autoComment.mode === "random" ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]")}
                  >随机选一条</button>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Reply */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Reply className="w-4 h-4" />
                <h3 className="text-[#111111] font-semibold text-sm">自动回复粉丝</h3>
              </div>
              <Switch
                checked={config.autoReply.enabled}
                onCheckedChange={(v) => updateField("autoReply", { ...config.autoReply, enabled: v })}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#999999] mb-1 block">每日回复上限</label>
                <Input type="number" value={config.autoReply.maxPerDay} onChange={(e) => updateField("autoReply", { ...config.autoReply, maxPerDay: parseInt(e.target.value) || 0 })} className="h-9" />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-2 block">触发类型</label>
                <div className="flex gap-2 flex-wrap">
                  {[["mention", "被 @ 提及"], ["reply", "推文下评论"], ["dm", "私信"]].map(([v, l]) => {
                    const checked = config.autoReply.triggerTypes.includes(v);
                    return (
                      <button
                        key={v}
                        onClick={() => updateField("autoReply", {
                          ...config.autoReply,
                          triggerTypes: checked ? config.autoReply.triggerTypes.filter((t) => t !== v) : [...config.autoReply.triggerTypes, v],
                        })}
                        className={cn("px-3 py-1.5 rounded-lg text-xs border", checked ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]")}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#111111]">只回复关注者</span>
                <Switch
                  checked={config.autoReply.onlyFollowers}
                  onCheckedChange={(v) => updateField("autoReply", { ...config.autoReply, onlyFollowers: v })}
                />
              </div>
              <div>
                <label className="text-xs text-[#999999] mb-2 block">回复风格</label>
                <div className="flex gap-2">
                  {REPLY_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateField("autoReply", { ...config.autoReply, style: s.value })}
                      className={cn("px-3 py-1.5 rounded-lg text-xs border", config.autoReply.style === s.value ? "border-[#CCCCCC] bg-black/5 text-[#111111]" : "border-[#E0E0E0] text-[#999999]")}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">保存互动配置</Button>
          {saved && <p className="text-[#00BA7C] text-sm text-center">✓ 配置已保存</p>}
        </div>

        {/* Right: Engagement Log */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 h-fit">
          <h3 className="text-[#111111] font-semibold text-sm mb-4">互动日志（近 7 天）</h3>
          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
            {accountLogs.length === 0 && (
              <p className="text-[#999999] text-sm text-center py-10">暂无互动记录</p>
            )}
            {accountLogs.map((log) => {
              const typeInfo = {
                follow: { icon: <UserPlus className="w-3.5 h-3.5" />, label: "关注了", color: "text-blue-500 bg-blue-50" },
                retweet: { icon: <Repeat2 className="w-3.5 h-3.5" />, label: "转发了", color: "text-[#00BA7C] bg-green-50" },
                comment: { icon: <MessageCircle className="w-3.5 h-3.5" />, label: "评论了", color: "text-orange-500 bg-orange-50" },
                reply: { icon: <Reply className="w-3.5 h-3.5" />, label: "回复了", color: "text-purple-500 bg-purple-50" },
              }[log.type];
              return (
                <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-[#E8E8E8] last:border-b-0">
                  <span className={cn("flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center", typeInfo.color)}>
                    {typeInfo.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#111111]">
                      <span className="text-[#999999]">{typeInfo.label}</span>{" "}
                      <span className="font-medium">{log.targetHandle}</span>
                      {log.targetName && <span className="text-[#999999]"> · {log.targetName}</span>}
                    </p>
                    {log.tweetExcerpt && <p className="text-xs text-[#999999] mt-1 italic truncate">&ldquo;{log.tweetExcerpt}&rdquo;</p>}
                    {log.commentText && <p className="text-xs text-[#111111] mt-1 truncate">💬 {log.commentText}</p>}
                    {log.replyText && <p className="text-xs text-[#111111] mt-1 truncate">↩️ {log.replyText}</p>}
                    <p className="text-[10px] text-[#999999] mt-1">{timeAgo(log.at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={detailType !== null} onOpenChange={(open) => {
        if (!open) setDetailType(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailMeta?.label ?? "互动详情"}</DialogTitle>
            <DialogDescription>展示该账号今天的自动互动明细。</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
            {detailMeta && detailLogs.length === 0 ? (
              <div className="rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-8 text-center text-sm text-[#777777]">
                {detailMeta.empty}
              </div>
            ) : null}

            {detailLogs.map((log) => {
              const typeInfo = {
                follow: { icon: <UserPlus className="w-4 h-4" />, label: "已关注", color: "text-blue-500 bg-blue-50" },
                retweet: { icon: <Repeat2 className="w-4 h-4" />, label: "已转发", color: "text-[#00BA7C] bg-green-50" },
                comment: { icon: <MessageCircle className="w-4 h-4" />, label: "已评论", color: "text-orange-500 bg-orange-50" },
                reply: { icon: <Reply className="w-4 h-4" />, label: "已回复", color: "text-purple-500 bg-purple-50" },
              }[log.type];

              return (
                <div key={log.id} className="rounded-xl border border-[#E8E8E8] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full", typeInfo.color)}>
                      {typeInfo.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-[#111111]">
                          <span className="font-medium">{typeInfo.label}</span>
                          {" "}
                          <span className="font-medium">{log.targetHandle}</span>
                          {log.targetName ? <span className="text-[#999999]"> · {log.targetName}</span> : null}
                        </p>
                        <span className="text-xs text-[#999999]">{timeAgo(log.at)}</span>
                      </div>
                      {log.tweetExcerpt ? <p className="mt-2 text-sm italic text-[#666666]">&ldquo;{log.tweetExcerpt}&rdquo;</p> : null}
                      {log.commentText ? <p className="mt-2 text-sm text-[#111111]">评论内容：{log.commentText}</p> : null}
                      {log.replyText ? <p className="mt-2 text-sm text-[#111111]">回复内容：{log.replyText}</p> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
