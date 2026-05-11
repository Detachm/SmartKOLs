"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  commentOnPostOnX,
  followAccountOnX,
  getAccountAutomationOverview,
  getEngagementPolicy,
  listConnectorRequests,
  lookupPostsOnX,
  replyToPostOnX,
  repostPostOnX,
  upsertEngagementPolicy,
  type AccountAutomationOverviewResponse,
  type BackendConnectorRequest,
  type EngagementPolicyResponse,
} from "@/lib/live-api";
import {
  formatAutomationDateTime,
  getActionLabel,
  getAutomationStatusLabel,
  getBlockedReasonLabel,
  getLatestAutomationFailure,
  translateAutomationErrorMessage,
  translateAutomationRationale,
} from "@/lib/account-automation-ui";
import { getLiveSession } from "@/lib/session-client";
import { notifyAccountReadinessChanged } from "@/lib/account-readiness-refresh";

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

interface EngagementRule {
  type: string;
  value: string;
}

interface EngagementConfig {
  autoFollow: {
    enabled: boolean;
    maxPerDay: number;
    rules: EngagementRule[];
  };
  autoRetweet: {
    enabled: boolean;
    maxPerDay: number;
    minLikes: number;
    whitelist: string[];
    keywords: string[];
    delayMin: number;
    delayMax: number;
    quoteTweetEnabled: boolean;
  };
  autoComment: {
    enabled: boolean;
    maxPerDay: number;
    targets: string[];
    style: string;
    mode: string;
  };
  autoReply: {
    enabled: boolean;
    maxPerDay: number;
    triggerTypes: string[];
    onlyFollowers: boolean;
    requireManualApproval: boolean;
    keywords: string[];
    style: string;
  };
}

const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  autoFollow: { enabled: false, maxPerDay: 15, rules: [] },
  autoRetweet: { enabled: false, maxPerDay: 3, minLikes: 1000, whitelist: [], keywords: [], delayMin: 30, delayMax: 120, quoteTweetEnabled: false },
  autoComment: { enabled: false, maxPerDay: 5, targets: [], style: "supportive", mode: "latest" },
  autoReply: { enabled: false, maxPerDay: 30, triggerTypes: ["mention", "reply"], onlyFollowers: true, requireManualApproval: true, keywords: [], style: "grateful" },
};

type EngagementLogType = "follow" | "retweet" | "comment" | "reply";

interface EngagementLog {
  id: string;
  type: EngagementLogType;
  targetHandle?: string;
  targetPostId?: string;
  targetPostText?: string;
  commentText?: string;
  replyText?: string;
  at: string;
  status: BackendConnectorRequest["status"];
  errorMessage?: string;
}

interface ActionDrafts {
  followHandle: string;
  repostPostId: string;
  commentPostId: string;
  commentText: string;
  replyPostId: string;
  replyText: string;
}

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

function parseJsonObject(raw?: string): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function mapConnectorRequestToEngagementLog(item: BackendConnectorRequest): EngagementLog | null {
  const request = parseJsonObject(item.request_payload);
  const response = parseJsonObject(item.response_payload);
  const at = item.finished_at ?? item.started_at;
  const targetPostText = readString(request?.target_post_text) ?? readString(response?.target_post_text);

  switch (item.endpoint_code) {
    case "user.follow":
      return {
        id: item.id,
        type: "follow",
        targetHandle: readString(request?.target_handle) ?? readString(response?.target_handle),
        at,
        status: item.status,
        errorMessage: item.error_message,
      };
    case "post.repost":
      return {
        id: item.id,
        type: "retweet",
        targetPostId: readString(request?.target_post_id),
        targetPostText,
        at,
        status: item.status,
        errorMessage: item.error_message,
      };
    case "post.comment":
      return {
        id: item.id,
        type: "comment",
        targetPostId: readString(request?.comment_on_external_post_id),
        targetPostText,
        commentText: readString(request?.text),
        at,
        status: item.status,
        errorMessage: item.error_message,
      };
    case "post.reply":
      return {
        id: item.id,
        type: "reply",
        targetPostId: readString(request?.reply_to_external_post_id),
        targetPostText,
        replyText: readString(request?.text),
        at,
        status: item.status,
        errorMessage: item.error_message,
      };
    default:
      return null;
  }
}

export default function EngagementPage() {
  const params = useParams();
  const id = params.id as string;
  const [config, setConfig] = useState<EngagementConfig>(DEFAULT_ENGAGEMENT_CONFIG);
  const [automationOverview, setAutomationOverview] = useState<AccountAutomationOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [detailType, setDetailType] = useState<EngagementLogType | null>(null);
  const [accountLogs, setAccountLogs] = useState<EngagementLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<null | "follow" | "retweet" | "comment" | "reply">(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ActionDrafts>({
    followHandle: "",
    repostPostId: "",
    commentPostId: "",
    commentText: "",
    replyPostId: "",
    replyText: "",
  });

  const loadAccountLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const session = await getLiveSession();
      const response = await listConnectorRequests({
        workspaceId: session.selected_workspace.id,
        accountId: id,
        limit: 200,
      });
      const logs = response.items
        .map(mapConnectorRequestToEngagementLog)
        .filter((item): item is EngagementLog => Boolean(item))
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      const unresolvedPostIds = Array.from(new Set(
        logs
          .filter((item) => !item.targetPostText && item.targetPostId)
          .map((item) => item.targetPostId as string),
      ));

      if (unresolvedPostIds.length > 0) {
        const lookup = await lookupPostsOnX(id, { post_ids: unresolvedPostIds });
        const postTextById = new Map(lookup.posts.map((item) => [item.external_post_id, item.content]));
        setAccountLogs(logs.map((item) => ({
          ...item,
          targetPostText: item.targetPostText ?? (item.targetPostId ? postTextById.get(item.targetPostId) : undefined),
        })));
      } else {
        setAccountLogs(logs);
      }
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "加载互动日志失败");
    } finally {
      setLogsLoading(false);
    }
  }, [id]);

  const loadAutomationOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const overview = await getAccountAutomationOverview(id);
      setAutomationOverview(overview);
    } catch (error) {
      setAutomationOverview(null);
      setOverviewError(error instanceof Error ? error.message : "加载自动化状态失败");
    } finally {
      setOverviewLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAccountLogs();
  }, [loadAccountLogs]);

  useEffect(() => {
    void loadAutomationOverview();
  }, [loadAutomationOverview]);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setConfigLoading(true);
      setConfigError(null);
      try {
        const response = await getEngagementPolicy(id);
        if (cancelled) {
          return;
        }

        setConfig(response ? mapPolicyToConfig(response.policy.policy_body) : DEFAULT_ENGAGEMENT_CONFIG);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setConfig(DEFAULT_ENGAGEMENT_CONFIG);
        setConfigError(error instanceof Error ? error.message : "加载互动配置失败");
      } finally {
        if (!cancelled) {
          setConfigLoading(false);
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateField = <K extends keyof EngagementConfig>(key: K, value: EngagementConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setConfigError(null);
  };

  const policyValidationIssues = useMemo(() => {
    return validateEngagementConfig(config, automationOverview?.account_handle);
  }, [automationOverview?.account_handle, config]);

  const handleSave = async () => {
    setConfigError(null);
    if (policyValidationIssues.length > 0) {
      setSaved(false);
      setConfigError(`请先修正互动配置：\n${policyValidationIssues.map((issue) => `- ${issue}`).join("\n")}`);
      return;
    }

    try {
      await upsertEngagementPolicy(id, {
        policy_body: mapConfigToPolicy(config),
        status: isAnyAutomationEnabled(config) ? "active" : "paused",
      });
      await loadAutomationOverview();
      setSaved(true);
      notifyAccountReadinessChanged(id);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setSaved(false);
      setConfigError(error instanceof Error ? translateEngagementPolicySaveError(error.message) : "保存互动配置失败");
    }
  };

  const runAction = async (type: "follow" | "retweet" | "comment" | "reply") => {
    setRunningAction(type);
    setActionMessage(null);
    try {
      if (type === "follow") {
        await followAccountOnX(id, { target_handle: drafts.followHandle });
        setDrafts((prev) => ({ ...prev, followHandle: "" }));
      } else if (type === "retweet") {
        await repostPostOnX(id, { target_post_id: drafts.repostPostId });
        setDrafts((prev) => ({ ...prev, repostPostId: "" }));
      } else if (type === "comment") {
        await commentOnPostOnX(id, {
          target_post_id: drafts.commentPostId,
          text: drafts.commentText,
        });
        setDrafts((prev) => ({ ...prev, commentPostId: "", commentText: "" }));
      } else {
        await replyToPostOnX(id, {
          target_post_id: drafts.replyPostId,
          text: drafts.replyText,
        });
        setDrafts((prev) => ({ ...prev, replyPostId: "", replyText: "" }));
      }

      setActionMessage("真实动作已提交并写入日志。");
      await loadAutomationOverview();
      await loadAccountLogs();
      notifyAccountReadinessChanged(id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setRunningAction(null);
    }
  };

  // Today's stats
  const todayStr = new Date().toDateString();
  const todayCount = {
    follow: accountLogs.filter((l) => l.type === "follow" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr).length,
    retweet: accountLogs.filter((l) => l.type === "retweet" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr).length,
    comment: accountLogs.filter((l) => l.type === "comment" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr).length,
    reply: accountLogs.filter((l) => l.type === "reply" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr).length,
  };
  const todayLogs = useMemo(
    () => ({
      follow: accountLogs.filter((l) => l.type === "follow" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr),
      retweet: accountLogs.filter((l) => l.type === "retweet" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr),
      comment: accountLogs.filter((l) => l.type === "comment" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr),
      reply: accountLogs.filter((l) => l.type === "reply" && l.status === "succeeded" && new Date(l.at).toDateString() === todayStr),
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
  const chosenAction = automationOverview?.evaluation.chosen_action;
  const latestFailure = getLatestAutomationFailure(automationOverview, "engagement");
  const statusLabel = getAutomationStatusLabel(automationOverview?.orchestration_status ?? "inactive");
  const statusHint = automationOverview
    ? `今日 关注 ${automationOverview.engagement_automation.today_follow_count} / 转发 ${automationOverview.engagement_automation.today_repost_count} / 评论 ${automationOverview.engagement_automation.today_comment_count} / 回复 ${automationOverview.engagement_automation.today_reply_count}`
    : "还没有取到真实互动自动化状态。";
  const nextActionLabel = chosenAction?.type === "no_action"
    ? getBlockedReasonLabel(chosenAction.reason_code)
    : getActionLabel(chosenAction?.type);
  const nextActionHint = translateAutomationRationale(chosenAction?.rationale)
    ?? translateAutomationRationale(automationOverview?.evaluation.rationale)
    ?? "当前没有新的互动动作。";
  const issueLabel = latestFailure
    ? (latestFailure.is_isolated_failure ? "最近隔离失败" : "最近失败")
    : "下一次调度";
  const issueHint = latestFailure
    ? `${translateAutomationErrorMessage(latestFailure.error_message) ?? latestFailure.error_code ?? "互动自动化执行失败"}${latestFailure.is_isolated_failure ? "；这次异常已与自动发帖主链隔离。" : ""}`
    : `下次检查 ${formatAutomationDateTime(automationOverview?.state?.next_tick_after ?? automationOverview?.next_due_at)}`;

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1 flex items-center gap-2">
        <Activity className="w-5 h-5" />
        社交互动自动化
      </h2>
      <p className="text-[#999999] text-sm mb-6">让账号自动去关注、转发、评论、回复 —— 看起来像真人，而不是只会发推的机器</p>
      {configError ? <p className="mb-4 whitespace-pre-line text-sm text-red-500">{configError}</p> : null}
      {policyValidationIssues.length > 0 ? (
        <div className="mb-4 rounded-xl border border-[#F4D4D4] bg-[#FFF7F7] p-3 text-xs text-[#9B2C2C]">
          <p className="font-medium">保存前需要修正：</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {policyValidationIssues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-[#E8E8E8] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#111111]">当前互动自动化状态</p>
            <p className="text-xs text-[#999999] mt-1">这里展示后端真实调度结果，旧坏配置也会直接暴露出来。</p>
          </div>
          <Button variant="outline" onClick={() => void loadAutomationOverview()} disabled={overviewLoading}>
            {overviewLoading ? "刷新中..." : "刷新状态"}
          </Button>
        </div>
        {overviewError ? (
          <p className="mt-3 text-sm text-[#E05252]">{overviewError}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">当前状态</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{statusLabel}</p>
              <p className="mt-2 text-xs text-[#666666]">{statusHint}</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">当前阻塞 / 下一步</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{nextActionLabel}</p>
              <p className="mt-2 text-xs text-[#666666]">{nextActionHint}</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">异常 / 调度</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{issueLabel}</p>
              <p className="mt-2 text-xs text-[#666666]">{issueHint}</p>
            </div>
          </div>
        )}
      </div>

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
                <label className="text-xs text-[#999999] mb-1 block">广场搜索关键词</label>
                <TraitTagInput
                  tags={config.autoRetweet.keywords}
                  onChange={(tags) => updateField("autoRetweet", { ...config.autoRetweet, keywords: tags })}
                  placeholder="输入公开搜索词后按 Enter，例如：AI agent、DeFi、BTC ETF"
                />
                <p className="text-xs text-[#999999] mt-1">系统会在这些公开搜索词基础上，自动参考当前活跃 trends 扩展广场候选池。</p>
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
                <label className="text-xs text-[#999999] mb-1 block">评论目标账号 / 广场搜索词</label>
                <TraitTagInput
                  tags={config.autoComment.targets}
                  onChange={(tags) => updateField("autoComment", { ...config.autoComment, targets: tags })}
                  placeholder="@handle 或关键词后按 Enter，例如：@WuBlockchain、AI agent、深圳美食"
                />
                <p className="text-xs text-[#999999] mt-1">以 @ 开头的项会抓该账号时间线；普通文本会走公开推文搜索，并自动参考当前活跃 trends 扩展广场候选池。</p>
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
              <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#111111]">回复提案需人工审核</p>
                    <p className="mt-1 text-xs text-[#777777]">
                      开启：AI 先生成待审回复，进入处理队列；关闭：提案生成后自动排入发送任务。
                    </p>
                  </div>
                  <Switch
                    checked={config.autoReply.requireManualApproval}
                    onCheckedChange={(v) => updateField("autoReply", { ...config.autoReply, requireManualApproval: v })}
                  />
                </div>
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

          <Button onClick={() => void handleSave()} className="w-full" disabled={configLoading}>保存互动配置</Button>
          {saved && <p className="text-[#00BA7C] text-sm text-center">✓ 配置已保存</p>}
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[#111111] font-semibold text-sm">真实动作执行</h3>
                <p className="text-xs text-[#999999] mt-1">直接调用当前账号已绑定的 X 凭证，成功后会出现在今日统计和详情里。</p>
              </div>
              <Button variant="outline" onClick={() => void loadAccountLogs()} disabled={logsLoading}>刷新日志</Button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <Input
                  placeholder="要关注的账号，例如 @ai_inty"
                  value={drafts.followHandle}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, followHandle: e.target.value }))}
                />
                <Button onClick={() => void runAction("follow")} disabled={runningAction !== null || !drafts.followHandle.trim()}>
                  {runningAction === "follow" ? "执行中..." : "执行关注"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <Input
                  placeholder="要转发的推文 ID"
                  value={drafts.repostPostId}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, repostPostId: e.target.value }))}
                />
                <Button onClick={() => void runAction("retweet")} disabled={runningAction !== null || !drafts.repostPostId.trim()}>
                  {runningAction === "retweet" ? "执行中..." : "执行转发"}
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-[#E8E8E8] p-3">
                <Input
                  placeholder="要评论的推文 ID"
                  value={drafts.commentPostId}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, commentPostId: e.target.value }))}
                />
                <Input
                  placeholder="评论内容"
                  value={drafts.commentText}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, commentText: e.target.value }))}
                />
                <Button onClick={() => void runAction("comment")} disabled={runningAction !== null || !drafts.commentPostId.trim() || !drafts.commentText.trim()}>
                  {runningAction === "comment" ? "执行中..." : "执行评论"}
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border border-[#E8E8E8] p-3">
                <Input
                  placeholder="要回复的推文 ID"
                  value={drafts.replyPostId}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, replyPostId: e.target.value }))}
                />
                <Input
                  placeholder="回复内容"
                  value={drafts.replyText}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, replyText: e.target.value }))}
                />
                <Button onClick={() => void runAction("reply")} disabled={runningAction !== null || !drafts.replyPostId.trim() || !drafts.replyText.trim()}>
                  {runningAction === "reply" ? "执行中..." : "执行回复"}
                </Button>
              </div>
            </div>
            {actionMessage ? <p className="mt-3 text-xs text-[#666666]">{actionMessage}</p> : null}
            {logsError ? <p className="mt-2 text-xs text-red-500">{logsError}</p> : null}
          </div>

          {/* Right: Engagement Log */}
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 h-fit">
            <h3 className="text-[#111111] font-semibold text-sm mb-4">真实互动日志（近 7 天）</h3>
            <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
            {logsLoading ? (
              <p className="text-[#999999] text-sm text-center py-10">加载中...</p>
            ) : null}
            {!logsLoading && accountLogs.length === 0 && (
              <p className="text-[#999999] text-sm text-center py-10">暂无真实互动记录</p>
            )}
            {!logsLoading && accountLogs.map((log) => {
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
                      <span className="font-medium">{log.targetHandle ?? log.targetPostId ?? "目标对象"}</span>
                    </p>
                    {log.targetPostId && <p className="text-xs text-[#999999] mt-1 truncate">目标 ID：{log.targetPostId}</p>}
                    {log.targetPostText && <p className="text-xs text-[#666666] mt-1 line-clamp-2">原文：{log.targetPostText}</p>}
                    {log.commentText && <p className="text-xs text-[#111111] mt-1 truncate">💬 {log.commentText}</p>}
                    {log.replyText && <p className="text-xs text-[#111111] mt-1 truncate">↩️ {log.replyText}</p>}
                    {log.status !== "succeeded" ? <p className="text-[10px] text-red-500 mt-1">{log.errorMessage ?? `状态：${log.status}`}</p> : null}
                    <p className="text-[10px] text-[#999999] mt-1">{timeAgo(log.at)}</p>
                  </div>
                </div>
              );
            })}
            </div>
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
                          <span className="font-medium">{log.targetHandle ?? log.targetPostId ?? "目标对象"}</span>
                        </p>
                        <span className="text-xs text-[#999999]">{timeAgo(log.at)}</span>
                      </div>
                      {log.targetPostId ? <p className="mt-2 text-sm text-[#666666]">目标推文 ID：{log.targetPostId}</p> : null}
                      {log.targetPostText ? <p className="mt-2 text-sm text-[#666666]">推文原文：{log.targetPostText}</p> : null}
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

function isAnyAutomationEnabled(config: EngagementConfig) {
  return config.autoFollow.enabled || config.autoRetweet.enabled || config.autoComment.enabled || config.autoReply.enabled;
}

function validateEngagementConfig(config: EngagementConfig, accountHandle?: string) {
  const issues: string[] = [];
  const selfHandle = normalizeLocalHandle(accountHandle);
  const autoFollowRules = config.autoFollow.rules.map((rule) => rule.value);
  const autoFollowTargets = splitLocalTargets(autoFollowRules);
  const autoRetweetTargets = splitLocalTargets(config.autoRetweet.whitelist);
  const autoCommentTargets = splitLocalTargets(config.autoComment.targets);

  if (config.autoFollow.enabled) {
    if (config.autoFollow.maxPerDay < 1) {
      issues.push("自动关注：每日最多关注数必须大于 0。");
    }
    if (!hasExternalHandleOrQuery(autoFollowTargets, selfHandle)) {
      issues.push("自动关注：至少添加一个外部 @账号 或关键词，不能只填当前账号自己。");
    }
  }

  if (config.autoRetweet.enabled) {
    if (config.autoRetweet.maxPerDay < 1) {
      issues.push("自动转发：每日上限必须大于 0。");
    }
    if (config.autoRetweet.delayMin < 0 || config.autoRetweet.delayMax < config.autoRetweet.delayMin) {
      issues.push("自动转发：延迟范围必须有效，最大值不能小于最小值。");
    }
    if (!hasExternalHandleOrQuery({
      handles: autoRetweetTargets.handles,
      queries: [...autoRetweetTargets.queries, ...nonEmptyStrings(config.autoRetweet.keywords)],
    }, selfHandle)) {
      issues.push("自动转发：至少添加一个外部白名单 @账号 或广场搜索关键词。");
    }
  }

  if (config.autoComment.enabled) {
    if (config.autoComment.maxPerDay < 1) {
      issues.push("自动评论：每日评论上限必须大于 0。");
    }
    if (!hasExternalHandleOrQuery(autoCommentTargets, selfHandle)) {
      issues.push("自动评论：至少添加一个外部 @账号 或广场搜索词。");
    }
  }

  if (config.autoReply.enabled) {
    if (config.autoReply.maxPerDay < 1) {
      issues.push("自动回复：每日回复上限必须大于 0。");
    }
    if (config.autoReply.triggerTypes.length === 0) {
      issues.push("自动回复：至少选择一种触发类型。");
    }
  }

  return issues;
}

function splitLocalTargets(values: string[]) {
  const handles: string[] = [];
  const queries: string[] = [];
  for (const value of nonEmptyStrings(values)) {
    if (value.startsWith("@")) {
      handles.push(normalizeLocalHandle(value));
    } else {
      queries.push(value);
    }
  }

  return { handles, queries };
}

function hasExternalHandleOrQuery(input: { handles: string[]; queries: string[] }, selfHandle: string) {
  return input.queries.length > 0 || input.handles.some((handle) => handle !== "" && handle !== selfHandle);
}

function nonEmptyStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeLocalHandle(value: string | undefined) {
  const normalized = (value ?? "").trim().replace(/^@+/, "");
  return normalized ? `@${normalized}`.toLowerCase() : "";
}

function translateEngagementPolicySaveError(message: string) {
  if (/auto comment targets/i.test(message)) {
    return "自动评论配置无效：请至少添加一个外部 @账号 或广场搜索词，不能只填当前账号自己。";
  }
  if (/auto repost config/i.test(message)) {
    return "自动转发配置无效：请至少添加一个外部白名单 @账号 或广场搜索关键词。";
  }
  if (/auto follow rules/i.test(message)) {
    return "自动关注配置无效：请至少添加一个外部 @账号 或关键词，不能只填当前账号自己。";
  }

  return message;
}

function mapPolicyToConfig(policy: EngagementPolicyResponse["policy"]["policy_body"]): EngagementConfig {
  const autoFollow = policy.auto_follow ?? { enabled: false, max_per_day: 15, rules: [] };
  const autoRetweet = policy.auto_retweet ?? {
    enabled: false,
    max_per_day: 3,
    min_likes: 0,
    whitelist: [],
    keywords: [],
    delay_min_minutes: 30,
    delay_max_minutes: 120,
    quote_tweet_enabled: false,
  };
  const autoComment = policy.auto_comment ?? {
    enabled: false,
    max_per_day: 5,
    target_handles: [],
    style: "supportive" as const,
    mode: "latest" as const,
  };
  const autoReply = policy.auto_reply ?? {
    enabled: false,
    max_per_day: 30,
    trigger_types: ["mention", "reply"] as Array<"mention" | "reply" | "dm" | "comment">,
    only_followers: false,
    style: "grateful" as const,
  };

  return {
    autoFollow: {
      enabled: Boolean(autoFollow.enabled),
      maxPerDay: autoFollow.max_per_day,
      rules: autoFollow.rules.map((rule) => ({ type: "keyword", value: rule.value })),
    },
    autoRetweet: {
      enabled: Boolean(autoRetweet.enabled),
      maxPerDay: autoRetweet.max_per_day,
      minLikes: autoRetweet.min_likes,
      whitelist: autoRetweet.whitelist,
      keywords: autoRetweet.keywords ?? [],
      delayMin: autoRetweet.delay_min_minutes,
      delayMax: autoRetweet.delay_max_minutes,
      quoteTweetEnabled: Boolean(autoRetweet.quote_tweet_enabled),
    },
    autoComment: {
      enabled: Boolean(autoComment.enabled),
      maxPerDay: autoComment.max_per_day,
      targets: autoComment.target_handles,
      style: autoComment.style,
      mode: autoComment.mode,
    },
    autoReply: {
      enabled: Boolean(autoReply.enabled),
      maxPerDay: autoReply.max_per_day,
      triggerTypes: autoReply.trigger_types,
      onlyFollowers: Boolean(autoReply.only_followers),
      requireManualApproval: Boolean(policy.require_manual_approval),
      keywords: [],
      style: autoReply.style,
    },
  };
}

function mapConfigToPolicy(config: EngagementConfig) {
  const autoCommentStyle: "supportive" | "questioning" | "value-add" = (
    config.autoComment.style === "supportive" || config.autoComment.style === "questioning" || config.autoComment.style === "value-add"
  ) ? config.autoComment.style : "supportive";
  const autoReplyStyle: "grateful" | "interactive" | "brief" = (
    config.autoReply.style === "grateful" || config.autoReply.style === "interactive" || config.autoReply.style === "brief"
  ) ? config.autoReply.style : "grateful";

  return {
    allowed_channels: config.autoReply.triggerTypes
      .filter((item): item is "mention" | "reply" | "dm" | "comment" => item === "mention" || item === "reply" || item === "dm" || item === "comment"),
    blocked_classifications: [] as Array<"collab" | "commerce" | "spam" | "normal" | "support">,
    require_manual_approval: config.autoReply.enabled ? config.autoReply.requireManualApproval : true,
    auto_follow: {
      enabled: config.autoFollow.enabled,
      max_per_day: config.autoFollow.maxPerDay,
      rules: config.autoFollow.rules.map((rule) => ({
        type: "keyword" as const,
        value: rule.value,
      })),
    },
    auto_retweet: {
      enabled: config.autoRetweet.enabled,
      max_per_day: config.autoRetweet.maxPerDay,
      min_likes: config.autoRetweet.minLikes,
      whitelist: config.autoRetweet.whitelist,
      keywords: config.autoRetweet.keywords,
      delay_min_minutes: config.autoRetweet.delayMin,
      delay_max_minutes: config.autoRetweet.delayMax,
      quote_tweet_enabled: config.autoRetweet.quoteTweetEnabled,
    },
    auto_comment: {
      enabled: config.autoComment.enabled,
      max_per_day: config.autoComment.maxPerDay,
      target_handles: config.autoComment.targets,
      style: autoCommentStyle,
      mode: config.autoComment.mode === "random" ? "random" as const : "latest" as const,
    },
    auto_reply: {
      enabled: config.autoReply.enabled,
      max_per_day: config.autoReply.maxPerDay,
      trigger_types: config.autoReply.triggerTypes
        .filter((item): item is "mention" | "reply" | "dm" | "comment" => item === "mention" || item === "reply" || item === "dm" || item === "comment"),
      only_followers: config.autoReply.onlyFollowers,
      style: autoReplyStyle,
    },
  };
}
