import type { AccountAutomationOverviewResponse, AccountReadinessResponse } from "@/lib/live-api";

const BLOCKED_REASON_LABELS: Record<string, string> = {
  automation_inactive: "自动化未启用",
  automation_paused: "自动化已暂停",
  content_task_running: "已有内容任务在运行",
  awaiting_draft_review: "待审核草稿过多",
  awaiting_reply_review: "回复提案待审核",
  awaiting_reply_send: "已批准回复待发送",
  engagement_policy_missing: "互动策略未配置",
  engagement_policy_paused: "互动策略已暂停",
  engagement_policy_blocks_open_threads: "当前互动策略拦住了全部候选",
  waiting_for_next_due_window: "还没到下个执行窗口",
  no_eligible_actions: "当前没有可执行动作",
  tick_failed: "最近一次调度失败",
};

const ACTION_LABELS: Record<string, string> = {
  "draft.generate.from_brief": "生成草稿",
  "brief.generate.from_recurring_plan": "生成 Brief",
  "engagement.classify": "分类互动线程",
  "engagement.reply.generate": "生成回复",
  "engagement.follow.execute": "执行关注",
  "engagement.repost.execute": "执行转发",
  "engagement.comment.execute": "执行评论",
  "autopost.execute_policy": "启动自动发帖",
  "autopost.generate_draft_from_run": "继续生成自动发帖草稿",
  "autopost.finalize_run": "完成自动发帖收尾",
  no_action: "当前不执行新动作",
};

const ORCHESTRATION_STATUS_LABELS: Record<AccountAutomationOverviewResponse["orchestration_status"], string> = {
  inactive: "未激活",
  active: "运行中",
  paused: "已暂停",
};

const AUTOPOST_RUN_STATUS_LABELS: Record<NonNullable<AccountAutomationOverviewResponse["active_autopost_run"]>["status"], string> = {
  queued: "已排队",
  brief_generating: "正在生成 Brief",
  draft_generating: "正在生成草稿",
};

export function formatAutomationDateTime(value?: string) {
  if (!value) {
    return "未安排";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function getAutomationStatusLabel(status: AccountAutomationOverviewResponse["orchestration_status"]) {
  return ORCHESTRATION_STATUS_LABELS[status] ?? status;
}

export function getBlockedReasonLabel(reasonCode?: string) {
  if (!reasonCode) {
    return "当前无阻塞";
  }

  return BLOCKED_REASON_LABELS[reasonCode] ?? reasonCode;
}

export function getActionLabel(type?: string) {
  if (!type) {
    return "未决策";
  }

  return ACTION_LABELS[type] ?? type;
}

export function getAutopostRunStatusLabel(
  status?: NonNullable<AccountAutomationOverviewResponse["active_autopost_run"]>["status"],
) {
  if (!status) {
    return "当前无活跃 run";
  }

  return AUTOPOST_RUN_STATUS_LABELS[status] ?? status;
}

export function translateAutomationErrorMessage(message?: string) {
  if (!message) {
    return undefined;
  }

  const normalized = message.toLowerCase();
  switch (message) {
    case "auto comment targets must include at least one external handle or search query":
      return "自动评论目标无效：至少要配置一个外部账号或公开搜索词，不能只填自己账号。";
    case "auto repost config must include at least one external handle or search keyword":
      return "自动转发配置无效：至少要配置一个外部账号或公开搜索词。";
    case "auto follow rules must include at least one external handle or keyword":
      return "自动关注规则无效：至少要配置一个外部账号或关键词。";
    case "autopost policy already has an active run":
      return "自动发帖已有正在执行的 run，系统暂时不会重复启动。";
    case "model gateway received invalid brief-builder input":
      return "Brief 生成入参不合法。";
    default:
      break;
  }

  if (normalized.includes("pending manual-review drafts")) {
    return translateAutomationRationale(message);
  }
  if (normalized.includes("rate limit") || normalized.includes("429")) {
    return "外部平台限流，系统会等待限流窗口恢复后再继续。";
  }
  if (normalized.includes("timeout")) {
    return "外部服务响应超时，通常可以等待系统自动重试。";
  }
  if (normalized.includes("network")) {
    return "网络或外部服务暂时不可用，通常可以等待系统自动重试。";
  }
  if (normalized.includes("lease expired")) {
    return "后台任务执行超时，系统已恢复过期租约，可在 worker 正常后重试。";
  }
  if (normalized.includes("not found")) {
    return "运行所需的数据不存在或已被删除，请刷新页面后检查配置。";
  }
  if (normalized.includes("not configured")) {
    return "相关策略尚未配置，请先补齐配置后再运行。";
  }
  if (normalized.includes("not active") || normalized.includes("paused")) {
    return "相关策略当前未启用，请先恢复启用状态。";
  }

  return message;
}

export function translateAutomationRationale(rationale?: string) {
  if (!rationale) {
    return undefined;
  }

  const text = rationale.trim();
  const normalized = text.toLowerCase();

  if (normalized.includes("account orchestration is paused")) {
    return "账号自动化已暂停，恢复后才会继续调度。";
  }
  if (normalized.includes("content generation task is already queued or running")) {
    return "已有内容生成任务正在排队或运行，系统会等它结束后再推进下一步。";
  }
  if (normalized.includes("autopost run has a ready continuation step")) {
    return "自动发帖 run 已完成上一步，正在等待系统继续收尾。";
  }
  if (normalized.includes("latest ready brief has no draft yet")) {
    return "已有 ready brief 还没有生成草稿，系统会优先补齐这一步。";
  }
  if (normalized.includes("autopost policy is due")) {
    return "自动发帖策略已到执行窗口，账号满足条件后会自动启动。";
  }
  if (normalized.includes("recurring brief plan is due")) {
    return "周期 brief 计划已到执行窗口，系统会自动生成新的 brief。";
  }
  if (normalized.includes("open engagement thread is ready for inbox classification")) {
    return "有新的互动线程待分类，系统会先判断它是否适合回复。";
  }
  if (normalized.includes("open engagement thread has no reply proposal")) {
    return "有互动线程缺少回复提案，系统会生成待审或待发送回复。";
  }
  if (normalized.includes("engagement automation has comment capacity")) {
    return "自动评论还有今日额度，系统会继续寻找合适候选。";
  }
  if (normalized.includes("engagement automation has repost capacity")) {
    return "自动转发还有今日额度，系统会继续寻找合适候选。";
  }
  if (normalized.includes("engagement automation has follow capacity")) {
    return "自动关注还有今日额度，系统会继续寻找合适候选。";
  }
  if (normalized.includes("account has eligible orchestration actions")) {
    return "账号当前有可执行动作，系统会按优先级自动推进。";
  }
  if (normalized.includes("account has not entered orchestration yet")) {
    return "账号还没有进入自动化调度池，请先启用自动化策略。";
  }
  if (normalized.includes("pending manual-review drafts")) {
    const countMatch = text.match(/(\d+)\/(\d+)/);
    const count = countMatch ? `${countMatch[1]}/${countMatch[2]}` : "已达到上限";
    return `待审核草稿积压为 ${count}，系统会先暂停新的人工审核内容生成；请先处理草稿队列。`;
  }
  if (normalized.includes("reply proposals are waiting for manual review")) {
    return "有回复提案等待人工审核，处理后互动链才会继续推进。";
  }
  if (normalized.includes("approved reply proposals are waiting to be sent")) {
    return "有已批准回复等待发送，发送完成后互动链才会继续推进。";
  }
  if (normalized.includes("open engagement threads exist") && normalized.includes("no engagement policy")) {
    return "存在未处理互动线程，但还没有配置互动策略。";
  }
  if (normalized.includes("open engagement threads exist") && normalized.includes("paused by policy")) {
    return "存在未处理互动线程，但互动策略当前已暂停。";
  }
  if (normalized.includes("current engagement policy blocks every available thread")) {
    return "当前互动策略把所有开放线程都拦住了，请调整触发类型或屏蔽分类。";
  }
  if (normalized.includes("next scheduled window has not arrived")) {
    return "自动化已配置，但还没到下一个执行窗口。";
  }
  if (normalized.includes("no eligible orchestration action")) {
    return "当前没有可执行动作，系统会在下次调度窗口继续检查。";
  }
  if (normalized.includes("brief task has completed")) {
    return "Brief 任务已完成，系统准备继续生成草稿。";
  }
  if (normalized.includes("draft task has completed")) {
    return "草稿任务已完成，系统准备进入审核、排程或发布收尾。";
  }

  return text;
}

export function getLatestAutomationFailure(
  overview: AccountAutomationOverviewResponse | null,
  scope: "autopost" | "engagement",
  options?: {
    include_isolated?: boolean;
  },
) {
  const includeIsolated = options?.include_isolated ?? true;
  return overview?.recent_runs.find((run) => (
    run.status === "failed"
    && (includeIsolated || !run.is_isolated_failure)
    && getAutomationFailureScope(run) === scope
  ));
}

export function getLatestFailedAutomationRun(
  overview: AccountAutomationOverviewResponse | null,
  options?: {
    include_isolated?: boolean;
  },
) {
  const includeIsolated = options?.include_isolated ?? false;
  return overview?.recent_runs.find((run) => run.status === "failed" && (includeIsolated || !run.is_isolated_failure));
}

export function getLatestIsolatedAutomationFailure(
  overview: AccountAutomationOverviewResponse | null,
  scope?: "autopost" | "engagement" | "content" | "system",
) {
  return overview?.recent_runs.find((run) => (
    run.status === "failed"
    && run.is_isolated_failure
    && (!scope || getAutomationFailureScope(run) === scope)
  ));
}

export function getRecommendedOperatorTarget(
  accountId: string,
  readiness?: AccountReadinessResponse | null,
  overview?: AccountAutomationOverviewResponse | null,
) {
  const checks = readiness?.checks;

  if (checks && (checks.credential.status !== "ready" || checks.profile.status !== "ready")) {
    return {
      href: "/accounts",
      label: "打开账号列表",
      reason: "先处理绑定凭证或账号资料问题。",
    };
  }

  if (checks && checks.persona.status !== "ready") {
    return {
      href: `/accounts/${accountId}/persona`,
      label: "打开人格配置",
      reason: "人格层未就绪，先补齐或蒸馏人格。",
    };
  }

  if (checks && checks.sources.status !== "ready") {
    return {
      href: `/accounts/${accountId}/sources`,
      label: "打开信息源",
      reason: "信息源层异常，先修抓取或补源。",
    };
  }

  if (checks && checks.autopost.status !== "ready") {
    return {
      href: `/accounts/${accountId}/autopost`,
      label: "打开自动发帖",
      reason: "发帖策略层未就绪，先修复自动发帖配置。",
    };
  }

  if (checks && checks.engagement.status !== "ready") {
    return {
      href: `/accounts/${accountId}/engagement`,
      label: "打开互动自动化",
      reason: "互动策略层未就绪，先修复互动配置。",
    };
  }

  const blockedReasonCode = overview?.evaluation.blocked_reason_code ?? readiness?.runtime.blocked_reason_code;
  switch (blockedReasonCode) {
    case "awaiting_draft_review":
      return {
        href: "/drafts",
        label: "打开草稿队列",
        reason: overview
          ? `先清理待审核草稿 backlog：${overview.pending_manual_review_draft_count ?? overview.pending_draft_count}/${overview.max_pending_manual_review_drafts}。`
          : "先清理待审核草稿 backlog。",
      };
    case "awaiting_reply_review":
    case "awaiting_reply_send":
    case "engagement_policy_missing":
    case "engagement_policy_paused":
    case "engagement_policy_blocks_open_threads":
      return {
        href: `/accounts/${accountId}/engagement`,
        label: "打开互动自动化",
        reason: "当前卡在互动链，先处理互动策略或待发回复。",
      };
    case "content_task_running":
    case "waiting_for_next_due_window":
      return {
        href: `/accounts/${accountId}/preview`,
        label: "打开推文预览",
        reason: "当前内容链正在运行或等待窗口，去工作台看 brief / draft 进度。",
      };
    case "automation_inactive":
    case "automation_paused":
      return {
        href: `/accounts/${accountId}/autopost`,
        label: "打开自动发帖",
        reason: "当前账号自动化未激活，先检查调度开关。",
      };
    case "tick_failed":
      return {
        href: `/accounts/${accountId}/autopost`,
        label: "打开自动发帖",
        reason: "最近一次调度失败，先看自动发帖或运行态错误。",
      };
    default:
      break;
  }

  const latestFailure = getLatestFailedAutomationRun(overview ?? null);
  const actionType = latestFailure?.chosen_action?.type;
  if (typeof actionType === "string") {
    if (actionType.startsWith("engagement.")) {
      return {
        href: `/accounts/${accountId}/engagement`,
        label: "打开互动自动化",
        reason: "最近失败发生在互动链。",
      };
    }

    if (actionType.startsWith("autopost.")) {
      return {
        href: `/accounts/${accountId}/autopost`,
        label: "打开自动发帖",
        reason: "最近失败发生在自动发帖链。",
      };
    }

    if (actionType === "draft.generate.from_brief" || actionType === "brief.generate.from_recurring_plan") {
      return {
        href: `/accounts/${accountId}/preview`,
        label: "打开推文预览",
        reason: "最近失败发生在内容链。",
      };
    }
  }

  if (overview?.pending_draft_count && overview.pending_draft_count > 0) {
    return {
      href: "/drafts",
      label: "打开草稿队列",
      reason: "当前账号已有待处理草稿。",
    };
  }

  if (overview?.active_autopost_run || overview?.next_due_autopost_policy) {
    return {
      href: `/accounts/${accountId}/autopost`,
      label: "打开自动发帖",
      reason: "当前账号正在跑或即将进入自动发帖窗口。",
    };
  }

  return {
    href: `/accounts/${accountId}/preview`,
    label: "打开推文预览",
    reason: "当前无明显阻塞，去工作台查看下一步内容动作。",
  };
}

function getAutomationFailureScope(
  run: AccountAutomationOverviewResponse["recent_runs"][number],
): "autopost" | "engagement" | "content" | "system" {
  if (run.failure_scope) {
    return run.failure_scope;
  }

  const actionType = run.chosen_action?.type;
  if (typeof actionType === "string") {
    if (actionType.startsWith("engagement.")) {
      return "engagement";
    }
    if (actionType.startsWith("autopost.")) {
      return "autopost";
    }
    if (actionType === "draft.generate.from_brief" || actionType === "brief.generate.from_recurring_plan") {
      return "content";
    }
  }

  const error = run.error_message?.toLowerCase() ?? "";
  if (error.includes("auto comment") || error.includes("auto repost") || error.includes("auto follow") || error.includes("reply")) {
    return "engagement";
  }

  return "system";
}
