import { requireNonEmptyString } from "../../../core/validation/guards";

export interface RateLimitBucket {
  id: string;
  platform: "x";
  credential_id?: string;
  account_id?: string;
  endpoint_code: string;
  window_key: string;
  limit_count: number;
  remaining_count: number;
  resets_at: string;
  updated_at: string;
}

export function createRateLimitBucket(bucket: RateLimitBucket): RateLimitBucket {
  return {
    id: requireNonEmptyString(bucket.id, "id"),
    platform: "x",
    credential_id: bucket.credential_id?.trim() || undefined,
    account_id: bucket.account_id?.trim() || undefined,
    endpoint_code: requireNonEmptyString(bucket.endpoint_code, "endpoint_code"),
    window_key: requireNonEmptyString(bucket.window_key, "window_key"),
    limit_count: bucket.limit_count,
    remaining_count: bucket.remaining_count,
    resets_at: requireNonEmptyString(bucket.resets_at, "resets_at"),
    updated_at: requireNonEmptyString(bucket.updated_at, "updated_at"),
  };
}
