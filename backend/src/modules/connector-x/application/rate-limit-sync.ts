import { newId } from "../../../core/ids/new-id";
import type { RateLimitBucketsRepository } from "./ports/rate-limit-buckets-repository";
import type { TwitterRateLimitSnapshot } from "./ports/twitter-client";
import { createRateLimitBucket } from "../domain/rate-limit-bucket";

export async function syncRateLimitBucket(
  repository: RateLimitBucketsRepository,
  input: {
    credential_id: string;
    account_id: string;
    endpoint_code: string;
    rate_limit?: TwitterRateLimitSnapshot;
    updated_at: string;
  },
): Promise<void> {
  if (!input.rate_limit) {
    return;
  }

  await repository.save(createRateLimitBucket({
    id: newId(),
    platform: "x",
    credential_id: input.credential_id,
    account_id: input.account_id,
    endpoint_code: input.endpoint_code,
    window_key: input.rate_limit.window_key,
    limit_count: input.rate_limit.limit_count,
    remaining_count: input.rate_limit.remaining_count,
    resets_at: input.rate_limit.resets_at,
    updated_at: input.updated_at,
  }));
}
