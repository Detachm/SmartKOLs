import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { EngagementPoliciesRepository } from "../application/ports/engagement-policies-repository";
import type { EngagementPolicy } from "../domain/engagement-policy";

export class SqliteEngagementPoliciesRepository implements EngagementPoliciesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findByAccountId(accountId: string): Promise<EngagementPolicy | null> {
    const row = this.db.get<{
      id: string;
      workspace_id: string;
      account_id: string;
      policy_body: string;
      status: EngagementPolicy["status"];
      updated_at: string;
    }>(
      `SELECT id, workspace_id, account_id, policy_body, status, updated_at
      FROM engagement_policies
      WHERE account_id = ?`,
      [accountId],
    );

    if (!row) {
      return null;
    }

    return {
      ...row,
      policy_body: JSON.parse(row.policy_body) as EngagementPolicy["policy_body"],
    };
  }

  async save(policy: EngagementPolicy): Promise<void> {
    this.db.run(
      `INSERT INTO engagement_policies (
        id, workspace_id, account_id, policy_body, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        policy_body = excluded.policy_body,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        policy.id,
        policy.workspace_id,
        policy.account_id,
        JSON.stringify(policy.policy_body),
        policy.status,
        policy.updated_at,
      ],
    );
  }
}
