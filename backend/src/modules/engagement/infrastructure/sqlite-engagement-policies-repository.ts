import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { EngagementPoliciesRepository } from "../application/ports/engagement-policies-repository";
import { sanitizeLegacyEngagementAutomationTargets } from "../application/engagement-policy-validation";
import { createEngagementPolicy, type EngagementPolicy } from "../domain/engagement-policy";

export class SqliteEngagementPoliciesRepository implements EngagementPoliciesRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async findByAccountId(accountId: string): Promise<EngagementPolicy | null> {
    const row = this.db.get<{
      id: string;
      workspace_id: string;
      account_id: string;
      account_handle: string;
      policy_body: string;
      status: EngagementPolicy["status"];
      updated_at: string;
    }>(
      `SELECT ep.id, ep.workspace_id, ep.account_id, ep.policy_body, ep.status, ep.updated_at, a.handle AS account_handle
      FROM engagement_policies ep
      INNER JOIN accounts a ON a.id = ep.account_id
      WHERE account_id = ?`,
      [accountId],
    );

    if (!row) {
      return null;
    }

    const normalized = createEngagementPolicy({
      ...row,
      policy_body: JSON.parse(row.policy_body) as EngagementPolicy["policy_body"],
    });
    const sanitized = sanitizeLegacyEngagementAutomationTargets(normalized.policy_body, row.account_handle);

    return sanitized.changed
      ? {
          ...normalized,
          policy_body: sanitized.policy_body,
        }
      : normalized;
  }

  async listActive(): Promise<EngagementPolicy[]> {
    const rows = this.db.all<{
      id: string;
      workspace_id: string;
      account_id: string;
      account_handle: string;
      policy_body: string;
      status: EngagementPolicy["status"];
      updated_at: string;
    }>(
      `SELECT ep.id, ep.workspace_id, ep.account_id, ep.policy_body, ep.status, ep.updated_at, a.handle AS account_handle
      FROM engagement_policies ep
      INNER JOIN accounts a ON a.id = ep.account_id
      WHERE ep.status = 'active'
      ORDER BY ep.updated_at ASC, ep.id ASC`,
    );

    return rows.map((row) => {
      const normalized = createEngagementPolicy({
        ...row,
        policy_body: JSON.parse(row.policy_body) as EngagementPolicy["policy_body"],
      });
      const sanitized = sanitizeLegacyEngagementAutomationTargets(normalized.policy_body, row.account_handle);

      return sanitized.changed
        ? {
            ...normalized,
            policy_body: sanitized.policy_body,
          }
        : normalized;
    });
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
