"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Bell, MessageCircle, Loader2, CheckCircle, RefreshCw, Trash2, ArrowRight, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createAlertChannel,
  deleteAlertChannel,
  getAccountAutomationOverview,
  getAccountReadiness,
  getMonitoringOverview,
  listAlertChannels,
  listAccounts,
  retryMonitoringQueueBacklog,
  triggerAccountAutomationTick,
  type AccountAutomationOverviewResponse,
  type AccountReadinessResponse,
  type BackendAccount,
  updateAlertChannel,
  type BackendAlertChannel,
  type BackendMonitoringOperatorQueueItem,
  type BackendOperationsOverviewResponse,
  type MonitoringFeedItem,
} from "@/lib/live-api";
import {
  formatAutomationDateTime,
  getActionLabel,
  getAutomationStatusLabel,
  getAutopostRunStatusLabel,
  getBlockedReasonLabel,
  getLatestFailedAutomationRun,
  getLatestIsolatedAutomationFailure,
  getRecommendedOperatorTarget,
  translateAutomationErrorMessage,
  translateAutomationRationale,
} from "@/lib/account-automation-ui";
import { getLiveSession } from "@/lib/session-client";

const FEED_KIND_CONFIG: Record<string, { label: string; variant: "collab" | "commerce" | "spam" | "secondary"; emoji: string }> = {
  alert: { label: "系统告警", variant: "spam", emoji: "⚠️" },
  notification: { label: "通知", variant: "secondary", emoji: "🔔" },
  risk_event: { label: "风险事件", variant: "commerce", emoji: "🛡️" },
  operator_queue: { label: "待处理", variant: "collab", emoji: "⚡" },
};

const ALERT_SEVERITY_OPTIONS: Array<{
  value: BackendAlertChannel["routing_body"]["minimum_severity"];
  label: string;
}> = [
  { value: "info", label: "全部告警" },
  { value: "warning", label: "警告及以上" },
  { value: "critical", label: "仅严重故障" },
];

const ALERT_SOURCE_OPTIONS: Array<{
  value: BackendAlertChannel["routing_body"]["source_types"][number];
  label: string;
}> = [
  { value: "connector", label: "连接器 / 抓取" },
  { value: "runtime", label: "运行时 / 调度" },
  { value: "publish", label: "发布" },
  { value: "risk", label: "风控" },
];

type AlertChannelKind = BackendAlertChannel["kind"];
type MonitoringTab = "messages" | "diagnostics" | "alerts";

function getOperatorErrorCategoryLabel(category?: BackendMonitoringOperatorQueueItem["error_category"]) {
  switch (category) {
    case "configuration_error":
      return "配置问题";
    case "temporary_external_error":
      return "外部临时异常";
    case "rate_limited":
      return "平台限流";
    case "operator_required":
      return "需要人工处理";
    case "system_failure":
      return "系统执行异常";
    default:
      return "未分类";
  }
}

interface AlertChannelDraft {
  id?: string;
  name: string;
  enabled: boolean;
  minimumSeverity: BackendAlertChannel["routing_body"]["minimum_severity"];
  sourceTypes: BackendAlertChannel["routing_body"]["source_types"];
  destinationHint?: string;
  duplicateCount: number;
  webhookUrl: string;
  signingSecret: string;
  botToken: string;
  chatId: string;
}

interface AccountDiagnosticItem {
  account: BackendAccount;
  readiness?: AccountReadinessResponse;
  overview?: AccountAutomationOverviewResponse;
  error?: string;
}

type MonitoringTimelineItem = {
  id: string;
  kind: MonitoringFeedItem["kind"] | "operator_queue";
  title: string;
  detail: string;
  created_at: string;
  severity?: string;
  status?: BackendMonitoringOperatorQueueItem["status"];
  blocking_chain?: string;
  recommended_action?: string;
  error_category?: BackendMonitoringOperatorQueueItem["error_category"];
  error_user_message?: string;
  retry_advice?: string;
  auto_retry_recommended?: boolean;
  target_url?: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

function buildDefaultDraft(kind: AlertChannelKind): AlertChannelDraft {
  return {
    name: kind === "lark_webhook" ? "Lark Alerts" : "Telegram Alerts",
    enabled: false,
    minimumSeverity: "warning",
    sourceTypes: ["connector", "runtime", "publish", "risk"],
    destinationHint: undefined,
    duplicateCount: 0,
    webhookUrl: "",
    signingSecret: "",
    botToken: "",
    chatId: "",
  };
}

function sortSourceTypes(values: BackendAlertChannel["routing_body"]["source_types"]) {
  const order = new Map(ALERT_SOURCE_OPTIONS.map((item, index) => [item.value, index]));
  return Array.from(new Set(values)).sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function getOverallStatusLabel(status?: AccountReadinessResponse["overall_status"]) {
  switch (status) {
    case "ready":
      return "已就绪";
    case "warning":
      return "需关注";
    case "blocked":
      return "存在阻塞";
    default:
      return "未评估";
  }
}

function getOverallStatusTone(status?: AccountReadinessResponse["overall_status"]) {
  switch (status) {
    case "ready":
      return "border-[#D7F3E6] bg-[#F4FCF8] text-[#00BA7C]";
    case "warning":
      return "border-[#F3E6C7] bg-[#FFF9EF] text-[#C58A00]";
    case "blocked":
      return "border-[#F5D3D0] bg-[#FFF5F4] text-[#D93025]";
    default:
      return "border-[#E8E8E8] bg-[#FAFAFA] text-[#777777]";
  }
}

function getDiagnosticSortWeight(item: AccountDiagnosticItem) {
  if (item.error) {
    return 0;
  }

  if (item.readiness?.overall_status === "blocked") {
    return 1;
  }

  if (getLatestFailedAutomationRun(item.overview ?? null)) {
    return 2;
  }

  if (item.readiness?.overall_status === "warning") {
    return 3;
  }

  if (item.overview?.active_autopost_run) {
    return 4;
  }

  return 5;
}

function listIssueChecks(readiness?: AccountReadinessResponse) {
  if (!readiness) {
    return [];
  }

  const labels: Record<keyof AccountReadinessResponse["checks"], string> = {
    credential: "凭证",
    profile: "资料",
    persona: "人格",
    sources: "信息源",
    autopost: "发帖",
    engagement: "互动",
  };

  return (Object.entries(readiness.checks) as Array<[keyof AccountReadinessResponse["checks"], AccountReadinessResponse["checks"][keyof AccountReadinessResponse["checks"]]]>)
    .filter(([, check]) => check.status !== "ready")
    .map(([key]) => labels[key]);
}

function getOperationsHealthLabel(status?: BackendOperationsOverviewResponse["summary"]["health_status"]) {
  switch (status) {
    case "healthy":
      return "健康";
    case "degraded":
      return "降级";
    case "unhealthy":
      return "异常";
    default:
      return "未知";
  }
}

function getOperationsHealthTone(status?: BackendOperationsOverviewResponse["summary"]["health_status"]) {
  switch (status) {
    case "healthy":
      return "border-[#D7F3E6] bg-[#F4FCF8] text-[#00BA7C]";
    case "degraded":
      return "border-[#F3E6C7] bg-[#FFF9EF] text-[#C58A00]";
    case "unhealthy":
      return "border-[#F5D3D0] bg-[#FFF5F4] text-[#D93025]";
    default:
      return "border-[#E8E8E8] bg-[#FAFAFA] text-[#777777]";
  }
}

function getQueueMetricLabel(kind: BackendOperationsOverviewResponse["queue_metrics"][number]["kind"]) {
  switch (kind) {
    case "agent_task":
      return "Agent 任务";
    case "worker_job":
      return "Worker Job";
    case "publish_job":
      return "发布任务";
    case "source_fetch_run":
      return "信息源抓取";
    default:
      return kind;
  }
}

function formatRuntimeAge(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

function pickPrimaryChannel(channels: BackendAlertChannel[], kind: AlertChannelKind): AlertChannelDraft {
  const matches = channels
    .filter((channel) => channel.kind === kind)
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "active" ? -1 : 1;
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

  const primary = matches[0];
  if (!primary) {
    return buildDefaultDraft(kind);
  }

  return {
    id: primary.id,
    name: primary.name,
    enabled: primary.status === "active",
    minimumSeverity: primary.routing_body.minimum_severity,
    sourceTypes: sortSourceTypes(primary.routing_body.source_types),
    destinationHint: primary.destination_hint,
    duplicateCount: matches.length,
    webhookUrl: "",
    signingSecret: "",
    botToken: "",
    chatId: "",
  };
}

function hasDestinationInput(draft: AlertChannelDraft, kind: AlertChannelKind) {
  if (kind === "lark_webhook") {
    return draft.webhookUrl.trim() !== "" || draft.signingSecret.trim() !== "";
  }

  return draft.botToken.trim() !== "" || draft.chatId.trim() !== "";
}

function buildChannelError(kind: AlertChannelKind, draft: AlertChannelDraft, mode: "create" | "update"): string | null {
  if (kind === "lark_webhook") {
    if (mode === "create" && draft.webhookUrl.trim() === "") {
      return "创建 Lark 渠道前必须填写完整 Webhook URL。";
    }

    if (mode === "update" && hasDestinationInput(draft, kind) && draft.webhookUrl.trim() === "") {
      return "更新 Lark 目的地时，请重新填写完整 Webhook URL。";
    }

    return null;
  }

  if (mode === "create" && (!draft.botToken.trim() || !draft.chatId.trim())) {
    return "创建 Telegram 渠道前必须填写 Bot Token 和 Chat ID。";
  }

  if (mode === "update" && hasDestinationInput(draft, kind) && (!draft.botToken.trim() || !draft.chatId.trim())) {
    return "更新 Telegram 目的地时，请重新填写完整 Bot Token 和 Chat ID。";
  }

  return null;
}

export default function MonitoringPage() {
  const [timelineItems, setTimelineItems] = useState<MonitoringTimelineItem[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<MonitoringTimelineItem | null>(null);
  const [operations, setOperations] = useState<BackendOperationsOverviewResponse | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesNotice, setMessagesNotice] = useState<string | null>(null);
  const [retryingBacklog, setRetryingBacklog] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState<MonitoringTab>("messages");
  const [larkDraft, setLarkDraft] = useState<AlertChannelDraft>(buildDefaultDraft("lark_webhook"));
  const [telegramDraft, setTelegramDraft] = useState<AlertChannelDraft>(buildDefaultDraft("telegram_bot"));
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [channelErrors, setChannelErrors] = useState<Partial<Record<AlertChannelKind, string>>>({});
  const [savingKind, setSavingKind] = useState<AlertChannelKind | null>(null);
  const [deletingKind, setDeletingKind] = useState<AlertChannelKind | null>(null);
  const [savedKind, setSavedKind] = useState<AlertChannelKind | null>(null);
  const [diagnostics, setDiagnostics] = useState<AccountDiagnosticItem[]>([]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnosticsNotice, setDiagnosticsNotice] = useState<string | null>(null);
  const [tickingAccountId, setTickingAccountId] = useState<string | null>(null);

  const filtered = timelineItems.filter((message) => filterCategory === "all" || message.kind === filterCategory);

  const handleSelect = (message: MonitoringTimelineItem) => {
    setSelectedMsg(message);
  };

  const loadMessages = useCallback(async () => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const session = await getLiveSession();
      const response = await getMonitoringOverview(session.selected_workspace.id, 30);
      const queueItems: MonitoringTimelineItem[] = response.operator_queues.map((item) => ({
        id: `operator_queue:${item.kind}:${item.id}`,
        kind: "operator_queue",
        title: item.title,
        detail: item.subtitle,
        created_at: item.created_at,
        severity: item.status === "failed" ? "critical" : "warning",
        status: item.status,
        blocking_chain: item.blocking_chain,
        recommended_action: item.recommended_action,
        error_category: item.error_category,
        error_user_message: item.error_user_message,
        retry_advice: item.retry_advice,
        auto_retry_recommended: item.auto_retry_recommended,
        target_url: item.target_url,
      }));
      const feedItems: MonitoringTimelineItem[] = response.feed.map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        detail: item.detail,
        created_at: item.created_at,
        severity: item.severity,
      }));
      const nextItems = [...queueItems, ...feedItems].sort((left, right) => (
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ));
      setTimelineItems(nextItems);
      setOperations(response.operations);
      setSelectedMsg((current) => {
        if (!current) {
          return nextItems[0] ?? null;
        }

        return nextItems.find((item) => item.id === current.id) ?? nextItems[0] ?? null;
      });
      setUnreadCount(response.summary.unread_notifications);
    } catch (cause) {
      setTimelineItems([]);
      setSelectedMsg(null);
      setOperations(null);
      setUnreadCount(0);
      setMessagesError(cause instanceof Error ? cause.message : "加载监控消息失败");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const retryFailedBacklog = async () => {
    setRetryingBacklog(true);
    setMessagesError(null);
    setMessagesNotice(null);
    try {
      const session = await getLiveSession();
      const result = await retryMonitoringQueueBacklog({
        workspace_id: session.selected_workspace.id,
        limit: 20,
        retry_mode: "safe",
      });
      setMessagesNotice(`安全重试完成：已重试 ${result.summary.retried_items} 个可恢复失败项，跳过 ${result.summary.skipped_items ?? 0} 个需要先处理条件的项目；${result.summary.failed_items} 个重试失败。`);
      await loadMessages();
    } catch (cause) {
      setMessagesError(cause instanceof Error ? cause.message : "重试失败队列失败");
    } finally {
      setRetryingBacklog(false);
    }
  };

  const loadDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    setDiagnosticsNotice(null);
    try {
      const session = await getLiveSession();
      const accountResponse = await listAccounts(session.selected_workspace.id);
      const rows = await Promise.all(accountResponse.accounts.map(async (account) => {
        const [readinessResult, overviewResult] = await Promise.allSettled([
          getAccountReadiness(account.id),
          getAccountAutomationOverview(account.id),
        ]);

        const readiness = readinessResult.status === "fulfilled" ? readinessResult.value : undefined;
        const overview = overviewResult.status === "fulfilled" ? overviewResult.value : undefined;
        const errorParts = [
          readinessResult.status === "rejected"
            ? (readinessResult.reason instanceof Error ? readinessResult.reason.message : "readiness 加载失败")
            : undefined,
          overviewResult.status === "rejected"
            ? (overviewResult.reason instanceof Error ? overviewResult.reason.message : "automation overview 加载失败")
            : undefined,
        ].filter((value): value is string => Boolean(value));

        return {
          account,
          readiness,
          overview,
          error: errorParts.length > 0 ? errorParts.join(" · ") : undefined,
        } satisfies AccountDiagnosticItem;
      }));

      rows.sort((left, right) => {
        const weightDiff = getDiagnosticSortWeight(left) - getDiagnosticSortWeight(right);
        if (weightDiff !== 0) {
          return weightDiff;
        }

        const leftDue = left.overview?.next_due_at ?? "";
        const rightDue = right.overview?.next_due_at ?? "";
        if (leftDue !== rightDue) {
          return rightDue.localeCompare(leftDue);
        }

        return left.account.handle.localeCompare(right.account.handle);
      });

      setDiagnostics(rows);
    } catch (cause) {
      setDiagnostics([]);
      setDiagnosticsError(cause instanceof Error ? cause.message : "加载账号运行诊断失败");
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  const loadAlertChannels = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    setChannelErrors({});
    try {
      const session = await getLiveSession();
      const response = await listAlertChannels(session.selected_workspace.id, 100);
      setLarkDraft(pickPrimaryChannel(response.channels, "lark_webhook"));
      setTelegramDraft(pickPrimaryChannel(response.channels, "telegram_bot"));
    } catch (cause) {
      setLarkDraft(buildDefaultDraft("lark_webhook"));
      setTelegramDraft(buildDefaultDraft("telegram_bot"));
      setAlertsError(cause instanceof Error ? cause.message : "加载报警配置失败");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "messages") {
      void loadMessages();
    }
  }, [activeTab, loadMessages]);

  useEffect(() => {
    if (activeTab === "alerts") {
      void loadAlertChannels();
    }
  }, [activeTab, loadAlertChannels]);

  useEffect(() => {
    if (activeTab === "diagnostics") {
      void loadDiagnostics();
    }
  }, [activeTab, loadDiagnostics]);

  const updateDraft = (kind: AlertChannelKind, updater: (current: AlertChannelDraft) => AlertChannelDraft) => {
    setChannelErrors((prev) => ({ ...prev, [kind]: undefined }));
    setSavedKind(null);
    if (kind === "lark_webhook") {
      setLarkDraft((current) => updater(current));
      return;
    }

    setTelegramDraft((current) => updater(current));
  };

  const persistChannel = async (kind: AlertChannelKind) => {
    const draft = kind === "lark_webhook" ? larkDraft : telegramDraft;
    const mode = draft.id ? "update" : "create";
    const validationError = buildChannelError(kind, draft, mode);
    if (validationError) {
      setChannelErrors((prev) => ({ ...prev, [kind]: validationError }));
      return;
    }

    setSavingKind(kind);
    setChannelErrors((prev) => ({ ...prev, [kind]: undefined }));
    setAlertsError(null);

    try {
      if (!draft.id) {
        const session = await getLiveSession();
        await createAlertChannel({
          workspace_id: session.selected_workspace.id,
          name: draft.name.trim() || (kind === "lark_webhook" ? "Lark Alerts" : "Telegram Alerts"),
          kind,
          status: draft.enabled ? "active" : "paused",
          routing_body: {
            minimum_severity: draft.minimumSeverity,
            source_types: draft.sourceTypes,
            dedupe_window_minutes: 15,
          },
          delivery: kind === "lark_webhook"
            ? {
                webhook_url: draft.webhookUrl.trim(),
                signing_secret: draft.signingSecret.trim() || undefined,
              }
            : {
                bot_token: draft.botToken.trim(),
                chat_id: draft.chatId.trim(),
              },
        });
      } else {
        await updateAlertChannel(draft.id, {
          name: draft.name.trim() || (kind === "lark_webhook" ? "Lark Alerts" : "Telegram Alerts"),
          status: draft.enabled ? "active" : "paused",
          routing_body: {
            minimum_severity: draft.minimumSeverity,
            source_types: draft.sourceTypes,
            dedupe_window_minutes: 15,
          },
          delivery: hasDestinationInput(draft, kind)
            ? (kind === "lark_webhook"
                ? {
                    webhook_url: draft.webhookUrl.trim(),
                    signing_secret: draft.signingSecret.trim() || undefined,
                  }
                : {
                    bot_token: draft.botToken.trim(),
                    chat_id: draft.chatId.trim(),
                  })
            : undefined,
        });
      }

      setSavedKind(kind);
      void loadAlertChannels();
      setTimeout(() => {
        setSavedKind((current) => (current === kind ? null : current));
      }, 2500);
    } catch (cause) {
      setChannelErrors((prev) => ({
        ...prev,
        [kind]: cause instanceof Error ? cause.message : "保存报警渠道失败",
      }));
    } finally {
      setSavingKind(null);
    }
  };

  const removeChannel = async (kind: AlertChannelKind) => {
    const draft = kind === "lark_webhook" ? larkDraft : telegramDraft;
    if (!draft.id) {
      if (kind === "lark_webhook") {
        setLarkDraft(buildDefaultDraft("lark_webhook"));
      } else {
        setTelegramDraft(buildDefaultDraft("telegram_bot"));
      }
      return;
    }

    if (!window.confirm("确认删除这个报警渠道吗？删除后该渠道将不再接收任何系统告警。")) {
      return;
    }

    setDeletingKind(kind);
    setChannelErrors((prev) => ({ ...prev, [kind]: undefined }));
    try {
      await deleteAlertChannel(draft.id);
      await loadAlertChannels();
    } catch (cause) {
      setChannelErrors((prev) => ({
        ...prev,
        [kind]: cause instanceof Error ? cause.message : "删除报警渠道失败",
      }));
    } finally {
      setDeletingKind(null);
    }
  };

  const queueTick = async (accountId: string) => {
    setTickingAccountId(accountId);
    setDiagnosticsNotice(null);
    try {
      await triggerAccountAutomationTick(accountId);
      setDiagnosticsNotice("已补跑调度。页面已刷新为最新运行态。");
      await loadDiagnostics();
    } catch (cause) {
      setDiagnosticsNotice(cause instanceof Error ? cause.message : "补跑调度失败");
    } finally {
      setTickingAccountId(null);
    }
  };

  const renderAlertCard = (
    kind: AlertChannelKind,
    draft: AlertChannelDraft,
    setDraft: (updater: (current: AlertChannelDraft) => AlertChannelDraft) => void,
  ) => {
    const isLark = kind === "lark_webhook";
    const isSaving = savingKind === kind;
    const isDeleting = deletingKind === kind;
    const error = channelErrors[kind];
    const isSaved = savedKind === kind;

    return (
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={isLark
              ? "w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-[#111111] text-xs font-bold"
              : "w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-[#111111] text-xs font-bold"}
            >
              {isLark ? "L" : "T"}
            </div>
            <div>
              <p className="text-[#111111] font-semibold text-sm">{isLark ? "Lark（飞书）" : "Telegram"}</p>
              <p className="text-[#999999] text-xs">
                {isLark ? "通过飞书机器人 Webhook 接收系统报警" : "通过 Telegram Bot 接收系统报警"}
              </p>
            </div>
          </div>
          <Switch checked={draft.enabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />
        </div>

        <div>
          <label className="text-xs text-[#999999] mb-1.5 block">渠道名称</label>
          <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={isLark ? "Lark Alerts" : "Telegram Alerts"} />
        </div>

        <div>
          <label className="text-xs text-[#999999] mb-2 block">最小严重级别</label>
          <div className="flex gap-2 flex-wrap">
            {ALERT_SEVERITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDraft((current) => ({ ...current, minimumSeverity: option.value }))}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                  draft.minimumSeverity === option.value
                    ? "border-[#CCCCCC] bg-black/5 text-[#111111]"
                    : "border-[#E0E0E0] text-[#999999]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-[#999999] mb-2 block">告警来源</label>
          <div className="flex gap-2 flex-wrap">
            {ALERT_SOURCE_OPTIONS.map((option) => {
              const selected = draft.sourceTypes.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => setDraft((current) => ({
                    ...current,
                    sourceTypes: selected
                      ? current.sourceTypes.filter((item) => item !== option.value)
                      : sortSourceTypes([...current.sourceTypes, option.value]),
                  }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs border transition-colors",
                    selected
                      ? "border-[#CCCCCC] bg-black/5 text-[#111111]"
                      : "border-[#E0E0E0] text-[#999999]",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {isLark ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">Webhook URL</label>
              <Input
                value={draft.webhookUrl}
                onChange={(event) => setDraft((current) => ({ ...current, webhookUrl: event.target.value }))}
                placeholder={draft.destinationHint ? `当前已配置 ${draft.destinationHint}；留空则保留现有目的地` : "https://open.feishu.cn/open-apis/bot/v2/hook/..."}
              />
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">Signing Secret（可选）</label>
              <Input
                value={draft.signingSecret}
                onChange={(event) => setDraft((current) => ({ ...current, signingSecret: event.target.value }))}
                placeholder={draft.id ? "留空则保持现有签名设置" : "飞书签名密钥"}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">Bot Token</label>
              <Input
                value={draft.botToken}
                onChange={(event) => setDraft((current) => ({ ...current, botToken: event.target.value }))}
                placeholder={draft.destinationHint ? `当前已配置 ${draft.destinationHint}；留空则保留现有目的地` : "123456:ABC-DEF..."}
              />
            </div>
            <div>
              <label className="text-xs text-[#999999] mb-1.5 block">Chat ID</label>
              <Input
                value={draft.chatId}
                onChange={(event) => setDraft((current) => ({ ...current, chatId: event.target.value }))}
                placeholder={draft.id ? "更新目的地时需重新填写" : "-100xxxxxxxx"}
              />
            </div>
          </div>
        )}

        {draft.destinationHint ? (
          <p className="text-xs text-[#666666]">当前目的地：{draft.destinationHint}</p>
        ) : null}
        {draft.duplicateCount > 1 ? (
          <p className="text-xs text-[#D93025]">当前 workspace 下存在 {draft.duplicateCount} 个同类渠道；此页只编辑最新且优先激活的一条。</p>
        ) : null}
        <p className="text-xs text-[#999999]">当前没有单独“测试发送”接口；保存后会在真实系统告警触发时生效。</p>
        {error ? <p className="text-xs text-[#D93025]">{error}</p> : null}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => void persistChannel(kind)} disabled={isSaving || isDeleting || draft.sourceTypes.length === 0}>
            {isSaving ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />保存中...</> : "保存渠道"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void removeChannel(kind)} disabled={isSaving || isDeleting}>
            {isDeleting ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />删除中...</> : <><Trash2 className="w-3.5 h-3.5 mr-1" />删除渠道</>}
          </Button>
          {isSaved ? <span className="text-[#00BA7C] text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />已保存</span> : null}
        </div>
      </div>
    );
  };

  const blockedCount = diagnostics.filter((item) => item.readiness?.overall_status === "blocked").length;
  const warningCount = diagnostics.filter((item) => item.readiness?.overall_status === "warning").length;
  const failedCount = diagnostics.filter((item) => getLatestFailedAutomationRun(item.overview ?? null)).length;
  const activeRunCount = diagnostics.filter((item) => item.overview?.active_autopost_run).length;

  return (
    <div className="flex flex-col h-screen">
      <div className="px-8 py-5 border-b border-[#E8E8E8] flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111111] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#111111]" />
            监控中心
          </h1>
          <p className="text-[#999999] text-sm mt-0.5">查看真实运行信号、账号诊断，并配置真实可生效的报警渠道。</p>
        </div>
        {unreadCount > 0 ? (
          <span className="ml-2 px-2.5 py-1 rounded-full bg-white text-[#111111] text-xs font-bold">{unreadCount} 条未读</span>
        ) : null}

        <div className="ml-auto flex gap-1 bg-white border border-[#E8E8E8] rounded-lg p-1">
          {[{ key: "messages", label: "运行信号" }, { key: "diagnostics", label: "运行诊断" }, { key: "alerts", label: "报警配置" }].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as MonitoringTab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm transition-colors",
                activeTab === key ? "bg-[#E8E8E8] text-[#111111]" : "text-[#999999] hover:text-[#333333]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "messages" ? (
        <div className="flex flex-1 min-h-0">
          <div className="w-96 border-r border-[#E8E8E8] flex flex-col flex-shrink-0">
            <div className="border-b border-[#E8E8E8] bg-[#FAFAFA] p-4">
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#999999]">后台循环健康</p>
                    <p className="mt-1 text-sm font-semibold text-[#111111]">
                      {getOperationsHealthLabel(operations?.summary.health_status)}
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs", getOperationsHealthTone(operations?.summary.health_status))}>
                    {operations?.summary.active_workers ?? 0} worker
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-[#FAFAFA] p-2">
                    <p className="text-[10px] text-[#999999]">队列</p>
                    <p className="text-sm font-semibold text-[#111111]">{operations?.summary.queued_jobs ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#FAFAFA] p-2">
                    <p className="text-[10px] text-[#999999]">运行中</p>
                    <p className="text-sm font-semibold text-[#111111]">{operations?.summary.running_jobs ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-[#FAFAFA] p-2">
                    <p className="text-[10px] text-[#999999]">失败</p>
                    <p className="text-sm font-semibold text-[#D93025]">{operations?.summary.failed_jobs ?? 0}</p>
                  </div>
                </div>

                {operations?.processes[0] ? (
                  <p className="mt-3 text-[11px] text-[#666666]">
                    最近心跳：{operations.processes[0].process_name} · {formatRuntimeAge(operations.processes[0].heartbeat_age_seconds)} 前
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-[#D93025]">未检测到后台 worker 心跳。</p>
                )}
                {operations?.summary.reasons.length ? (
                  <p className="mt-2 text-[11px] text-[#C58A00]">{operations.summary.reasons[0]}</p>
                ) : (
                  <p className="mt-2 text-[11px] text-[#999999]">后台会持续排入 source fetch、trend refresh 和账号编排 tick。</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-8 w-full text-xs"
                  onClick={() => void retryFailedBacklog()}
                  disabled={retryingBacklog || (operations?.summary.failed_jobs ?? 0) === 0}
                >
                  {retryingBacklog ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />重试中...</> : "安全重试可恢复失败"}
                </Button>
              </div>

              {operations?.queue_metrics.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {operations.queue_metrics.map((metric) => (
                    <div key={metric.kind} className="rounded-lg border border-[#E8E8E8] bg-white p-2">
                      <p className="truncate text-[10px] text-[#999999]">{getQueueMetricLabel(metric.kind)}</p>
                      <p className="mt-1 text-xs font-semibold text-[#111111]">
                        {metric.queued_count} 排队 / {metric.running_count} 运行
                      </p>
                      {metric.stale_lease_count > 0 || metric.failed_count > 0 ? (
                        <p className="mt-1 text-[10px] text-[#D93025]">
                          {metric.failed_count} 失败 · {metric.stale_lease_count} 过期租约
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-[#999999]">无异常 backlog</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="px-4 py-3 border-b border-[#E8E8E8] flex gap-1.5 flex-wrap">
              {[{ key: "all", label: "全部" }, { key: "operator_queue", label: "⚡ 待处理" }, { key: "alert", label: "⚠️ 告警" }, { key: "notification", label: "🔔 通知" }, { key: "risk_event", label: "🛡️ 风险" }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilterCategory(key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs transition-colors",
                    filterCategory === key ? "bg-black/10 text-[#111111]" : "bg-[#E8E8E8] text-[#999999] hover:text-[#333333]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#1e1e1e]/50">
              {messagesNotice ? (
                <div className="m-4 rounded-xl border border-[#D7F3E6] bg-[#F4FCF8] px-4 py-3 text-xs text-[#008F5A]">
                  {messagesNotice}
                </div>
              ) : null}
              {messagesError ? (
                <div className="m-4 rounded-xl border border-[#F2D5D5] bg-[#FFF7F7] px-4 py-3 text-xs text-[#D93025]">
                  {messagesError}
                </div>
              ) : null}
              {messagesLoading && timelineItems.length === 0 ? (
                <div className="text-center py-16 text-[#999999]">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-xs">正在加载运行信号</p>
                </div>
              ) : null}
              {filtered.map((message) => {
                const category = FEED_KIND_CONFIG[message.kind] ?? FEED_KIND_CONFIG.notification;
                const isSelected = selectedMsg?.id === message.id;
                return (
                  <button
                    key={message.id}
                    onClick={() => handleSelect(message)}
                    className={cn("w-full text-left px-4 py-3.5 transition-colors hover:bg-white", isSelected && "bg-white")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F0F0F0] text-sm">{category.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[#111111] text-xs font-medium">{message.title}</span>
                          <Badge variant={category.variant} className="text-[10px] py-0 px-1.5">{category.emoji} {category.label}</Badge>
                        </div>
                        <p className="text-[#999999] text-xs line-clamp-2">{message.detail}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {message.status ? <span className="text-[#999999] text-[10px]">{message.status}</span> : null}
                          {message.status ? <span className="text-[#999999]/50 text-[10px]">·</span> : null}
                          <span className="text-[#999999] text-[10px]">{timeAgo(message.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {!messagesLoading && filtered.length === 0 ? (
                <div className="text-center py-16 text-[#999999]">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">暂无运行信号</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-1 p-8">
            {selectedMsg ? (
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F0F0] text-base">
                    {(FEED_KIND_CONFIG[selectedMsg.kind] ?? FEED_KIND_CONFIG.notification).emoji}
                  </div>
                  <div>
                    <p className="text-[#111111] font-semibold">{selectedMsg.title}</p>
                    <p className="text-[#999999] text-xs">{timeAgo(selectedMsg.created_at)} · {selectedMsg.severity ?? "info"}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge variant={(FEED_KIND_CONFIG[selectedMsg.kind] ?? FEED_KIND_CONFIG.notification).variant}>
                      {(FEED_KIND_CONFIG[selectedMsg.kind] ?? FEED_KIND_CONFIG.notification).emoji} {(FEED_KIND_CONFIG[selectedMsg.kind] ?? FEED_KIND_CONFIG.notification).label}
                    </Badge>
                  </div>
                </div>
                <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
                  <p className="text-[#111111] text-sm leading-relaxed">{selectedMsg.detail}</p>
                  {selectedMsg.blocking_chain || selectedMsg.recommended_action ? (
                    <div className="mt-4 rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
                      {selectedMsg.blocking_chain ? (
                        <p className="text-xs font-medium text-[#111111]">影响链路：{selectedMsg.blocking_chain}</p>
                      ) : null}
                      {selectedMsg.recommended_action ? (
                        <p className="mt-2 text-xs text-[#666666]">建议动作：{selectedMsg.recommended_action}</p>
                      ) : null}
                      {selectedMsg.error_user_message ? (
                        <p className="mt-2 text-xs text-[#666666]">错误判断：{selectedMsg.error_user_message}</p>
                      ) : null}
                      {selectedMsg.retry_advice ? (
                        <p className="mt-2 text-xs text-[#666666]">恢复建议：{selectedMsg.retry_advice}</p>
                      ) : null}
                      {selectedMsg.error_category ? (
                        <p className="mt-2 text-[11px] text-[#999999]">
                          分类：{getOperatorErrorCategoryLabel(selectedMsg.error_category)}
                          {selectedMsg.auto_retry_recommended ? " · 适合等待系统自动重试" : " · 需要先处理条件再重试"}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-3 mt-4">
                  <Button size="sm" variant="outline" onClick={() => void loadMessages()} disabled={messagesLoading}>
                    {messagesLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />刷新中...</> : "刷新运行信号"}
                  </Button>
                  {selectedMsg.kind === "operator_queue" && selectedMsg.target_url ? (
                    <Button asChild size="sm">
                      <Link href={selectedMsg.target_url}>去处理</Link>
                    </Button>
                  ) : selectedMsg.kind === "operator_queue" ? (
                    <Button asChild size="sm">
                      <Link href="/dashboard">去处理队列</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#999999]">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">选择一条运行信号查看详情</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "diagnostics" ? (
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-6xl space-y-6">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#E8E8E8] bg-white p-5">
              <div>
                <p className="text-sm font-medium text-[#111111]">账号运行诊断</p>
                <p className="text-xs text-[#999999] mt-1">这里汇总真实 readiness、blocked reason、最近失败、下一步动作和建议处理页。</p>
              </div>
              <Button variant="outline" onClick={() => void loadDiagnostics()} disabled={diagnosticsLoading}>
                {diagnosticsLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />刷新中...</> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />刷新诊断</>}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
                <p className="text-xs text-[#999999]">阻塞账号</p>
                <p className="mt-1 text-2xl font-semibold text-[#D93025]">{blockedCount}</p>
              </div>
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
                <p className="text-xs text-[#999999]">需关注账号</p>
                <p className="mt-1 text-2xl font-semibold text-[#C58A00]">{warningCount}</p>
              </div>
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
                <p className="text-xs text-[#999999]">最近失败账号</p>
                <p className="mt-1 text-2xl font-semibold text-[#111111]">{failedCount}</p>
              </div>
              <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
                <p className="text-xs text-[#999999]">活跃发帖 Run</p>
                <p className="mt-1 text-2xl font-semibold text-[#111111]">{activeRunCount}</p>
              </div>
            </div>

            {diagnosticsNotice ? (
              <div className="rounded-xl border border-[#D7E7F7] bg-[#F5FAFF] px-4 py-3 text-sm text-[#245A8D]">
                {diagnosticsNotice}
              </div>
            ) : null}

            {diagnosticsError ? (
              <div className="rounded-xl border border-[#F2D5D5] bg-[#FFF7F7] px-4 py-3 text-sm text-[#D93025]">
                {diagnosticsError}
              </div>
            ) : null}

            {diagnosticsLoading && diagnostics.length === 0 ? (
              <div className="rounded-xl border border-[#E8E8E8] bg-white px-4 py-10 text-center text-sm text-[#999999]">
                正在加载账号运行诊断...
              </div>
            ) : null}

            {!diagnosticsLoading && diagnostics.length === 0 ? (
              <div className="rounded-xl border border-[#E8E8E8] bg-white px-4 py-10 text-center text-sm text-[#999999]">
                当前 workspace 还没有账号。
              </div>
            ) : null}

            <div className="space-y-4">
              {diagnostics.map((item) => {
                const latestFailure = getLatestFailedAutomationRun(item.overview ?? null);
                const latestIsolatedEngagementFailure = !latestFailure
                  ? getLatestIsolatedAutomationFailure(item.overview ?? null, "engagement")
                  : undefined;
                const latestIssue = latestFailure ?? latestIsolatedEngagementFailure;
                const recommendedTarget = getRecommendedOperatorTarget(item.account.id, item.readiness, item.overview);
                const issueChecks = listIssueChecks(item.readiness);
                const currentStatus = item.overview?.active_autopost_run
                  ? `自动发帖 ${getAutopostRunStatusLabel(item.overview.active_autopost_run.status)}`
                  : getAutomationStatusLabel(item.overview?.orchestration_status ?? "inactive");
                const blockedReason = getBlockedReasonLabel(item.overview?.evaluation.blocked_reason_code ?? item.readiness?.runtime.blocked_reason_code);
                const nextAction = getActionLabel(item.overview?.evaluation.chosen_action?.type);
                const latestFailureMessage = latestIssue
                  ? (translateAutomationErrorMessage(latestIssue.error_message) ?? latestIssue.error_message ?? latestIssue.error_code ?? "执行失败")
                  : undefined;

                return (
                  <div key={item.account.id} className="rounded-xl border border-[#E8E8E8] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <img
                          src={item.account.avatar_url || `https://unavatar.io/twitter/${item.account.handle.replace(/^@/, "")}`}
                          alt=""
                          className="w-10 h-10 rounded-full bg-[#E8E8E8]"
                          onError={(event) => {
                            (event.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.account.handle.replace(/^@/, "")}`;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-[#111111]">{item.account.display_name}</p>
                            <span className="text-xs text-[#999999]">{item.account.handle}</span>
                            <span className={cn("rounded-full border px-2 py-0.5 text-xs", getOverallStatusTone(item.readiness?.overall_status))}>
                              {getOverallStatusLabel(item.readiness?.overall_status)}
                            </span>
                            <span className="rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-2 py-0.5 text-xs text-[#666666]">
                              {currentStatus}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#999999]">
                            <span>建议处理页：{recommendedTarget.label}</span>
                            {item.overview?.next_due_at ? (
                              <>
                                <span>·</span>
                                <span>下个窗口 {formatAutomationDateTime(item.overview.next_due_at)}</span>
                              </>
                            ) : null}
                            {item.error ? (
                              <>
                                <span>·</span>
                                <span className="text-[#D93025]">{item.error}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={recommendedTarget.href}>
                            {recommendedTarget.label}
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/accounts/${item.account.id}/preview`}>工作台</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void queueTick(item.account.id)}
                          disabled={tickingAccountId === item.account.id}
                        >
                          {tickingAccountId === item.account.id ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />补跑中...</> : <><PlayCircle className="w-3.5 h-3.5 mr-1" />补跑调度</>}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
                        <p className="text-xs text-[#999999]">当前卡点</p>
                        <p className="mt-1 text-sm font-medium text-[#111111]">{blockedReason}</p>
                        <p className="mt-2 text-xs text-[#666666]">
                          {translateAutomationRationale(item.overview?.evaluation.rationale)
                            ?? translateAutomationRationale(item.readiness?.runtime.rationale)
                            ?? "当前没有额外阻塞说明。"}
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
                        <p className="text-xs text-[#999999]">下一步动作</p>
                        <p className="mt-1 text-sm font-medium text-[#111111]">{nextAction}</p>
                        <p className="mt-2 text-xs text-[#666666]">{recommendedTarget.reason}</p>
                      </div>

                      <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
                        <p className="text-xs text-[#999999]">{latestIsolatedEngagementFailure ? "最近互动降级" : "最近失败"}</p>
                        {latestIssue ? (
                          <>
                            <p className="mt-1 text-sm font-medium text-[#111111]">{getActionLabel(latestIssue.chosen_action?.type)}</p>
                            <p className="mt-2 text-xs text-[#666666]">
                              {latestFailureMessage}
                              {latestIsolatedEngagementFailure ? "；这次异常已与自动发帖主链隔离。" : ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-sm font-medium text-[#111111]">无</p>
                            <p className="mt-2 text-xs text-[#666666]">最近没有失败运行。</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {issueChecks.length > 0 ? (
                        <span className="rounded-full bg-[#FFF9EF] px-2.5 py-1 text-[#8A6500]">
                          问题层：{issueChecks.join(" / ")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#F4FCF8] px-2.5 py-1 text-[#00BA7C]">
                          基础检查已通过
                        </span>
                      )}

                      {item.overview?.pending_draft_count ? (
                        <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[#666666]">
                          待审核草稿 {item.overview.pending_draft_count}
                        </span>
                      ) : null}

                      {item.overview?.queued_or_running_content_tasks.length ? (
                        <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[#666666]">
                          运行中内容任务 {item.overview.queued_or_running_content_tasks.length}
                        </span>
                      ) : null}

                      {item.overview?.engagement_automation.open_thread_count ? (
                        <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[#666666]">
                          开放互动线程 {item.overview.engagement_automation.open_thread_count}
                        </span>
                      ) : null}

                      {item.overview?.active_autopost_run ? (
                        <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[#666666]">
                          活跃 Run {formatAutomationDateTime(item.overview.active_autopost_run.scheduled_for)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl space-y-6">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#E8E8E8] bg-white p-5">
              <div>
                <p className="text-sm font-medium text-[#111111]">真实报警渠道配置</p>
                <p className="text-xs text-[#999999] mt-1">这里配置的是后端真实 alert channel，会影响实际系统报警投递。</p>
              </div>
              <Button variant="outline" onClick={() => void loadAlertChannels()} disabled={alertsLoading}>
                {alertsLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />刷新中...</> : <><RefreshCw className="w-3.5 h-3.5 mr-1" />刷新</>}
              </Button>
            </div>

            {alertsError ? (
              <div className="rounded-xl border border-[#F2D5D5] bg-[#FFF7F7] px-4 py-3 text-sm text-[#D93025]">
                {alertsError}
              </div>
            ) : null}

            {renderAlertCard("lark_webhook", larkDraft, (updater) => updateDraft("lark_webhook", updater))}
            {renderAlertCard("telegram_bot", telegramDraft, (updater) => updateDraft("telegram_bot", updater))}
          </div>
        </div>
      )}
    </div>
  );
}
