"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getAccountAutomationOverview,
  getAutopostPolicy,
  upsertAutopostPolicy,
  type AccountAutomationOverviewResponse,
  type AutopostPolicyResponse,
  type BackendAutopostPolicy,
} from "@/lib/live-api";
import {
  formatAutomationDateTime,
  getAutopostRunStatusLabel,
  getAutomationStatusLabel,
  getBlockedReasonLabel,
  getLatestAutomationFailure,
  translateAutomationErrorMessage,
  translateAutomationRationale,
} from "@/lib/account-automation-ui";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { notifyAccountReadinessChanged } from "@/lib/account-readiness-refresh";

type WeekdayCode = BackendAutopostPolicy["cadence_body"]["weekday_codes"][number];
type SourceType = BackendAutopostPolicy["content_strategy_body"]["source_types"][number];

interface AutopostConfig {
  enabled: boolean;
  timezone: string;
  scheduledTimes: string[];
  activeDays: WeekdayCode[];
  generationMode: BackendAutopostPolicy["content_strategy_body"]["generation_mode"];
  sourceTypes: SourceType[];
  maxSourceAgeDays: number;
  draftReviewMode: BackendAutopostPolicy["execution_body"]["draft_review_mode"];
  autoQueuePublish: boolean;
  maxPendingManualReviewDrafts: number;
}

const DAYS: Array<{ code: WeekdayCode; label: string }> = [
  { code: "mon", label: "周一" },
  { code: "tue", label: "周二" },
  { code: "wed", label: "周三" },
  { code: "thu", label: "周四" },
  { code: "fri", label: "周五" },
  { code: "sat", label: "周六" },
  { code: "sun", label: "周日" },
];

const SOURCE_TYPES: Array<{ code: SourceType; label: string }> = [
  { code: "rss", label: "RSS" },
  { code: "website", label: "Website" },
  { code: "twitter", label: "X/Twitter" },
  { code: "youtube", label: "YouTube" },
  { code: "substack", label: "Substack" },
  { code: "telegram", label: "Telegram" },
];

const DEFAULT_CONFIG: AutopostConfig = {
  enabled: false,
  timezone: "UTC",
  scheduledTimes: ["09:00"],
  activeDays: ["mon", "wed", "fri"],
  generationMode: "from_source_scope",
  sourceTypes: ["rss", "website", "twitter"],
  maxSourceAgeDays: 7,
  draftReviewMode: "manual",
  autoQueuePublish: false,
  maxPendingManualReviewDrafts: 5,
};

function configFromPolicy(response: AutopostPolicyResponse | null): AutopostConfig {
  if (!response) {
    return DEFAULT_CONFIG;
  }

  return {
    enabled: response.policy.status === "active",
    timezone: response.policy.cadence_body.timezone,
    scheduledTimes: response.policy.cadence_body.slot_times.length > 0 ? response.policy.cadence_body.slot_times : DEFAULT_CONFIG.scheduledTimes,
    activeDays: response.policy.cadence_body.weekday_codes.length > 0 ? response.policy.cadence_body.weekday_codes : DEFAULT_CONFIG.activeDays,
    generationMode: response.policy.content_strategy_body.generation_mode,
    sourceTypes: response.policy.content_strategy_body.source_types.length > 0 ? response.policy.content_strategy_body.source_types : DEFAULT_CONFIG.sourceTypes,
    maxSourceAgeDays: response.policy.content_strategy_body.max_source_age_days,
    draftReviewMode: response.policy.execution_body.draft_review_mode,
    autoQueuePublish: response.policy.execution_body.auto_queue_publish,
    maxPendingManualReviewDrafts: response.policy.execution_body.max_pending_manual_review_drafts ?? DEFAULT_CONFIG.maxPendingManualReviewDrafts,
  };
}

export default function AutopostPage() {
  const params = useParams();
  const id = params.id as string;
  const [config, setConfig] = useState<AutopostConfig>(DEFAULT_CONFIG);
  const [automationOverview, setAutomationOverview] = useState<AccountAutomationOverviewResponse | null>(null);
  const [autopostPolicy, setAutopostPolicy] = useState<AutopostPolicyResponse | null>(null);
  const [automationLoading, setAutomationLoading] = useState(true);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAutomationOverview = useCallback(async () => {
    setAutomationLoading(true);
    setAutomationError(null);
    try {
      const [overview, policy] = await Promise.all([
        getAccountAutomationOverview(id),
        getAutopostPolicy(id),
      ]);
      setAutomationOverview(overview);
      setAutopostPolicy(policy);
      setConfig(configFromPolicy(policy));
    } catch (cause) {
      setAutomationOverview(null);
      setAutopostPolicy(null);
      setAutomationError(cause instanceof Error ? cause.message : "加载自动发帖状态失败");
    } finally {
      setAutomationLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadAutomationOverview();
  }, [loadAutomationOverview]);

  const set = <K extends keyof AutopostConfig>(key: K, value: AutopostConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const setDraftReviewMode = (mode: AutopostConfig["draftReviewMode"]) => {
    setConfig((prev) => ({
      ...prev,
      draftReviewMode: mode,
      autoQueuePublish: mode === "auto_approve" ? prev.autoQueuePublish : false,
    }));
    setSaved(false);
    setError(null);
  };

  const toggleDay = (day: WeekdayCode) => {
    const days = config.activeDays.includes(day)
      ? config.activeDays.filter((d) => d !== day)
      : [...config.activeDays, day];
    set("activeDays", days);
  };

  const toggleSourceType = (sourceType: SourceType) => {
    const sourceTypes = config.sourceTypes.includes(sourceType)
      ? config.sourceTypes.filter((item) => item !== sourceType)
      : [...config.sourceTypes, sourceType];
    set("sourceTypes", sourceTypes);
  };

  const addScheduledTime = () => {
    const nextHour = Math.min(23, 9 + config.scheduledTimes.length * 3);
    set("scheduledTimes", [...config.scheduledTimes, `${String(nextHour).padStart(2, "0")}:00`]);
  };

  const removeScheduledTime = (index: number) => {
    const nextTimes = config.scheduledTimes.filter((_, currentIndex) => currentIndex !== index);
    set("scheduledTimes", nextTimes.length > 0 ? nextTimes : ["09:00"]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      if (config.activeDays.length === 0) {
        throw new Error("请至少选择一个活跃日。");
      }

      if (config.sourceTypes.length === 0) {
        throw new Error("请至少选择一种信息源类型。");
      }

      await upsertAutopostPolicy(id, {
        cadence_body: {
          timezone: config.timezone.trim() || "UTC",
          weekday_codes: config.activeDays,
          slot_times: config.scheduledTimes,
          min_spacing_minutes: 120,
        },
        content_strategy_body: {
          generation_mode: config.generationMode,
          source_types: config.sourceTypes,
          max_source_age_days: config.maxSourceAgeDays,
        },
        execution_body: {
          draft_review_mode: config.draftReviewMode,
          auto_queue_publish: config.draftReviewMode === "auto_approve" && config.autoQueuePublish,
          max_pending_manual_review_drafts: Math.max(1, Math.min(50, config.maxPendingManualReviewDrafts)),
        },
        status: config.enabled ? "active" : "paused",
      });
      await loadAutomationOverview();
      setSaved(true);
      notifyAccountReadinessChanged(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存自动发帖配置失败");
    } finally {
      setSaving(false);
    }
  };

  const latestFailure = getLatestAutomationFailure(automationOverview, "autopost");
  const currentStatus = automationOverview?.active_autopost_run
    ? getAutopostRunStatusLabel(automationOverview.active_autopost_run.status)
    : getAutomationStatusLabel(automationOverview?.orchestration_status ?? "inactive");
  const currentStatusHint = automationOverview?.active_autopost_run
    ? `计划发布时间 ${formatAutomationDateTime(automationOverview.active_autopost_run.scheduled_for)}`
    : (translateAutomationRationale(automationOverview?.evaluation.rationale) ?? "当前还没有进入自动发帖执行。");
  const nextWindow = formatAutomationDateTime(
    automationOverview?.next_due_autopost_policy?.next_run_after ?? automationOverview?.next_due_at,
  );
  const nextWindowHint = automationOverview?.next_due_autopost_policy
    ? `${automationOverview.next_due_autopost_policy.draft_review_mode === "auto_approve" ? "自动审核" : "人工审核"} · ${automationOverview.next_due_autopost_policy.auto_queue_publish ? "自动排发布" : "仅生成草稿"} · backlog ${automationOverview.pending_manual_review_draft_count ?? automationOverview.pending_draft_count}/${automationOverview.max_pending_manual_review_drafts}`
    : "当前没有排到新的自动发帖窗口。";
  const issueLabel = latestFailure
    ? "最近失败"
    : autopostPolicy?.policy.last_error_message
      ? "最近失败"
    : getBlockedReasonLabel(automationOverview?.evaluation.blocked_reason_code);
  const issueHint = latestFailure
    ? (translateAutomationErrorMessage(latestFailure.error_message) ?? latestFailure.error_code ?? "自动发帖执行失败")
    : autopostPolicy?.policy.last_error_message
      ? (translateAutomationErrorMessage(autopostPolicy.policy.last_error_message) ?? autopostPolicy.policy.last_error_message)
    : (translateAutomationRationale(automationOverview?.evaluation.rationale) ?? "当前没有额外阻塞。");
  const freshness = autopostPolicy?.freshness;
  const freshnessLabel = freshness
    ? (freshness.health_status === "healthy" ? "新鲜" : freshness.health_status === "degraded" ? "部分降级" : "阻塞")
    : "未知";
  const freshnessHint = freshness
    ? `相关 source ${freshness.fresh_source_count}/${freshness.relevant_source_count} 条在 ${freshness.refresh_grace_minutes} 分钟窗口内完成刷新`
    : "还没有取到 source freshness 摘要。";

  return (
    <div>
      <h2 className="text-xl font-bold text-[#111111] mb-1">自动发帖配置</h2>
      <p className="text-[#999999] text-sm mb-6">配置该账号真实自动发帖 policy：时间窗口、信息源范围、审核和发布方式。</p>

      <div className="max-w-2xl mb-6 rounded-xl border border-[#E8E8E8] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#111111]">当前自动发帖状态</p>
            <p className="text-xs text-[#999999] mt-1">这里展示的是后端真实运行态，不是本地表单状态。</p>
          </div>
          <Button variant="outline" onClick={() => void loadAutomationOverview()} disabled={automationLoading}>
            {automationLoading ? "刷新中..." : "刷新状态"}
          </Button>
        </div>
        {automationError ? (
          <p className="mt-3 text-sm text-[#E05252]">{automationError}</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">当前状态</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{currentStatus}</p>
              <p className="mt-2 text-xs text-[#666666]">{currentStatusHint}</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">下一次窗口</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{nextWindow}</p>
              <p className="mt-2 text-xs text-[#666666]">{nextWindowHint}</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">当前阻塞 / 异常</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{issueLabel}</p>
              <p className="mt-2 text-xs text-[#666666]">{issueHint}</p>
            </div>
          </div>
        )}
      </div>

      {freshness ? (
        <div className="max-w-2xl mb-6 rounded-xl border border-[#E8E8E8] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#111111]">信息源新鲜度</p>
              <p className="text-xs text-[#999999] mt-1">自动发帖前会先检查相关 source 是否在刷新窗口内更新完成。</p>
            </div>
            <div className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              freshness.health_status === "healthy"
                ? "border-[#D5F5E3] bg-[#F3FBF6] text-[#1C7C54]"
                : freshness.health_status === "degraded"
                  ? "border-[#FDECC8] bg-[#FFFAEF] text-[#A66B00]"
                  : "border-[#F3D4D4] bg-[#FFF5F5] text-[#B04A4A]",
            )}>
              {freshnessLabel}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">当前摘要</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{freshnessLabel}</p>
              <p className="mt-2 text-xs text-[#666666]">{freshnessHint}</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">刷新窗口</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">{formatAutomationDateTime(freshness.refresh_cutoff)}</p>
              <p className="mt-2 text-xs text-[#666666]">系统要求相关 source 在此时间之后完成抓取。</p>
            </div>
            <div className="rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] p-3">
              <p className="text-xs text-[#999999]">文档窗口内最新时间</p>
              <p className="mt-1 text-sm font-medium text-[#111111]">
                {freshness.latest_document_published_at ? formatAutomationDateTime(freshness.latest_document_published_at) : "暂无"}
              </p>
              <p className="mt-2 text-xs text-[#666666]">用于本轮 source scope 的最新文档发布时间。</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {freshness.sources.map((source) => (
              <div key={source.source_id} className="flex items-center justify-between gap-3 rounded-lg border border-[#EFEFEF] bg-[#FAFAFA] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#111111]">{source.source_name}</p>
                  <p className="mt-0.5 text-xs text-[#999999]">{source.source_type.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-xs font-medium",
                    source.freshness_status === "fresh" ? "text-[#1C7C54]" : "text-[#B04A4A]",
                  )}>
                    {source.freshness_status === "fresh" ? "fresh" : "stale"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#999999]">
                    {source.last_fetched_at ? formatAutomationDateTime(source.last_fetched_at) : "未抓取"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-8 max-w-2xl">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between bg-white border border-[#E8E8E8] rounded-xl p-4">
          <div>
            <p className="text-[#111111] font-medium text-sm">自动发帖</p>
            <p className="text-[#999999] text-xs mt-0.5">按计划自动生成并发布推文</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => set("enabled", v)}
          />
        </div>

        {/* Scheduled Times */}
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="text-sm text-[#999999] block">发帖时间窗口</label>
            <Button type="button" size="sm" variant="outline" onClick={addScheduledTime}>新增时间</Button>
          </div>
          <div className="flex gap-3 flex-wrap">
            {config.scheduledTimes.map((time, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    const times = [...config.scheduledTimes];
                    times[i] = e.target.value;
                    set("scheduledTimes", times);
                  }}
                  className="w-36"
                />
                {config.scheduledTimes.length > 1 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => removeScheduledTime(i)}>移除</Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-[#999999] mb-1.5 block">Timezone</label>
          <Input
            value={config.timezone}
            onChange={(event) => set("timezone", event.target.value)}
            placeholder="UTC / Asia/Tokyo / America/New_York"
          />
          <p className="mt-1 text-xs text-[#999999]">后端会按这个 timezone 解释上方时间窗口。</p>
        </div>

        {/* Active Days */}
        <div>
          <label className="text-sm text-[#999999] mb-3 block">活跃天数</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((day) => (
              <button
                key={day.code}
                onClick={() => toggleDay(day.code)}
                className={cn(
                  "w-10 h-10 rounded-lg text-xs font-medium border transition-colors",
                  config.activeDays.includes(day.code)
                    ? "border-[#CCCCCC] bg-black/5 text-[#111111]"
                    : "border-[#E0E0E0] bg-white text-[#999999] hover:border-[#E8E8E8]"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-[#999999] mb-3 block">内容生成模式</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "from_source_scope" as const, label: "基于信息源 scope" },
              { value: "from_trend" as const, label: "基于趋势" },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => set("generationMode", item.value)}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm border transition-colors",
                  config.generationMode === item.value
                    ? "border-[#CCCCCC] bg-black/5 text-[#111111]"
                    : "border-[#E0E0E0] bg-white text-[#999999] hover:border-[#E8E8E8]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-[#999999] mb-3 block">允许使用的信息源类型</label>
          <div className="flex gap-2 flex-wrap">
            {SOURCE_TYPES.map((sourceType) => (
              <button
                key={sourceType.code}
                onClick={() => toggleSourceType(sourceType.code)}
                className={cn(
                  "px-3 py-2 rounded-lg text-xs border transition-colors",
                  config.sourceTypes.includes(sourceType.code)
                    ? "border-[#CCCCCC] bg-black/5 text-[#111111]"
                    : "border-[#E0E0E0] bg-white text-[#999999] hover:border-[#E8E8E8]",
                )}
              >
                {sourceType.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-[#999999] mb-1.5 block">最大信息源年龄（天）</label>
          <Input
            type="number"
            min={1}
            max={90}
            value={config.maxSourceAgeDays}
            onChange={(event) => set("maxSourceAgeDays", Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-[#E8E8E8] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#111111]">草稿审核模式</p>
              <p className="text-xs text-[#999999]">人工审核会把生成结果送到 Drafts；自动审核会继续推进发布队列。</p>
            </div>
            <button
              type="button"
              onClick={() => setDraftReviewMode(config.draftReviewMode === "manual" ? "auto_approve" : "manual")}
              className="rounded-lg border border-[#E0E0E0] px-3 py-2 text-xs text-[#111111]"
            >
              {config.draftReviewMode === "manual" ? "人工审核" : "自动审核"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[#111111]">自动排入发布队列</p>
              <p className="text-xs text-[#999999]">
                {config.draftReviewMode === "auto_approve"
                  ? "开启后，自动审核通过的 draft 会进入 schedule/publish 链路。"
                  : "人工审核模式下不会自动排发布；用户审核通过后再手动安排。"}
              </p>
            </div>
            <Switch
              checked={config.draftReviewMode === "auto_approve" && config.autoQueuePublish}
              disabled={config.draftReviewMode !== "auto_approve"}
              onCheckedChange={(v) => set("autoQueuePublish", v)}
            />
          </div>
          <div>
            <label className="text-sm text-[#111111] mb-1.5 block">待审核草稿上限</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={config.maxPendingManualReviewDrafts}
              onChange={(event) => set(
                "maxPendingManualReviewDrafts",
                Math.max(1, Math.min(50, Number.parseInt(event.target.value, 10) || 1)),
              )}
            />
            <p className="mt-1.5 text-xs text-[#999999]">
              人工审核模式下，待审核草稿达到该数量后会暂停新的 manual-review 内容生成；当前为 {automationOverview?.pending_manual_review_draft_count ?? automationOverview?.pending_draft_count ?? 0}/{config.maxPendingManualReviewDrafts}。
            </p>
          </div>
        </div>

        {error ? (
          <p className="text-[#E05252] text-sm text-center">{error}</p>
        ) : null}

        <Button onClick={() => void handleSave()} className="w-full" disabled={saving}>
          {saving ? "保存中..." : "保存配置"}
        </Button>
        {saved && (
          <p className="text-[#00BA7C] text-sm text-center">✓ 配置已保存</p>
        )}
      </div>
    </div>
  );
}
