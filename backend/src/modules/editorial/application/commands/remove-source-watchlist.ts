import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { RecurringBriefPlansRepository } from "../ports/recurring-brief-plans-repository";
import type { SourceWatchlistsRepository } from "../ports/source-watchlists-repository";

export interface RemoveSourceWatchlistDependencies {
  watchlists: SourceWatchlistsRepository;
  plans: RecurringBriefPlansRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class RemoveSourceWatchlist {
  constructor(private readonly deps: RemoveSourceWatchlistDependencies) {}

  async execute(watchlistId: string) {
    const watchlist = await this.deps.watchlists.findById(watchlistId);
    if (!watchlist) {
      throw new AppError("NOT_FOUND", "source watchlist not found", {
        details: { watchlist_id: watchlistId },
      });
    }

    const referencingPlans = await this.deps.plans.listByWatchlistId(watchlist.id);
    if (referencingPlans.length > 0) {
      throw new AppError("INVALID_STATE", "cannot delete a source watchlist that is referenced by recurring brief plans", {
        details: {
          watchlist_id: watchlist.id,
          plan_ids: referencingPlans.map((plan) => plan.id),
        },
      });
    }

    await this.deps.watchlists.delete(watchlist.id);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: watchlist.workspace_id,
      actor_type: "user",
      entity_type: "source_watchlist",
      entity_id: watchlist.id,
      action: "source_watchlist.deleted",
      before_state: JSON.stringify(watchlist),
      created_at: this.deps.clock.now().toISOString(),
    });
  }
}
