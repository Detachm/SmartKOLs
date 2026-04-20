import type { RecurringBriefPlansRepository } from "../ports/recurring-brief-plans-repository";
import type { SourceWatchlistsRepository } from "../ports/source-watchlists-repository";

export interface ListRecurringBriefPlansDependencies {
  plans: RecurringBriefPlansRepository;
  watchlists: SourceWatchlistsRepository;
}

export class ListRecurringBriefPlans {
  constructor(private readonly deps: ListRecurringBriefPlansDependencies) {}

  async execute(accountId: string) {
    const [plans, watchlists] = await Promise.all([
      this.deps.plans.listByAccountId(accountId),
      this.deps.watchlists.listByAccountId(accountId),
    ]);
    const watchlistMap = new Map(watchlists.map((watchlist) => [watchlist.id, watchlist]));

    return {
      plans: plans.map((plan) => ({
        plan,
        watchlist: plan.strategy_body.watchlist_id ? watchlistMap.get(plan.strategy_body.watchlist_id) : undefined,
        queued_campaign_count: plan.strategy_body.campaign_queue.filter((item) => item.status === "queued").length,
      })),
    };
  }
}
