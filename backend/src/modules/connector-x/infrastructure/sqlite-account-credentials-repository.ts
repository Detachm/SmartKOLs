import { AppError } from "../../../core/errors/app-error";
import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { AccountCredentialsRepository } from "../application/ports/account-credentials-repository";
import type { AccountCredential } from "../domain/account-credential";

export class SqliteAccountCredentialsRepository implements AccountCredentialsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findByAccountId(accountId: string): Promise<AccountCredential | null> {
    return this.db.get<AccountCredential>(
      `SELECT id, account_id, provider, secret_ref, status, last_validated_at, created_at
      FROM account_credentials
      WHERE account_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [accountId],
    );
  }

  async findValidByAccountId(accountId: string): Promise<AccountCredential | null> {
    return this.db.get<AccountCredential>(
      `SELECT id, account_id, provider, secret_ref, status, last_validated_at, created_at
      FROM account_credentials
      WHERE account_id = ? AND status = 'valid'
      ORDER BY created_at DESC
      LIMIT 1`,
      [accountId],
    );
  }

  async save(credential: AccountCredential): Promise<void> {
    this.db.run(
      `INSERT INTO account_credentials (
        id, account_id, provider, secret_ref, status, last_validated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        secret_ref = excluded.secret_ref,
        status = excluded.status,
        last_validated_at = excluded.last_validated_at`,
      [
        credential.id,
        credential.account_id,
        credential.provider,
        credential.secret_ref,
        credential.status,
        credential.last_validated_at ?? null,
        credential.created_at,
      ],
    );
  }

  async getWorkspaceIdByAccountId(accountId: string): Promise<string> {
    const row = this.db.get<{ workspace_id: string }>(
      `SELECT workspace_id
      FROM accounts
      WHERE id = ?`,
      [accountId],
    );

    if (!row) {
      throw new AppError("NOT_FOUND", "account not found for credential", {
        details: { account_id: accountId },
      });
    }

    return row.workspace_id;
  }
}
