"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Heart,
  Loader2,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Share,
  Sparkles,
  TrendingUp,
  Wand2,
} from "lucide-react";
import {
  generateContentBrief,
  generateDraftFromContentBrief,
  getAccountAutomationOverview,
  getAccountSurface,
  getBriefWorkbench,
  getDraftWorkbench,
  type AccountAutomationOverviewResponse,
  type BackendAccount,
  type BackendDraftListItem,
  type BriefWorkbenchResponse,
  type ContentBriefDetailResponse,
  type DraftWorkbenchResponse,
} from "@/lib/live-api";
import { waitForAgentTask } from "@/lib/agent-task-client";
import {
  formatAutomationDateTime,
  getActionLabel,
  getAutomationStatusLabel,
  getBlockedReasonLabel,
  translateAutomationRationale,
} from "@/lib/account-automation-ui";
import { cn } from "@/lib/utils";

function formatDateTime(iso?: string) {
  if (!iso) {
    return "未安排";
  }

  return new Date(iso).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShortTime(iso?: string) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

function draftMatchesBrief(item: BackendDraftListItem, briefId?: string) {
  if (!briefId) {
    return false;
  }

  const metadata = parseMetadata(item.current_version?.metadata);
  return readString(metadata.content_brief_id) === briefId;
}

function findLatestDraftForBrief(drafts: BackendDraftListItem[], briefId?: string) {
  if (!briefId) {
    return null;
  }

  return [...drafts]
    .filter((item) => draftMatchesBrief(item, briefId))
    .sort((left, right) => new Date(right.draft.created_at).getTime() - new Date(left.draft.created_at).getTime())[0] ?? null;
}

function getBriefStatusLabel(status: ContentBriefDetailResponse["brief"]["status"]) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "生成中";
    case "ready":
      return "已就绪";
    case "failed":
      return "失败";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

function getCoverageLabel(value: ContentBriefDetailResponse["quality_summary"]["coverage_status"]) {
  switch (value) {
    case "thin":
      return "证据偏薄";
    case "grounded":
      return "证据扎实";
    case "broad":
      return "覆盖较广";
    default:
      return value;
  }
}

function getDiversityLabel(value: ContentBriefDetailResponse["quality_summary"]["diversity_status"]) {
  switch (value) {
    case "single_source":
      return "单源";
    case "multi_source":
      return "多源";
    case "cross_type":
      return "跨类型";
    default:
      return value;
  }
}

function getGenerationModeLabel(value?: ContentBriefDetailResponse["brief"]["generation_mode"]) {
  switch (value) {
    case "from_trend":
      return "Trend";
    case "from_documents":
      return "文档";
    case "from_source_scope":
      return "Source Scope";
    default:
      return "Brief";
  }
}

function getDraftStatusLabel(item: BackendDraftListItem) {
  if (item.schedule?.status === "published") {
    return "已发布";
  }
  if (item.schedule?.status === "failed") {
    return "发布失败";
  }
  if (item.schedule?.status === "queued") {
    return "待发布";
  }
  if (item.schedule?.status === "scheduled") {
    return "已排程";
  }
  if (item.draft.status === "approved") {
    return "待排期";
  }
  if (item.draft.status === "pending") {
    return "待审核";
  }
  if (item.draft.status === "rejected") {
    return "已拒绝";
  }
  if (item.draft.status === "failed") {
    return "生成失败";
  }
  return item.draft.status;
}

export default function PreviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [account, setAccount] = useState<BackendAccount | null>(null);
  const [briefWorkbench, setBriefWorkbench] = useState<BriefWorkbenchResponse | null>(null);
  const [draftWorkbench, setDraftWorkbench] = useState<DraftWorkbenchResponse | null>(null);
  const [automationOverview, setAutomationOverview] = useState<AccountAutomationOverviewResponse | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedBriefId, setSelectedBriefId] = useState<string | undefined>(undefined);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>(undefined);
  const [topicHint, setTopicHint] = useState("");
  const [angleHint, setAngleHint] = useState("");
  const [audience, setAudience] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefGenerating, setBriefGenerating] = useState(false);
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initializedAccountIdRef = useRef<string | null>(null);

  const loadWorkbench = useCallback(async (options?: {
    briefId?: string;
    query?: string;
    preserveDraftSelection?: boolean;
    background?: boolean;
  }) => {
    const targetBriefId = options?.briefId ?? selectedBriefId;
    const targetQuery = options?.query ?? activeQuery;

    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [nextAccountSurface, nextBriefWorkbench, nextDraftWorkbench, nextAutomationOverview] = await Promise.all([
        getAccountSurface(id),
        getBriefWorkbench(id, {
          selectedBriefId: targetBriefId,
          query: targetQuery || undefined,
          briefLimit: 24,
          documentLimit: 80,
        }),
        getDraftWorkbench(id, {
          selectedBriefId: targetBriefId,
          draftLimit: 50,
          briefLimit: 20,
        }),
        getAccountAutomationOverview(id),
      ]);

      const resolvedBriefId = targetBriefId
        ?? nextBriefWorkbench.selected_brief?.brief.id
        ?? nextDraftWorkbench.selected_brief?.brief.id
        ?? nextBriefWorkbench.briefs[0]?.brief.id
        ?? nextDraftWorkbench.ready_briefs[0]?.brief.id;

      setAccount(nextAccountSurface.account);
      setBriefWorkbench(nextBriefWorkbench);
      setDraftWorkbench(nextDraftWorkbench);
      setAutomationOverview(nextAutomationOverview);
      setActiveQuery(targetQuery);
      setSelectedBriefId(resolvedBriefId);
      setSelectedDocumentIds((prev) =>
        prev.filter((documentId) => nextBriefWorkbench.documents.some((item) => item.document.id === documentId)),
      );

      const matchedDraft = findLatestDraftForBrief(nextDraftWorkbench.drafts, resolvedBriefId);
      setSelectedDraftId((prev) => {
        if (options?.preserveDraftSelection && prev && nextDraftWorkbench.drafts.some((item) => item.draft.id === prev)) {
          return prev;
        }
        return matchedDraft?.draft.id;
      });
    } catch (cause) {
      setAccount(null);
      setBriefWorkbench(null);
      setDraftWorkbench(null);
      setAutomationOverview(null);
      setError(cause instanceof Error ? cause.message : "加载 editorial workbench 失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeQuery, id, selectedBriefId]);

  useEffect(() => {
    if (initializedAccountIdRef.current === id) {
      return;
    }
    initializedAccountIdRef.current = id;
    void loadWorkbench();
  }, [id, loadWorkbench]);

  const documents = useMemo(() => briefWorkbench?.documents ?? [], [briefWorkbench]);
  const selectedDocuments = useMemo(
    () => documents.filter((item) => selectedDocumentIds.includes(item.document.id)),
    [documents, selectedDocumentIds],
  );

  const selectedBrief = useMemo(() => {
    if (!selectedBriefId) {
      return briefWorkbench?.selected_brief ?? draftWorkbench?.selected_brief ?? null;
    }

    if (briefWorkbench?.selected_brief?.brief.id === selectedBriefId) {
      return briefWorkbench.selected_brief;
    }

    if (draftWorkbench?.selected_brief?.brief.id === selectedBriefId) {
      return draftWorkbench.selected_brief;
    }

    return null;
  }, [briefWorkbench, draftWorkbench, selectedBriefId]);

  const previewDraft = useMemo(() => {
    if (!draftWorkbench) {
      return null;
    }

    if (selectedDraftId) {
      return draftWorkbench.drafts.find((item) => item.draft.id === selectedDraftId) ?? null;
    }

    return findLatestDraftForBrief(draftWorkbench.drafts, selectedBriefId) ?? draftWorkbench.drafts[0] ?? null;
  }, [draftWorkbench, selectedBriefId, selectedDraftId]);
  const publishedDrafts = useMemo(
    () => (draftWorkbench?.drafts ?? []).filter((item) => item.schedule?.status === "published" || item.draft.status === "published"),
    [draftWorkbench],
  );

  const currentStatus = automationOverview?.active_autopost_run
    ? `自动发帖 ${automationOverview.active_autopost_run.status}`
    : getAutomationStatusLabel(automationOverview?.orchestration_status ?? "inactive");
  const nextAction = getActionLabel(automationOverview?.evaluation.chosen_action?.type);
  const blockedReason = automationOverview?.evaluation.blocked_reason_code
    ? getBlockedReasonLabel(automationOverview.evaluation.blocked_reason_code)
    : "当前无阻塞";
  const blockedDetail = translateAutomationRationale(automationOverview?.evaluation.rationale) ?? "当前还没有可解释的自动化状态。";

  async function handleGenerateBriefFromDocuments() {
    if (selectedDocumentIds.length === 0) {
      setError("先选择至少一篇 source 文档。");
      return;
    }

    setBriefGenerating(true);
    setStatusMessage("正在生成 Brief...");
    setError(null);

    try {
      const result = await generateContentBrief(id, {
        source_document_ids: selectedDocumentIds,
        topic_hint: topicHint.trim() || undefined,
        angle_hint: angleHint.trim() || undefined,
        audience: audience.trim() || undefined,
      });
      if (result.task_id) {
        await waitForAgentTask(result.task_id, { maxAttempts: 90, intervalMs: 2000 });
      }

      await loadWorkbench({
        briefId: result.brief_id,
        query: activeQuery,
        background: true,
      });
      setStatusMessage("Brief 已生成，现在可以基于当前 Brief 生成 Tweet Preview。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成 Brief 失败");
      setStatusMessage(null);
    } finally {
      setBriefGenerating(false);
    }
  }

  async function handleGenerateBriefFromTrend(trendId: string) {
    setBriefGenerating(true);
    setStatusMessage("正在基于趋势生成 Brief...");
    setError(null);

    try {
      const result = await generateContentBrief(id, {
        trend_id: trendId,
        topic_hint: topicHint.trim() || undefined,
        angle_hint: angleHint.trim() || undefined,
        audience: audience.trim() || undefined,
      });
      if (result.task_id) {
        await waitForAgentTask(result.task_id, { maxAttempts: 90, intervalMs: 2000 });
      }

      await loadWorkbench({
        briefId: result.brief_id,
        query: activeQuery,
        background: true,
      });
      setStatusMessage("Trend Brief 已生成，现在可以基于当前 Brief 生成 Tweet Preview。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "基于趋势生成 Brief 失败");
      setStatusMessage(null);
    } finally {
      setBriefGenerating(false);
    }
  }

  async function handleGenerateDraftFromBrief() {
    if (!selectedBriefId) {
      setError("先生成或选择一个 Brief。");
      return;
    }

    if (selectedBrief?.brief.status !== "ready") {
      setError("当前 Brief 还没有 ready，暂时不能生成 Tweet Preview。");
      return;
    }

    setDraftGenerating(true);
    setStatusMessage("正在生成 Tweet Preview...");
    setError(null);

    try {
      const result = await generateDraftFromContentBrief(selectedBriefId);
      if (result.task_id) {
        await waitForAgentTask(result.task_id, { maxAttempts: 90, intervalMs: 2000 });
      }

      await loadWorkbench({
        briefId: selectedBriefId,
        query: activeQuery,
        background: true,
      });
      setStatusMessage("Tweet Preview 已更新。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成 Tweet Preview 失败");
      setStatusMessage(null);
    } finally {
      setDraftGenerating(false);
    }
  }

  async function handleSelectBrief(briefId: string) {
    setSelectedBriefId(briefId);
    setSelectedDraftId(undefined);
    await loadWorkbench({
      briefId,
      query: activeQuery,
      background: true,
    });
  }

  if (loading && !briefWorkbench && !draftWorkbench) {
    return <div className="text-sm text-[#999999]">正在加载 editorial workbench...</div>;
  }

  if (!account) {
    return <div className="text-sm text-[#999999]">Account not found</div>;
  }

  const accountHandle = account.handle.replace(/^@/, "");
  const avatarSrc = account.avatar_url || `https://unavatar.io/twitter/${accountHandle}`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#111111] mb-1">AI 推文预览</h2>
          <p className="text-[#999999] text-sm">
            现在这页直接接真实 editorial workbench，流程固定为先 Brief，再生成 Tweet Preview。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void loadWorkbench({ query: activeQuery, background: true, preserveDraftSelection: true })}
            disabled={refreshing || briefGenerating || draftGenerating}
          >
            {refreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                刷新中
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新工作台
              </>
            )}
          </Button>
          <Button onClick={handleGenerateBriefFromDocuments} disabled={briefGenerating || draftGenerating || selectedDocumentIds.length === 0}>
            {briefGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成 Brief 中
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                从所选文档生成 Brief
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateDraftFromBrief}
            disabled={draftGenerating || briefGenerating || !selectedBrief || selectedBrief.brief.status !== "ready"}
          >
            {draftGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成 Preview 中
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                基于当前 Brief 生成 Tweet Preview
              </>
            )}
          </Button>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-xl border border-[#D7E7F7] bg-[#F5FAFF] px-4 py-3 text-sm text-[#245A8D]">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-[#F1D0D0] bg-red-50 px-4 py-3 text-sm text-[#B04A4A]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
          <p className="text-xs text-[#999999]">当前自动化状态</p>
          <p className="mt-1 text-sm font-medium text-[#111111]">{currentStatus}</p>
          <p className="mt-2 text-xs text-[#666666]">
            下个时间点 {formatAutomationDateTime(automationOverview?.next_due_at)}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
          <p className="text-xs text-[#999999]">当前下一步动作</p>
          <p className="mt-1 text-sm font-medium text-[#111111]">{nextAction}</p>
          <p className="mt-2 text-xs text-[#666666]">{blockedDetail}</p>
        </div>
        <div className="rounded-xl border border-[#E8E8E8] bg-white p-4">
          <p className="text-xs text-[#999999]">当前阻塞 / 提示</p>
          <p className="mt-1 text-sm font-medium text-[#111111]">{blockedReason}</p>
          <p className="mt-2 text-xs text-[#666666]">
            Ready Brief {draftWorkbench?.ready_briefs.length ?? 0} 条 · 最近 Draft {draftWorkbench?.drafts.length ?? 0} 条
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">生成参数</h3>
                <p className="text-xs text-[#999999] mt-1">这些参数会进入真实 Brief 生成链。</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs text-[#999999]">Topic Hint</label>
                <Input
                  value={topicHint}
                  onChange={(event) => setTopicHint(event.target.value)}
                  placeholder="例如：稳定币合规的执行影响"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#999999]">Angle Hint</label>
                <Input
                  value={angleHint}
                  onChange={(event) => setAngleHint(event.target.value)}
                  placeholder="例如：不要复述新闻，要讲 operator 怎么用"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-[#999999]">Audience</label>
                <Input
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="例如：中文 Web3 从业者"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">候选趋势</h3>
                <p className="text-xs text-[#999999] mt-1">趋势来自当前 workspace 的真实 trends。</p>
              </div>
              <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs text-[#666666]">
                {briefWorkbench?.trends.length ?? 0} 条
              </span>
            </div>
            {briefWorkbench?.trends.length ? (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {briefWorkbench.trends.slice(0, 8).map((trend) => (
                  <div key={trend.id} className="rounded-xl border border-[#EFEFEF] bg-[#FAFAFA] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#999999]">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>{trend.category}</span>
                          <span>·</span>
                          <span>热度 {trend.score}</span>
                          {trend.source_count ? (
                            <>
                              <span>·</span>
                              <span>{trend.source_count} 个源</span>
                            </>
                          ) : null}
                          {trend.account_count ? (
                            <>
                              <span>·</span>
                              <span>{trend.account_count} 个账号</span>
                            </>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-medium text-[#111111]">{trend.topic}</p>
                        {trend.sources?.length ? (
                          <p className="mt-2 text-xs text-[#666666]">
                            来源 {trend.sources.map((item) => item.source_name).join(" / ")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleGenerateBriefFromTrend(trend.id)}
                        disabled={briefGenerating || draftGenerating}
                      >
                        生成 Brief
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-sm text-[#999999]">当前还没有可用 trend，先去信息源抓取并刷新趋势。</div>
            )}
          </div>

          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">选择 source 文档</h3>
                <p className="text-xs text-[#999999] mt-1">至少选 1 篇。所选文档会直接进入 Brief evidence。</p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="搜索文档"
                  className="w-44"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadWorkbench({ query: queryInput.trim(), background: true, preserveDraftSelection: true })}
                >
                  搜索
                </Button>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="py-6 text-sm text-[#999999]">还没有抓到可用文档，先去信息源页抓一轮。</div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {documents.map(({ document, source }) => {
                  const checked = selectedDocumentIds.includes(document.id);
                  return (
                    <label
                      key={document.id}
                      className={cn(
                        "block rounded-xl border p-4 transition-colors",
                        checked ? "border-[#111111] bg-[#FAFAFA]" : "border-[#E8E8E8] bg-white hover:border-[#D5D5D5]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedDocumentIds((prev) =>
                              checked ? prev.filter((item) => item !== document.id) : [...prev, document.id],
                            )
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[11px] text-[#999999]">
                            <span>{source.name}</span>
                            <span>·</span>
                            <span>{formatShortTime(document.published_at || document.created_at)}</span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-[#111111]">{document.title}</p>
                          <p className="mt-2 line-clamp-3 text-xs text-[#666666]">{document.summary}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">Brief Workbench</h3>
                <p className="text-xs text-[#999999] mt-1">选择已有 Brief，或先生成新的 Brief，再推进到 Draft。</p>
              </div>
              <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs text-[#666666]">
                {briefWorkbench?.briefs.length ?? 0} 条
              </span>
            </div>

            {briefWorkbench?.briefs.length ? (
              <div className="mb-5 space-y-2">
                {briefWorkbench.briefs.slice(0, 6).map((item) => {
                  const active = item.brief.id === selectedBriefId;
                  return (
                    <button
                      key={item.brief.id}
                      type="button"
                      onClick={() => void handleSelectBrief(item.brief.id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        active ? "border-[#111111] bg-[#FAFAFA]" : "border-[#E8E8E8] bg-white hover:border-[#D5D5D5]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-[11px] text-[#999999]">
                            <span>{getGenerationModeLabel(item.brief.generation_mode)}</span>
                            <span>·</span>
                            <span>{getBriefStatusLabel(item.brief.status)}</span>
                            <span>·</span>
                            <span>{item.evidence_count} 条 evidence</span>
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-[#111111]">
                            {item.brief.topic || item.brief.topic_hint || "未命名 Brief"}
                          </p>
                        </div>
                        <span className="text-xs text-[#999999]">{formatShortTime(item.brief.updated_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mb-5 py-3 text-sm text-[#999999]">当前还没有 Brief。</div>
            )}

            {!selectedBrief ? (
              <div className="py-6 text-sm text-[#999999]">先从趋势或文档生成一个 Brief，生成后这里会显示真实内容。</div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#666666]">
                  <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">{getBriefStatusLabel(selectedBrief.brief.status)}</span>
                  <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">{getCoverageLabel(selectedBrief.quality_summary.coverage_status)}</span>
                  <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">{getDiversityLabel(selectedBrief.quality_summary.diversity_status)}</span>
                  <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">
                    {selectedBrief.quality_summary.source_count} 个来源
                  </span>
                </div>

                <div>
                  <p className="text-[11px] text-[#999999]">Topic</p>
                  <p className="text-[#111111] font-medium">{selectedBrief.brief.topic || selectedBrief.brief.topic_hint || "未命名 Brief"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Angle</p>
                  <p className="text-[#111111]">{selectedBrief.brief.angle || "暂未生成"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Audience</p>
                  <p className="text-[#111111]">{selectedBrief.brief.audience || "暂未生成"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-[#999999]">Outline</p>
                  <p className="whitespace-pre-line text-[#111111]">{selectedBrief.brief.outline || "暂未生成"}</p>
                </div>
                {selectedBrief.trend ? (
                  <div>
                    <p className="text-[11px] text-[#999999]">来源趋势</p>
                    <p className="text-[#111111]">{selectedBrief.trend.topic}</p>
                  </div>
                ) : null}
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#999999]">Evidence</p>
                    <p className="text-[11px] text-[#999999]">
                      更新于 {formatDateTime(selectedBrief.brief.updated_at)}
                    </p>
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedBrief.evidence.length ? (
                      selectedBrief.evidence.map((item) => (
                        <div key={item.item.id} className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs text-[#666666]">
                          <p className="font-medium text-[#111111]">{item.document.title}</p>
                          <p className="mt-1">{item.item.usage_reason}</p>
                          {item.source ? (
                            <p className="mt-1 text-[#999999]">{item.source.name}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs text-[#666666]">
                        当前 Brief 还没有 evidence。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">已发布内容</h3>
                <p className="text-xs text-[#999999] mt-1">按当前账号过滤，展示最近已经完成发布链的 Draft。</p>
              </div>
              <Link
                href={`/drafts?account_id=${encodeURIComponent(id)}&status=published`}
                className="rounded-full border border-[#E8E8E8] px-3 py-1 text-xs text-[#666666] transition-colors hover:border-[#BBBBBB] hover:text-[#111111]"
              >
                查看全部
              </Link>
            </div>

            {publishedDrafts.length ? (
              <div className="space-y-2">
                {publishedDrafts.slice(0, 5).map((item) => (
                  <button
                    key={item.draft.id}
                    type="button"
                    onClick={() => setSelectedDraftId(item.draft.id)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      item.draft.id === previewDraft?.draft.id
                        ? "border-[#111111] bg-[#FAFAFA]"
                        : "border-[#E8E8E8] bg-white hover:border-[#D5D5D5]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#999999]">
                          <FileText className="h-3.5 w-3.5" />
                          <span>已发布</span>
                          <span>·</span>
                          <span>{formatShortTime(item.schedule?.scheduled_for ?? item.draft.updated_at)}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[#111111]">{item.draft.topic}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-5 text-sm text-[#999999]">当前账号最近还没有已发布内容。</div>
            )}
          </div>

          <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">Tweet Preview</h3>
                <p className="text-xs text-[#999999] mt-1">只展示真实 Draft，不再用前端假内容拼。</p>
              </div>
              {previewDraft ? (
                <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs text-[#666666]">
                  {getDraftStatusLabel(previewDraft)}
                </span>
              ) : null}
            </div>

            {!previewDraft ? (
              <div className="py-6 text-sm text-[#999999]">当前 Brief 还没有对应 Draft，先点击“基于当前 Brief 生成 Tweet Preview”。</div>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-3">
                  <img
                    src={avatarSrc}
                    onError={(event) => {
                      (event.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${accountHandle}`;
                    }}
                    alt={account.display_name}
                    className="h-10 w-10 flex-shrink-0 rounded-full bg-[#E8E8E8]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#111111]">{account.display_name}</span>
                      <span className="text-sm text-[#999999]">{account.handle}</span>
                      <span className="text-sm text-[#2a2a2a]">·</span>
                      <span className="text-sm text-[#999999]">{formatShortTime(previewDraft.draft.updated_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#111111]">
                      {previewDraft.current_version?.content || "当前 Draft 还没有可展示内容。"}
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#E8E8E8] pt-3 text-[#999999]">
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">{getDraftStatusLabel(previewDraft)}</span>
                    <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">
                      创建于 {formatDateTime(previewDraft.draft.created_at)}
                    </span>
                    {previewDraft.schedule?.scheduled_for ? (
                      <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1">
                        排期 {formatDateTime(previewDraft.schedule.scheduled_for)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <button className="flex items-center gap-1.5 text-xs transition-colors hover:text-blue-400">
                      <MessageCircle className="h-4 w-4" />
                      <span>12</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs transition-colors hover:text-green-400">
                      <Repeat2 className="h-4 w-4" />
                      <span>48</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs transition-colors hover:text-red-400">
                      <Heart className="h-4 w-4" />
                      <span>203</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs transition-colors hover:text-blue-400">
                      <Share className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-[#111111]">最近 Drafts</h3>
                <p className="text-xs text-[#999999] mt-1">可以直接切换查看当前账号最近的真实 Draft。</p>
              </div>
              <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs text-[#666666]">
                {draftWorkbench?.drafts.length ?? 0} 条
              </span>
            </div>

            {draftWorkbench?.drafts.length ? (
              <div className="space-y-2">
                {draftWorkbench.drafts.slice(0, 6).map((item) => (
                  <button
                    key={item.draft.id}
                    type="button"
                    onClick={() => setSelectedDraftId(item.draft.id)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      item.draft.id === previewDraft?.draft.id
                        ? "border-[#111111] bg-[#FAFAFA]"
                        : "border-[#E8E8E8] bg-white hover:border-[#D5D5D5]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#999999]">
                          <FileText className="h-3.5 w-3.5" />
                          <span>{getDraftStatusLabel(item)}</span>
                          <span>·</span>
                          <span>{formatShortTime(item.draft.updated_at)}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-[#111111]">{item.draft.topic}</p>
                      </div>
                      {draftMatchesBrief(item, selectedBriefId) ? (
                        <span className="rounded-full bg-[#111111] px-2.5 py-1 text-[11px] text-white">
                          当前 Brief
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-6 text-sm text-[#999999]">当前还没有 Draft。</div>
            )}
          </div>

          {selectedDocuments.length > 0 ? (
            <div className="rounded-xl border border-[#E8E8E8] bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-[#111111]">当前已选文档</h3>
              <div className="space-y-2">
                {selectedDocuments.map((item) => (
                  <div key={item.document.id} className="rounded-lg bg-[#F7F7F7] px-3 py-2 text-xs text-[#666666]">
                    <p className="font-medium text-[#111111]">{item.document.title}</p>
                    <p className="mt-1">{item.source.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
