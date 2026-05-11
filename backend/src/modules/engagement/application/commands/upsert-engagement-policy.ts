import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { QueueAccountAutomationTick } from "../../../orchestration/application/commands/queue-account-automation-tick";
import type { EngagementPoliciesRepository } from "../ports/engagement-policies-repository";
import { createEngagementPolicy } from "../../domain/engagement-policy";
import { validateEngagementAutomationTargets } from "../engagement-policy-validation";

export interface UpsertEngagementPolicyDependencies {
  accounts: AccountsRepository;
  policies: EngagementPoliciesRepository;
  queueAccountAutomationTick: QueueAccountAutomationTick;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpsertEngagementPolicy {
  constructor(private readonly deps: UpsertEngagementPolicyDependencies) {}

  async execute(input: {
    account_id: string;
    policy_body: {
      allowed_channels: Array<"mention" | "reply" | "dm" | "comment">;
      blocked_classifications: Array<"collab" | "commerce" | "spam" | "normal" | "support">;
      require_manual_approval: boolean;
      auto_follow?: {
        enabled: boolean;
        max_per_day: number;
        rules: Array<{ type: "keyword"; value: string }>;
      };
      auto_retweet?: {
        enabled: boolean;
        max_per_day: number;
        min_likes: number;
        whitelist: string[];
        keywords: string[];
        delay_min_minutes: number;
        delay_max_minutes: number;
        quote_tweet_enabled: boolean;
      };
      auto_comment?: {
        enabled: boolean;
        max_per_day: number;
        target_handles: string[];
        style: "supportive" | "questioning" | "value-add";
        mode: "latest" | "random";
      };
      auto_reply?: {
        enabled: boolean;
        max_per_day: number;
        trigger_types: Array<"mention" | "reply" | "dm" | "comment">;
        only_followers: boolean;
        style: "grateful" | "interactive" | "brief";
      };
    };
    status: "active" | "paused";
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const existing = await this.deps.policies.findByAccountId(account.id);
    const now = this.deps.clock.now().toISOString();
    const policy = createEngagementPolicy({
      id: existing?.id ?? newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      policy_body: input.policy_body,
      status: input.status,
      updated_at: now,
    });
    validateEngagementAutomationTargets(policy, account.handle);

    await this.deps.policies.save(policy);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: policy.workspace_id,
      actor_type: "user",
      entity_type: "engagement_policy",
      entity_id: policy.id,
      action: existing ? "engagement_policy.updated" : "engagement_policy.created",
      before_state: existing ? JSON.stringify(existing) : undefined,
      after_state: JSON.stringify(policy),
      created_at: now,
    });
    if (policy.status === "active") {
      await this.deps.queueAccountAutomationTick.execute({
        account_id: policy.account_id,
        trigger_kind: "system",
        create_if_missing: true,
      });
    }

    return policy;
  }
}
