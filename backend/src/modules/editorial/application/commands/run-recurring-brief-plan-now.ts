import type { ExecuteRecurringBriefPlan } from "./execute-recurring-brief-plan";

export interface RunRecurringBriefPlanNowDependencies {
  executePlan: ExecuteRecurringBriefPlan;
}

export class RunRecurringBriefPlanNow {
  constructor(private readonly deps: RunRecurringBriefPlanNowDependencies) {}

  async execute(planId: string) {
    return this.deps.executePlan.execute(planId);
  }
}
