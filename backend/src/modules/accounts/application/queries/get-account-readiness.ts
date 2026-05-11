import type { AccountReadinessResponse } from "../../../../contracts/api/account-readiness";
import type { AccountCredentialsRepository } from "../../../connector-x/application/ports/account-credentials-repository";
import type { PersonasRepository } from "../../../personas/application/ports/personas-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { AutopostPoliciesRepository } from "../../../autopost/application/ports/autopost-policies-repository";
import type { AutopostPolicy } from "../../../autopost/domain/autopost-policy";
import type { EngagementPoliciesRepository } from "../../../engagement/application/ports/engagement-policies-repository";
import type { EngagementPolicy } from "../../../engagement/domain/engagement-policy";
import { evaluateEngagementAutomationTargets, listEnabledEngagementAutomationFeatures } from "../../../engagement/application/engagement-policy-validation";
import type { GetAccountSurface } from "./get-account-surface";
import type { GetAccountAutomationOverview } from "../../../orchestration/application/queries/get-account-automation-overview";

type CheckStatus = AccountReadinessResponse["checks"]["credential"]["status"];

export interface GetAccountReadinessDependencies {
  credentials: AccountCredentialsRepository;
  personas: PersonasRepository;
  sources: SourcesRepository;
  autopostPolicies: AutopostPoliciesRepository;
  engagementPolicies: EngagementPoliciesRepository;
  getAccountSurface: GetAccountSurface;
  getAccountAutomationOverview: GetAccountAutomationOverview;
}

export class GetAccountReadiness {
  constructor(private readonly deps: GetAccountReadinessDependencies) {}

  async execute(accountId: string): Promise<AccountReadinessResponse> {
    const [surface, automationOverview, credential, persona, sources, autopostPolicy, engagementPolicy] = await Promise.all([
      this.deps.getAccountSurface.execute(accountId),
      this.deps.getAccountAutomationOverview.execute(accountId),
      this.deps.credentials.findByAccountId(accountId),
      this.deps.personas.findByAccountId(accountId),
      this.deps.sources.listSourcesByAccountId(accountId),
      this.deps.autopostPolicies.findByAccountId(accountId),
      this.deps.engagementPolicies.findByAccountId(accountId),
    ]);
    const account = surface.account;
    const activeSources = sources.filter((source) => source.status === "active");
    const recentDocuments = activeSources.length > 0
      ? await this.deps.sources.listRecentDocumentsByAccountId(accountId, 1)
      : [];
    const latestFetchedAt = activeSources
      .map((source) => source.last_fetched_at)
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

    const credentialCheck: AccountReadinessResponse["checks"]["credential"] = !credential
      ? {
          status: "missing",
          detail: "未绑定账号凭证，无法执行发帖、互动或资料同步。",
        }
      : credential.status !== "valid"
        ? {
            status: "blocked",
            detail: `当前凭证状态为 ${credential.status}，需要重新校验或重新绑定。`,
            provider: credential.provider,
            credential_status: credential.status,
            last_validated_at: credential.last_validated_at,
          }
        : {
            status: "ready",
            detail: "已绑定有效账号凭证。",
            provider: credential.provider,
            credential_status: credential.status,
            last_validated_at: credential.last_validated_at,
          };

    const profileCheck: AccountReadinessResponse["checks"]["profile"] = account.external_account_id
      ? {
          status: "ready",
          detail: "已完成平台资料同步。",
          external_account_id: account.external_account_id,
        }
      : {
          status: "missing",
          detail: "尚未同步平台资料，建议先执行 profile sync。",
        };

    const personaCheck: AccountReadinessResponse["checks"]["persona"] = persona
      ? {
          status: "ready",
          detail: `人格已就绪，来源 ${persona.source}。`,
          source: persona.source,
          updated_at: persona.updated_at,
        }
      : {
          status: "missing",
          detail: "尚未配置人格，无法稳定生成风格一致的内容。",
        };

    const sourcesCheck = resolveSourcesCheck({
      source_count: sources.length,
      active_source_count: activeSources.length,
      has_recent_documents: recentDocuments.length > 0,
      latest_fetched_at: latestFetchedAt,
    });

    const autopostCheck = resolveAutopostCheck({
      policy: autopostPolicy,
      credential_status: credentialCheck.status,
      persona_status: personaCheck.status,
      sources_status: sourcesCheck.status,
    });

    const engagementCheck = resolveEngagementCheck({
      account_handle: account.handle,
      policy: engagementPolicy,
      credential_status: credentialCheck.status,
      automation_blocked_reason_code: automationOverview?.evaluation.blocked_reason_code,
    });

    const allStatuses = [
      credentialCheck.status,
      profileCheck.status,
      personaCheck.status,
      sourcesCheck.status,
      autopostCheck.status,
      engagementCheck.status,
    ];
    const summary = {
      ready_count: allStatuses.filter((status) => status === "ready").length,
      warning_count: allStatuses.filter((status) => status === "warning").length,
      blocked_count: allStatuses.filter((status) => status === "blocked").length,
      missing_count: allStatuses.filter((status) => status === "missing").length,
    };

    return {
      account_id: account.id,
      workspace_id: account.workspace_id,
      overall_status: resolveOverallStatus(summary),
      summary,
      checks: {
        credential: credentialCheck,
        profile: profileCheck,
        persona: personaCheck,
        sources: sourcesCheck,
        autopost: autopostCheck,
        engagement: engagementCheck,
      },
      runtime: {
        orchestration_status: automationOverview?.orchestration_status ?? "inactive",
        blocked_reason_code: automationOverview?.evaluation.blocked_reason_code,
        rationale: automationOverview?.evaluation.rationale ?? "当前还没有进入自动化调度。",
        next_due_at: automationOverview?.next_due_at,
        pending_draft_count: automationOverview?.pending_draft_count,
        pending_manual_review_draft_count: automationOverview?.pending_manual_review_draft_count,
        pending_auto_approve_draft_count: automationOverview?.pending_auto_approve_draft_count,
        max_pending_manual_review_drafts: automationOverview?.max_pending_manual_review_drafts,
      },
    };
  }
}

function resolveSourcesCheck(input: {
  source_count: number;
  active_source_count: number;
  has_recent_documents: boolean;
  latest_fetched_at?: string;
}): AccountReadinessResponse["checks"]["sources"] {
  if (input.source_count === 0) {
    return {
      status: "missing",
      detail: "尚未配置任何信息源。",
      source_count: 0,
      active_source_count: 0,
      has_recent_documents: false,
      latest_fetched_at: undefined,
    };
  }

  if (input.active_source_count === 0) {
    return {
      status: "blocked",
      detail: `已配置 ${input.source_count} 个信息源，但当前没有启用中的 source。`,
      source_count: input.source_count,
      active_source_count: input.active_source_count,
      has_recent_documents: input.has_recent_documents,
      latest_fetched_at: input.latest_fetched_at,
    };
  }

  if (!input.has_recent_documents) {
    return {
      status: "blocked",
      detail: `已有 ${input.active_source_count} 个启用中的信息源，但还没有抓到任何文档。`,
      source_count: input.source_count,
      active_source_count: input.active_source_count,
      has_recent_documents: false,
      latest_fetched_at: input.latest_fetched_at,
    };
  }

  return {
    status: "ready",
    detail: input.latest_fetched_at
      ? `信息源已就绪，最近一次抓取时间 ${input.latest_fetched_at}。`
      : "信息源已就绪，并且已有可用文档。",
    source_count: input.source_count,
    active_source_count: input.active_source_count,
    has_recent_documents: true,
    latest_fetched_at: input.latest_fetched_at,
  };
}

function resolveAutopostCheck(input: {
  policy: AutopostPolicy | null;
  credential_status: CheckStatus;
  persona_status: CheckStatus;
  sources_status: CheckStatus;
}): AccountReadinessResponse["checks"]["autopost"] {
  if (!input.policy) {
    return {
      status: "missing",
      detail: "尚未配置自动发帖策略。",
      policy_status: "not_configured",
    };
  }

  if (input.policy.status === "paused") {
    return {
      status: "warning",
      detail: "自动发帖策略已配置，但当前处于暂停状态。",
      policy_status: input.policy.status,
      next_run_after: input.policy.next_run_after,
      last_error_code: input.policy.last_error_code,
      last_error_message: input.policy.last_error_message,
    };
  }

  if (input.credential_status !== "ready") {
    return {
      status: "blocked",
      detail: "自动发帖依赖有效账号凭证。",
      policy_status: input.policy.status,
      next_run_after: input.policy.next_run_after,
      last_error_code: input.policy.last_error_code,
      last_error_message: input.policy.last_error_message,
    };
  }

  if (input.persona_status !== "ready") {
    return {
      status: "blocked",
      detail: "自动发帖依赖已配置人格。",
      policy_status: input.policy.status,
      next_run_after: input.policy.next_run_after,
      last_error_code: input.policy.last_error_code,
      last_error_message: input.policy.last_error_message,
    };
  }

  if (input.sources_status !== "ready") {
    return {
      status: "blocked",
      detail: "自动发帖依赖可用信息源和已抓取文档。",
      policy_status: input.policy.status,
      next_run_after: input.policy.next_run_after,
      last_error_code: input.policy.last_error_code,
      last_error_message: input.policy.last_error_message,
    };
  }

  if (input.policy.last_error_message) {
    return {
      status: "warning",
      detail: `策略已激活，但最近一次运行失败：${input.policy.last_error_message}`,
      policy_status: input.policy.status,
      next_run_after: input.policy.next_run_after,
      last_error_code: input.policy.last_error_code,
      last_error_message: input.policy.last_error_message,
    };
  }

  return {
    status: "ready",
    detail: input.policy.next_run_after
      ? `自动发帖策略已激活，下次窗口 ${input.policy.next_run_after}。`
      : "自动发帖策略已激活。",
    policy_status: input.policy.status,
    next_run_after: input.policy.next_run_after,
    last_error_code: input.policy.last_error_code,
    last_error_message: input.policy.last_error_message,
  };
}

function resolveEngagementCheck(input: {
  account_handle: string;
  policy: EngagementPolicy | null;
  credential_status: CheckStatus;
  automation_blocked_reason_code?: AccountReadinessResponse["runtime"]["blocked_reason_code"];
}): AccountReadinessResponse["checks"]["engagement"] {
  if (!input.policy) {
    return {
      status: "missing",
      detail: "尚未配置互动自动化策略。",
      policy_status: "not_configured",
      enabled_features: [],
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  const enabledFeatures = listEnabledEngagementAutomationFeatures(input.policy.policy_body);
  const validation = evaluateEngagementAutomationTargets(input.policy.policy_body, input.account_handle);
  if (enabledFeatures.length === 0) {
    return {
      status: "warning",
      detail: "互动策略已存在，但尚未启用任何自动化动作。",
      policy_status: input.policy.status,
      enabled_features: enabledFeatures,
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  if (validation.invalid_features.length > 0 && validation.valid_features.length === 0) {
    return {
      status: "blocked",
      detail: validation.invalid_features[0]!.message,
      policy_status: input.policy.status,
      enabled_features: enabledFeatures,
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  if (input.policy.status === "paused") {
    return {
      status: "warning",
      detail: "互动策略已配置，但当前处于暂停状态。",
      policy_status: input.policy.status,
      enabled_features: enabledFeatures,
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  if (input.credential_status !== "ready") {
    return {
      status: "blocked",
      detail: "互动自动化依赖有效账号凭证。",
      policy_status: input.policy.status,
      enabled_features: enabledFeatures,
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  if (validation.invalid_features.length > 0) {
    return {
      status: "warning",
      detail: `部分互动动作配置无效：${validation.invalid_features.map((issue) => issue.feature).join(" / ")}`,
      policy_status: input.policy.status,
      enabled_features: enabledFeatures,
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  if (
    input.automation_blocked_reason_code === "engagement_policy_blocks_open_threads"
    || input.automation_blocked_reason_code === "awaiting_reply_review"
    || input.automation_blocked_reason_code === "awaiting_reply_send"
  ) {
    return {
      status: "warning",
      detail: "互动策略可用，但当前有运行时阻塞，需要处理候选池或待审核回复。",
      policy_status: input.policy.status,
      enabled_features: enabledFeatures,
      blocked_reason_code: input.automation_blocked_reason_code,
    };
  }

  return {
    status: "ready",
    detail: `互动策略已激活，已启用 ${enabledFeatures.join(" / ")}。`,
    policy_status: input.policy.status,
    enabled_features: enabledFeatures,
    blocked_reason_code: input.automation_blocked_reason_code,
  };
}

function resolveOverallStatus(summary: {
  ready_count: number;
  warning_count: number;
  blocked_count: number;
  missing_count: number;
}): AccountReadinessResponse["overall_status"] {
  if (summary.blocked_count > 0) {
    return "blocked";
  }

  if (summary.warning_count > 0 || summary.missing_count > 0) {
    return "warning";
  }

  return "ready";
}
