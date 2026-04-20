import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { AccountsRepository } from "../../../accounts/application/ports/accounts-repository";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { SourcesRepository } from "../ports/sources-repository";
import { createSource, type Source } from "../../domain/source";
import { validateSourceUrlForType } from "../../domain/source-url";

export interface AddSourceDependencies {
  accounts: AccountsRepository;
  sources: SourcesRepository;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class AddSource {
  constructor(private readonly deps: AddSourceDependencies) {}

  async execute(input: {
    account_id: string;
    type: Source["type"];
    name: string;
    url: string;
  }) {
    const account = await this.deps.accounts.findById(input.account_id);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: input.account_id },
      });
    }

    const existing = await this.deps.sources.findSourceByAccountAndUrl(account.id, input.url);
    if (existing) {
      throw new AppError("CONFLICT", "source already exists for account", {
        details: { account_id: account.id, url: input.url },
      });
    }

    const now = this.deps.clock.now().toISOString();
    const normalizedUrl = validateSourceUrlForType(input.type, input.url);
    const source = createSource({
      id: newId(),
      workspace_id: account.workspace_id,
      account_id: account.id,
      type: input.type,
      name: input.name,
      url: normalizedUrl,
      status: "active",
      created_at: now,
    });

    await this.deps.sources.saveSource(source);
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: source.workspace_id,
      actor_type: "user",
      entity_type: "source",
      entity_id: source.id,
      action: "source.created",
      after_state: JSON.stringify(source),
      created_at: now,
    });

    return source;
  }
}
