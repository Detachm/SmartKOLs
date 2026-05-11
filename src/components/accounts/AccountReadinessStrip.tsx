"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { getAccountReadiness, type AccountReadinessResponse } from "@/lib/live-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBlockedReasonLabel, translateAutomationRationale } from "@/lib/account-automation-ui";
import { ACCOUNT_READINESS_REFRESH_EVENT, isAccountReadinessRefreshEvent } from "@/lib/account-readiness-refresh";

interface Props {
  accountId: string;
}

const CHECK_LABELS: Record<keyof AccountReadinessResponse["checks"], string> = {
  credential: "凭证",
  profile: "资料",
  persona: "人格",
  sources: "信息源",
  autopost: "发帖",
  engagement: "互动",
};

const STATUS_LABELS: Record<AccountReadinessResponse["checks"]["credential"]["status"], string> = {
  ready: "就绪",
  warning: "注意",
  blocked: "阻塞",
  missing: "缺失",
};

const STATUS_STYLES: Record<AccountReadinessResponse["checks"]["credential"]["status"], string> = {
  ready: "border-[#D7F3E6] bg-[#F4FCF8] text-[#00BA7C]",
  warning: "border-[#F3E6C7] bg-[#FFF9EF] text-[#C58A00]",
  blocked: "border-[#F5D3D0] bg-[#FFF5F4] text-[#D93025]",
  missing: "border-[#E5E5E5] bg-[#FAFAFA] text-[#777777]",
};

const OVERALL_STYLES: Record<AccountReadinessResponse["overall_status"], string> = {
  ready: "text-[#00BA7C] bg-[#F4FCF8] border-[#D7F3E6]",
  warning: "text-[#C58A00] bg-[#FFF9EF] border-[#F3E6C7]",
  blocked: "text-[#D93025] bg-[#FFF5F4] border-[#F5D3D0]",
};

const OVERALL_LABELS: Record<AccountReadinessResponse["overall_status"], string> = {
  ready: "已就绪",
  warning: "需补全",
  blocked: "存在阻塞",
};

function formatReadinessError(cause: unknown): string {
  return cause instanceof Error ? cause.message : "加载 readiness 失败";
}

function getRuntimeGuidance(accountId: string, readiness: AccountReadinessResponse): {
  title: string;
  cause: string;
  action: string;
  href: string;
  cta: string;
} | null {
  switch (readiness.runtime.blocked_reason_code) {
    case "awaiting_draft_review": {
      const pendingManualReviewDrafts = readiness.runtime.pending_manual_review_draft_count ?? readiness.runtime.pending_draft_count;
      const maxPendingManualReviewDrafts = readiness.runtime.max_pending_manual_review_drafts;
      const countText = pendingManualReviewDrafts !== undefined && maxPendingManualReviewDrafts !== undefined
        ? `当前待审核 ${pendingManualReviewDrafts}/${maxPendingManualReviewDrafts}`
        : "当前待审核草稿已达到上限";
      return {
        title: "为什么显示需补全",
        cause: `${countText}。人工审核模式下，为了避免继续堆积未确认内容，系统会暂停新的 manual-review 草稿生成。`,
        action: "进入已筛选的草稿队列，只处理这个账号的待审核草稿：可批准并排期、拒绝、或编辑后再批准。处理到低于阈值后，后台调度会自动恢复。",
        href: `/drafts?account_id=${encodeURIComponent(accountId)}&status=pending`,
        cta: "处理此账号待审草稿",
      };
    }
    case "automation_inactive":
    case "automation_paused":
      return {
        title: "为什么没有继续运行",
        cause: "当前账号的自动化调度没有启用或处于暂停状态。",
        action: "进入自动发帖页面，检查策略状态和调度开关，恢复后再刷新 readiness。",
        href: `/accounts/${accountId}/autopost`,
        cta: "检查自动发帖",
      };
    case "content_task_running":
      return {
        title: "为什么暂时不生成新内容",
        cause: "已有内容任务正在运行，系统会等待当前任务完成，避免重复生成。",
        action: "进入推文预览查看 brief / draft 生成进度，任务结束后再刷新。",
        href: `/accounts/${accountId}/preview`,
        cta: "查看内容进度",
      };
    case "awaiting_reply_review":
    case "awaiting_reply_send":
      return {
        title: "为什么互动链路暂停",
        cause: "互动回复已有待审核或已批准待发送的积压项。",
        action: "进入互动自动化处理回复提案，处理完后再刷新。",
        href: `/accounts/${accountId}/engagement`,
        cta: "处理互动提案",
      };
    default:
      return null;
  }
}

function getCheckGuidance(accountId: string, key: keyof AccountReadinessResponse["checks"], check: AccountReadinessResponse["checks"][keyof AccountReadinessResponse["checks"]]) {
  if (check.status === "ready") {
    return null;
  }

  const targets: Record<keyof AccountReadinessResponse["checks"], { href: string; action: string; impact: string }> = {
    credential: {
      href: "/accounts",
      action: "检查账号绑定凭证，重新绑定或验证 X 授权。",
      impact: "影响资料同步、发帖发布、互动执行等所有需要 X user-context 的链路。",
    },
    profile: {
      href: "/accounts",
      action: "补齐账号 handle / 显示名，必要时同步资料。",
      impact: "影响账号识别、内容署名、互动目标过滤和 operator 判断。",
    },
    persona: {
      href: `/accounts/${accountId}/persona`,
      action: "补齐或蒸馏账号人格，让生成内容有明确风格。",
      impact: "影响 brief 到 draft 的写作风格、回复口吻和账号一致性。",
    },
    sources: {
      href: `/accounts/${accountId}/sources`,
      action: "启用至少一个信息源，并确认抓取正常。",
      impact: "影响 trend 提取、brief evidence、自动发帖选题和内容可追溯性。",
    },
    autopost: {
      href: `/accounts/${accountId}/autopost`,
      action: "配置或恢复自动发帖策略。",
      impact: "影响自动生成 brief/draft、排程和发布主链路。",
    },
    engagement: {
      href: `/accounts/${accountId}/engagement`,
      action: "配置或恢复互动策略，处理待审核回复。",
      impact: "影响自动关注、转发、评论、回复和互动 backlog 消化。",
    },
  };

  return targets[key];
}

export default function AccountReadinessStrip({ accountId }: Props) {
  const pathname = usePathname();
  const [readiness, setReadiness] = useState<AccountReadinessResponse | null>(null);
  const [showGuidance, setShowGuidance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getAccountReadiness(accountId);
      setReadiness(next);
    } catch (cause) {
      setReadiness(null);
      setError(formatReadinessError(cause));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    function handleRefreshEvent(event: Event) {
      if (isAccountReadinessRefreshEvent(event, accountId)) {
        void loadReadiness();
      }
    }

    function handleFocus() {
      void loadReadiness();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadReadiness();
      }
    }

    window.addEventListener(ACCOUNT_READINESS_REFRESH_EVENT, handleRefreshEvent);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(ACCOUNT_READINESS_REFRESH_EVENT, handleRefreshEvent);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accountId, loadReadiness]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness, pathname]);

  useEffect(() => {
    setShowGuidance(false);
  }, [accountId, pathname]);

  if (!readiness && loading) {
    return (
      <div className="rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-xs text-[#777777]">
        正在检查账号 readiness...
      </div>
    );
  }

  if (!readiness && error) {
    return (
      <div className="rounded-xl border border-[#F5D3D0] bg-[#FFF5F4] px-4 py-3 text-xs text-[#D93025]">
        {error}
      </div>
    );
  }

  if (!readiness) {
    return null;
  }

  const blockedReason = readiness.runtime.blocked_reason_code
    ? getBlockedReasonLabel(readiness.runtime.blocked_reason_code)
    : undefined;
  const runtimeGuidance = getRuntimeGuidance(accountId, readiness);
  const checkGuidanceItems = (Object.entries(readiness.checks) as Array<[
    keyof AccountReadinessResponse["checks"],
    AccountReadinessResponse["checks"][keyof AccountReadinessResponse["checks"]],
  ]>)
    .map(([key, check]) => ({ key, check, guidance: getCheckGuidance(accountId, key, check) }))
    .filter((item): item is typeof item & { guidance: NonNullable<typeof item.guidance> } => Boolean(item.guidance));
  const hasGuidance = Boolean(runtimeGuidance) || checkGuidanceItems.length > 0;

  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", OVERALL_STYLES[readiness.overall_status])}>
              {readiness.overall_status === "ready" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {OVERALL_LABELS[readiness.overall_status]}
            </span>
            <span className="text-xs text-[#999999]">
              Ready {readiness.summary.ready_count} / {readiness.summary.ready_count + readiness.summary.warning_count + readiness.summary.blocked_count + readiness.summary.missing_count}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.entries(readiness.checks) as Array<[keyof AccountReadinessResponse["checks"], AccountReadinessResponse["checks"][keyof AccountReadinessResponse["checks"]]]>).map(([key, check]) => (
              <span
                key={key}
                className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", STATUS_STYLES[check.status])}
                title={check.detail}
              >
                <span className="font-medium">{CHECK_LABELS[key]}</span>
                <span>{STATUS_LABELS[check.status]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {hasGuidance ? (
            <Button variant="outline" size="sm" onClick={() => setShowGuidance((current) => !current)}>
              {showGuidance ? "收起" : "查看处理项"}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void loadReadiness()} disabled={loading}>
            {loading ? <><RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />刷新中</> : <><RefreshCw className="mr-1 h-3.5 w-3.5" />刷新</>}
          </Button>
        </div>
      </div>
      <div className="mt-3 text-xs text-[#666666]">
        <span className="font-medium text-[#111111]">当前运行态：</span>
        {blockedReason
          ? `${blockedReason} · ${translateAutomationRationale(readiness.runtime.rationale) ?? readiness.runtime.rationale}`
          : (translateAutomationRationale(readiness.runtime.rationale) ?? readiness.runtime.rationale)}
      </div>
      {hasGuidance && showGuidance && (
        <div className="mt-3 rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] p-3 text-xs text-[#555555]">
          {runtimeGuidance && (
            <div>
              <div className="font-medium text-[#111111]">{runtimeGuidance.title}</div>
              <p className="mt-1 leading-5">{runtimeGuidance.cause}</p>
              <p className="mt-1 leading-5">{runtimeGuidance.action}</p>
              <Button asChild variant="outline" size="sm" className="mt-2 h-8 bg-white">
                <Link href={runtimeGuidance.href}>{runtimeGuidance.cta}</Link>
              </Button>
            </div>
          )}
          {checkGuidanceItems.length > 0 && (
            <div className={cn(runtimeGuidance && "mt-3 border-t border-[#E8E8E8] pt-3")}>
              <div className="font-medium text-[#111111]">需要处理的检查项</div>
              <div className="mt-2 space-y-2">
                {checkGuidanceItems.map(({ key, check, guidance }) => (
                  <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div>
                        <span className="font-medium text-[#111111]">{CHECK_LABELS[key]}：</span>
                        <span>{check.detail}</span>
                      </div>
                      <div className="mt-0.5 text-[#777777]">影响：{guidance.impact}</div>
                      <div className="mt-0.5 text-[#777777]">下一步：{guidance.action}</div>
                    </div>
                    <Link className="text-[#111111] underline underline-offset-4" href={guidance.href}>
                      去处理
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
