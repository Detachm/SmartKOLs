"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  approveDraft,
  cancelPublishSchedule,
  editDraft,
  listDrafts,
  queuePublishJob,
  rejectDraft,
  reschedulePublishSchedule,
  requestDraftRegeneration,
  retryPublishJob,
  scheduleDraft,
  type BackendDraftListItem,
  type BackendDraftStatus,
} from "@/lib/live-api";
import { waitForAgentTask } from "@/lib/agent-task-client";
import { getLiveSession } from "@/lib/session-client";
import { getXPostLengthDiagnostics } from "@/lib/x-post-length";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, RefreshCw, Edit2, FileText, Filter, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | BackendDraftStatus;

const FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已批准" },
  { key: "scheduled", label: "已排程" },
  { key: "published", label: "已发布" },
  { key: "failed", label: "失败" },
  { key: "rejected", label: "已拒绝" },
];

function formatDateTime(iso?: string) {
  if (!iso) {
    return "未安排";
  }

  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateTimeLocalValue(iso?: string) {
  const date = iso ? new Date(iso) : new Date(Date.now() + 60 * 60_000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function shortId(value?: string) {
  if (!value) {
    return undefined;
  }

  return value.slice(0, 8);
}

function getProvenance(item: BackendDraftListItem) {
  const metadata = parseMetadata(item.current_version?.metadata);
  const generationMode = readString(metadata.generation_mode);
  const contentBriefId = readString(metadata.content_brief_id);
  const trendId = readString(metadata.trend_id) ?? item.draft.trend_id;
  const evidenceCount = readStringArray(metadata.evidence_document_ids).length;
  const citationCount = readStringArray(metadata.citation_urls).length;
  const previewMode = readBoolean(metadata.preview_mode) === true;
  const tags: string[] = [];

  if (item.current_version?.created_by_type === "user") {
    tags.push("人工编辑");
  } else if (previewMode) {
    tags.push("预览生成");
  } else if (contentBriefId) {
    tags.push("Brief 驱动");
  } else if (generationMode === "manual_topic") {
    tags.push("手动话题");
  } else if (generationMode === "source_backed") {
    tags.push("Source-backed");
  } else if (trendId) {
    tags.push("Trend 驱动");
  } else if (item.draft.generated_by_run_id) {
    tags.push("Agent 生成");
  }

  if (evidenceCount > 0) {
    tags.push(`证据 ${evidenceCount}`);
  }

  if (citationCount > 0) {
    tags.push(`引用 ${citationCount}`);
  }

  const detailParts = [
    contentBriefId ? `Brief ${shortId(contentBriefId)}` : undefined,
    trendId ? `Trend ${shortId(trendId)}` : undefined,
    item.draft.generated_by_run_id ? `Run ${shortId(item.draft.generated_by_run_id)}` : undefined,
    item.current_version ? `V${item.current_version.version_no}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    tags,
    detail: detailParts.join(" · "),
    metadata: item.current_version?.metadata ?? "{}",
    contentBriefId,
  };
}

function getDraftState(item: BackendDraftListItem) {
  const scheduleStatus = item.schedule?.status;
  if (scheduleStatus === "published") {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "已发布",
      review: "已通过",
      queue: "已进入发布链",
      publish: "发布成功",
      detail: `发布时间 ${formatDateTime(item.schedule?.scheduled_for)}`,
    };
  }

  if (scheduleStatus === "failed") {
    return {
      badgeVariant: "spam" as const,
      badgeLabel: "发布失败",
      review: "已通过",
      queue: "已排程",
      publish: "执行失败",
      detail: `原计划 ${formatDateTime(item.schedule?.scheduled_for)}`,
    };
  }

  if (scheduleStatus === "queued") {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "待发布",
      review: "已通过",
      queue: "已进入发布队列",
      publish: "等待执行",
      detail: `计划 ${formatDateTime(item.schedule?.scheduled_for)}`,
    };
  }

  if (scheduleStatus === "scheduled") {
    return {
      badgeVariant: "outline" as const,
      badgeLabel: "已排程",
      review: "已通过",
      queue: "已排程",
      publish: "尚未开始",
      detail: `计划 ${formatDateTime(item.schedule?.scheduled_for)}`,
    };
  }

  if (scheduleStatus === "cancelled") {
    return {
      badgeVariant: "secondary" as const,
      badgeLabel: "排期已取消",
      review: "已通过",
      queue: "排期取消",
      publish: "未发布",
      detail: "此草稿曾进入排期，但已被取消。",
    };
  }

  if (item.draft.status === "approved") {
    return {
      badgeVariant: "secondary" as const,
      badgeLabel: "待排期",
      review: "已通过",
      queue: "尚未排期",
      publish: "未开始",
      detail: "草稿已批准，但还没有进入 publish schedule。",
    };
  }

  if (item.draft.status === "rejected") {
    return {
      badgeVariant: "spam" as const,
      badgeLabel: "已拒绝",
      review: "已拒绝",
      queue: "未进入排期",
      publish: "未开始",
      detail: "该草稿被人工拒绝。",
    };
  }

  if (item.draft.status === "failed") {
    return {
      badgeVariant: "spam" as const,
      badgeLabel: "草稿失败",
      review: "未通过",
      queue: "未进入排期",
      publish: "未开始",
      detail: "草稿生成或后续处理失败。",
    };
  }

  return {
    badgeVariant: "secondary" as const,
    badgeLabel: "待审核",
    review: "等待审核",
    queue: "未进入排期",
    publish: "未开始",
    detail: `生成于 ${formatDateTime(item.draft.created_at)}`,
  };
}

function getDisplayStatus(item: BackendDraftListItem): StatusFilter {
  switch (item.schedule?.status) {
    case "published":
      return "published";
    case "failed":
      return "failed";
    case "queued":
    case "scheduled":
      return "scheduled";
    case "cancelled":
      return item.draft.status === "published" ? "published" : "approved";
    default:
      return item.draft.status;
  }
}

function getStageStyle(label: string) {
  if (label.includes("失败") || label.includes("拒绝")) {
    return "border-[#F5D3D0] bg-[#FFF5F4] text-[#D93025]";
  }

  if (label.includes("已") || label.includes("成功") || label.includes("进入")) {
    return "border-[#D7F3E6] bg-[#F4FCF8] text-[#00BA7C]";
  }

  if (label.includes("等待") || label.includes("尚未")) {
    return "border-[#E5E5E5] bg-[#FAFAFA] text-[#777777]";
  }

  return "border-[#E5E5E5] bg-[#FAFAFA] text-[#777777]";
}

function DraftsPageContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const initialAccountId = searchParams.get("account_id")?.trim() || undefined;
  const [drafts, setDrafts] = useState<BackendDraftListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>(
    FILTERS.some((entry) => entry.key === initialStatus) ? initialStatus as StatusFilter : "all",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleInput, setScheduleInput] = useState("");
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "regenerate" | "save" | "publish_now" | "schedule" | "cancel_schedule" | "retry_publish" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await getLiveSession();
      const response = await listDrafts({
        workspaceId: session.selected_workspace.id,
        accountId: initialAccountId,
        limit: 200,
      });
      setDrafts(response.drafts);
    } catch (cause) {
      setDrafts([]);
      setError(cause instanceof Error ? cause.message : "加载草稿失败");
    } finally {
      setLoading(false);
    }
  }, [initialAccountId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const filtered = useMemo(() => {
    return drafts
      .filter((item) => filter === "all" || getDisplayStatus(item) === filter)
      .sort((left, right) => new Date(right.draft.updated_at).getTime() - new Date(left.draft.updated_at).getTime());
  }, [drafts, filter]);

  const counts = useMemo(() => ({
    all: drafts.length,
    pending: drafts.filter((item) => getDisplayStatus(item) === "pending").length,
    approved: drafts.filter((item) => getDisplayStatus(item) === "approved").length,
    scheduled: drafts.filter((item) => getDisplayStatus(item) === "scheduled").length,
    published: drafts.filter((item) => getDisplayStatus(item) === "published").length,
    failed: drafts.filter((item) => getDisplayStatus(item) === "failed").length,
    rejected: drafts.filter((item) => getDisplayStatus(item) === "rejected").length,
  }), [drafts]);

  const startEdit = (item: BackendDraftListItem) => {
    setEditingId(item.draft.id);
    setEditingContent(item.current_version?.content ?? "");
    setSchedulingId(null);
    setActionMessage(null);
  };

  const startScheduleEdit = (item: BackendDraftListItem) => {
    setSchedulingId(item.draft.id);
    setScheduleInput(toDateTimeLocalValue(item.schedule?.scheduled_for));
    setEditingId(null);
    setActionMessage(null);
  };

  const finishAction = (message?: string) => {
    if (message) {
      setActionMessage(message);
    }
    setPendingDraftId(null);
    setPendingAction(null);
  };

  const runAction = async (draftId: string, action: "approve" | "reject" | "regenerate" | "save", runner: () => Promise<void>) => {
    setPendingDraftId(draftId);
    setPendingAction(action);
    setActionMessage(null);
    try {
      await runner();
      if (action !== "regenerate") {
        await loadDrafts();
      }
      finishAction(action === "regenerate" ? "已提交重生成任务，后台完成后会自动刷新。" : undefined);
    } catch (cause) {
      finishAction(cause instanceof Error ? cause.message : "操作失败");
    }
  };

  const runPublishAction = async (
    draftId: string,
    action: "publish_now" | "schedule" | "cancel_schedule" | "retry_publish",
    runner: () => Promise<void>,
  ) => {
    setPendingDraftId(draftId);
    setPendingAction(action);
    setActionMessage(null);
    try {
      await runner();
      await loadDrafts();
      finishAction(
        action === "publish_now"
          ? "已推入发布队列。"
          : action === "schedule"
            ? "已更新排期。"
            : action === "cancel_schedule"
              ? "已取消排期，草稿回到已批准状态。"
              : "已重新加入发布队列。",
      );
    } catch (cause) {
      finishAction(cause instanceof Error ? cause.message : "操作失败");
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2">
            <FileText className="w-6 h-6" />
            内容审核
          </h1>
          <p className="text-[#999999] text-sm mt-1">这里展示后端真实草稿、真实 provenance，以及它在发布状态机里的当前位置。</p>
          {initialAccountId ? (
            <p className="mt-2 rounded-full border border-[#E8E8E8] bg-white px-3 py-1 text-xs text-[#666666]">
              已按账号筛选：{initialAccountId.slice(0, 8)}；当前只处理这个账号的草稿 backlog。
            </p>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => void loadDrafts()} disabled={loading}>
          {loading ? <><LoaderCircle className="w-4 h-4 mr-1 animate-spin" />刷新中...</> : <><RefreshCw className="w-4 h-4 mr-1" />刷新</>}
        </Button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-[#F5D3D0] bg-[#FFF5F4] px-4 py-3 text-sm text-[#D93025]">
          {error}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="mb-6 rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-sm text-[#666666]">
          {actionMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6 border-b border-[#E8E8E8] pb-3">
        {FILTERS.map((entry) => {
          const isActive = filter === entry.key;
          return (
            <button
              key={entry.key}
              onClick={() => setFilter(entry.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors",
                isActive
                  ? "border-[#111111] text-[#111111] bg-black/5"
                  : "border-[#E8E8E8] text-[#999999] hover:text-[#333333]",
              )}
            >
              {entry.label} <span className="text-xs ml-1">({counts[entry.key]})</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 max-w-4xl">
        {!loading && filtered.length === 0 ? (
          <div className="text-center py-16 text-[#999999]">
            <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">这个分类下暂无真实草稿</p>
          </div>
        ) : null}

        {filtered.map((item) => {
          const state = getDraftState(item);
          const provenance = getProvenance(item);
          const lengthDiagnostics = item.current_version?.content
            ? getXPostLengthDiagnostics(item.current_version.content)
            : undefined;
          const isOverXLengthLimit = (lengthDiagnostics?.overflow_by ?? 0) > 0;
          const isEditing = editingId === item.draft.id;
          const isScheduling = schedulingId === item.draft.id;
          const isPendingAction = pendingDraftId === item.draft.id;
          const allowReviewActions = item.draft.status === "pending";
          const allowReject = item.draft.status === "pending" || item.draft.status === "failed";
          const isRegenerationEligibleStatus = item.draft.status === "pending" || item.draft.status === "rejected" || item.draft.status === "failed";
          const allowRegenerate = isRegenerationEligibleStatus && Boolean(provenance.contentBriefId);
          const allowPublishNow = item.draft.status === "approved" && !item.schedule;
          const allowSchedule = item.draft.status === "approved" || item.schedule?.status === "scheduled";
          const allowCancelSchedule = item.schedule?.status === "scheduled";
          const allowRetryPublish = item.schedule?.status === "failed" && item.latest_publish_job?.status === "failed";

          return (
            <div key={item.draft.id} className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={item.account.avatar_url || `https://unavatar.io/twitter/${item.account.handle.replace(/^@/, "")}`}
                  alt=""
                  className="w-9 h-9 rounded-full bg-[#E8E8E8]"
                  onError={(event) => {
                    (event.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.account.handle.replace(/^@/, "")}`;
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[#111111] font-semibold text-sm">{item.account.display_name}</span>
                    <span className="text-[#999999] text-xs">{item.account.handle}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#666666]">{item.draft.topic}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#999999] mt-0.5 flex-wrap">
                    <span>更新于 {formatDateTime(item.draft.updated_at)}</span>
                    <span>·</span>
                    <span>{state.detail}</span>
                    {item.latest_review ? (
                      <>
                        <span>·</span>
                        <span>最近操作 {item.latest_review.action} · {formatDateTime(item.latest_review.created_at)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <Badge variant={state.badgeVariant} className="text-xs">
                  {state.badgeLabel}
                </Badge>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {provenance.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-2 py-0.5 text-xs text-[#666666]">
                    {tag}
                  </span>
                ))}
                {lengthDiagnostics ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                      isOverXLengthLimit
                        ? "border-[#F5D3D0] bg-[#FFF5F4] text-[#D93025]"
                        : "border-[#D7F3E6] bg-[#F4FCF8] text-[#00BA7C]",
                    )}
                  >
                    X 长度 {lengthDiagnostics.weighted_length}/{lengthDiagnostics.max_weighted_length}
                  </span>
                ) : null}
                {provenance.detail ? (
                  <span className="inline-flex items-center rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-2 py-0.5 text-xs text-[#999999]">
                    {provenance.detail}
                  </span>
                ) : null}
              </div>

              <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                {[
                  { label: "审核", value: state.review },
                  { label: "排期", value: state.queue },
                  { label: "发布", value: state.publish },
                ].map((stage) => (
                  <div key={stage.label} className={cn("rounded-lg border px-3 py-2 text-xs", getStageStyle(stage.value))}>
                    <p className="font-medium">{stage.label}</p>
                    <p className="mt-1">{stage.value}</p>
                  </div>
                ))}
              </div>

              {isEditing ? (
                <Textarea
                  value={editingContent}
                  onChange={(event) => setEditingContent(event.target.value)}
                  rows={4}
                  className="mb-3"
                />
              ) : isScheduling ? (
                <div className="mb-3 flex flex-col gap-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 md:flex-row md:items-center">
                  <Input
                    type="datetime-local"
                    value={scheduleInput}
                    onChange={(event) => setScheduleInput(event.target.value)}
                    className="md:max-w-xs"
                  />
                  <p className="text-xs text-[#666666]">保存后会生成或更新真实 publish schedule。立即发布请直接点“立即发布”。</p>
                </div>
              ) : (
                <p className="text-[#111111] text-sm leading-relaxed mb-4 whitespace-pre-line">
                  {item.current_version?.content ?? "当前版本内容为空"}
                </p>
              )}

              {isOverXLengthLimit ? (
                <div className="mb-4 rounded-lg border border-[#F5D3D0] bg-[#FFF5F4] px-3 py-2 text-xs text-[#D93025]">
                  这条草稿超出 X 发布上限：当前 {lengthDiagnostics?.weighted_length}/{lengthDiagnostics?.max_weighted_length}，超出 {lengthDiagnostics?.overflow_by}。
                  需要先压缩或重写，再安排时间或立即发布。
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {allowReviewActions && isEditing ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void runAction(item.draft.id, "save", async () => {
                        await editDraft(item.draft.id, {
                          content: editingContent,
                          metadata: provenance.metadata,
                        });
                        setEditingId(null);
                      })}
                      disabled={isPendingAction}
                    >
                      {isPendingAction && pendingAction === "save" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                      保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isPendingAction}>
                      取消
                    </Button>
                  </>
                ) : null}

                {isScheduling ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void runPublishAction(item.draft.id, "schedule", async () => {
                        const scheduledAt = new Date(scheduleInput);
                        if (!Number.isFinite(scheduledAt.getTime())) {
                          throw new Error("请选择有效的发布时间");
                        }
                        if (item.schedule?.id) {
                          await reschedulePublishSchedule(item.schedule.id, scheduledAt.toISOString());
                        } else {
                          await scheduleDraft(item.draft.id, scheduledAt.toISOString());
                        }
                        setSchedulingId(null);
                      })}
                      disabled={isPendingAction}
                    >
                      {isPendingAction && pendingAction === "schedule" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                      保存排期
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSchedulingId(null)} disabled={isPendingAction}>
                      取消
                    </Button>
                  </>
                ) : null}

                {allowReviewActions && !isEditing ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => void runAction(item.draft.id, "approve", async () => {
                        await approveDraft(item.draft.id);
                      })}
                      disabled={isPendingAction}
                    >
                      {isPendingAction && pendingAction === "approve" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                      批准
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(item)} disabled={isPendingAction}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      编辑
                    </Button>
                  </>
                ) : null}

                {allowReject && !isEditing ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void runAction(item.draft.id, "reject", async () => {
                      await rejectDraft(item.draft.id);
                    })}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    disabled={isPendingAction}
                  >
                    {isPendingAction && pendingAction === "reject" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1" />}
                    拒绝
                  </Button>
                ) : null}

                {allowPublishNow && !isScheduling ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runPublishAction(item.draft.id, "publish_now", async () => {
                      const schedule = await scheduleDraft(item.draft.id, new Date().toISOString());
                      await queuePublishJob(schedule.id);
                    })}
                    disabled={isPendingAction || isOverXLengthLimit}
                  >
                    {isPendingAction && pendingAction === "publish_now" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    立即发布
                  </Button>
                ) : null}

                {allowSchedule && !isScheduling ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startScheduleEdit(item)}
                    disabled={isPendingAction || (isOverXLengthLimit && item.draft.status === "approved")}
                  >
                    安排时间
                  </Button>
                ) : null}

                {allowCancelSchedule ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runPublishAction(item.draft.id, "cancel_schedule", async () => {
                      await cancelPublishSchedule(item.schedule!.id);
                    })}
                    disabled={isPendingAction}
                  >
                    {isPendingAction && pendingAction === "cancel_schedule" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    取消排期
                  </Button>
                ) : null}

                {allowRetryPublish ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runPublishAction(item.draft.id, "retry_publish", async () => {
                      await retryPublishJob(item.latest_publish_job!.id);
                    })}
                    disabled={isPendingAction}
                  >
                    {isPendingAction && pendingAction === "retry_publish" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                    重新发布
                  </Button>
                ) : null}

                {allowRegenerate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction(item.draft.id, "regenerate", async () => {
                      const task = await requestDraftRegeneration(item.draft.id);
                      void waitForAgentTask(task.task_id, { maxAttempts: 120, intervalMs: 2000 })
                        .catch(() => undefined)
                        .finally(() => {
                          void loadDrafts();
                        });
                    })}
                    disabled={isPendingAction}
                  >
                    {isPendingAction && pendingAction === "regenerate" ? <LoaderCircle className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                    重新生成
                  </Button>
                ) : null}

                {isRegenerationEligibleStatus && !provenance.contentBriefId ? (
                  <span className="text-xs text-[#999999]">
                    旧稿缺少 Brief provenance，不能直接重生成
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DraftsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#777777]">正在加载草稿队列...</div>}>
      <DraftsPageContent />
    </Suspense>
  );
}
