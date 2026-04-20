import type { RecurringBriefPlan } from "../../domain/editorial";

export interface RecurringBriefPlansRepository {
  findById(planId: string): Promise<RecurringBriefPlan | null>;
  listActiveScheduled(): Promise<RecurringBriefPlan[]>;
  listByAccountId(accountId: string): Promise<RecurringBriefPlan[]>;
  listByWatchlistId(watchlistId: string): Promise<RecurringBriefPlan[]>;
  save(plan: RecurringBriefPlan): Promise<void>;
  delete(planId: string): Promise<void>;
}
