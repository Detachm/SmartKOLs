import type { SqliteExecutor } from "../../../infrastructure/db/sqlite-executor";
import type { RateLimitBucketsRepository } from "../application/ports/rate-limit-buckets-repository";
import type { RateLimitBucket } from "../domain/rate-limit-bucket";

export class SqliteRateLimitBucketsRepository implements RateLimitBucketsRepository {
  constructor(private readonly db: SqliteExecutor) {}

  async save(bucket: RateLimitBucket): Promise<void> {
    this.db.run(
      `INSERT INTO connector_rate_limit_buckets (
        id, platform, credential_id, account_id, endpoint_code, window_key,
        limit_count, remaining_count, resets_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        credential_id = excluded.credential_id,
        account_id = excluded.account_id,
        endpoint_code = excluded.endpoint_code,
        window_key = excluded.window_key,
        limit_count = excluded.limit_count,
        remaining_count = excluded.remaining_count,
        resets_at = excluded.resets_at,
        updated_at = excluded.updated_at`,
      [
        bucket.id,
        bucket.platform,
        bucket.credential_id ?? null,
        bucket.account_id ?? null,
        bucket.endpoint_code,
        bucket.window_key,
        bucket.limit_count,
        bucket.remaining_count,
        bucket.resets_at,
        bucket.updated_at,
      ],
    );
  }
}
