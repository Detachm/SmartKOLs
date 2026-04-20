import {
  createNoActionDecision,
  type EligibleOrchestrationAction,
  type OrchestrationDecision,
  type OrchestrationReasonCode,
} from "../../domain/orchestration-decision";

export class ChiefOrchestrator {
  decide(input: {
    account_id: string;
    eligible_actions: EligibleOrchestrationAction[];
    blocked_reason_code?: OrchestrationReasonCode;
    rationale: string;
  }): OrchestrationDecision {
    if (input.eligible_actions.length === 0) {
      return createNoActionDecision({
        type: "no_action",
        account_id: input.account_id,
        reason_code: input.blocked_reason_code ?? "no_eligible_actions",
        rationale: input.rationale,
      });
    }

    return [...input.eligible_actions].sort((left, right) => right.priority_score - left.priority_score)[0];
  }
}
