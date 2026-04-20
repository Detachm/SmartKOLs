import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../../../sources/application/ports/sources-repository";
import type { SourceWatchlistsRepository } from "../ports/source-watchlists-repository";
import { createSourceWatchlist } from "../../domain/editorial";

export interface UpsertSourceWatchlistDependencies {
  accounts: AccountsRepository;
  sources: SourcesRepository;
  watchlists: SourceWatchlistsRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class UpsertSourceWatchlist {
  constructor(private readonly deps: UpsertSourceWatchlistDependencies) {}

  async execute(input: {
    watchlist_id?: string;
    account_id: string;
    name: string;
    description?: string;
    scope_body: {
      source_ids: string[];
      source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
      preferred_source_ids: string[];
      preferred_source_types: Array<"rss" | "website" | "twitter" | "youtube" | "substack" | "telegram">;
      query?: string;
      max_source_age_days: number;
      limit: number;
    };
    status: "active" | "paused";
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const existing = input.watchlist_id ? await this.deps.watchlists.findById(input.watchlist_id) : null;
    if (existing && existing.account_id !== account.id) {
      throw new AppError("NOT_FOUND", "source watchlist not found", {
        details: { watchlist_id: input.watchlist_id, account_id: account.id },
      });
    }

    await assertOwnedSources(this.deps.sources, account.id, [
      ...input.scope_body.source_ids,
      ...input.scope_body.preferred_source_ids,
    ]);

    const now = this.deps.clock.now().toISOString();
    const watchlist = createSourceWatchlist({
      id: existing?.id ?? newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      name: input.name,
      description: input.description,
      scope_body: input.scope_body,
      status: input.status,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

    await this.deps.watchlists.save(watchlist);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: watchlist.workspace_id,
      actor_type: "user",
      entity_type: "source_watchlist",
      entity_id: watchlist.id,
      action: existing ? "source_watchlist.updated" : "source_watchlist.created",
      before_state: existing ? JSON.stringify(existing) : undefined,
      after_state: JSON.stringify(watchlist),
      created_at: now,
    });

    return { watchlist };
  }
}

async function assertOwnedSources(
  sources: SourcesRepository,
  accountId: string,
  sourceIds: string[],
) {
  if (sourceIds.length === 0) {
    return;
  }

  const accountSources = await sources.listSourcesByAccountId(accountId);
  const allowedSourceIds = new Set(accountSources.map((source) => source.id));
  const invalid = Array.from(new Set(sourceIds.map((item) => item.trim()).filter((item) => item !== ""))).filter((sourceId) => !allowedSourceIds.has(sourceId));
  if (invalid.length > 0) {
    throw new AppError("VALIDATION_ERROR", "watchlist source_ids must belong to the target account", {
      details: { account_id: accountId, source_ids: invalid },
    });
  }
}
