import { AppError } from "../../../../core/errors/app-error";
import { newId } from "../../../../core/ids/new-id";
import type { Clock } from "../../../../core/time/clock";
import type { DeleteAccountResponse } from "../../../../contracts/api/accounts";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository";
import type { AccountsRepository } from "../ports/accounts-repository";
import type { AccountDeletionGuard } from "../ports/account-deletion-guard";

export interface DeleteAccountDependencies {
  accounts: AccountsRepository;
  deletionGuard: AccountDeletionGuard;
  auditLogs: AuditLogRepository;
  clock: Clock;
}

export class DeleteAccount {
  constructor(private readonly deps: DeleteAccountDependencies) {}

  async execute(accountId: string): Promise<DeleteAccountResponse> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError("NOT_FOUND", "account not found", {
        details: { account_id: accountId },
      });
    }

    const safety = await this.deps.deletionGuard.getDeleteSafety(account.id);
    const activeWorkCount = Object.values(safety).reduce((sum, value) => sum + value, 0);
    if (activeWorkCount > 0) {
      throw new AppError("INVALID_STATE", "account cannot be deleted while active work is still queued or running", {
        details: {
          account_id: account.id,
          ...safety,
        },
      });
    }

    const now = this.deps.clock.now().toISOString();
    await this.deps.auditLogs.append({
      id: newId(),
      workspace_id: account.workspace_id,
      actor_type: "system",
      entity_type: "account",
      entity_id: account.id,
      action: "account.deleted",
      before_state: JSON.stringify(account),
      created_at: now,
    });

    await this.deps.accounts.delete(account.id);

    return {
      deleted_account_id: account.id,
      workspace_id: account.workspace_id,
    };
  }
}
