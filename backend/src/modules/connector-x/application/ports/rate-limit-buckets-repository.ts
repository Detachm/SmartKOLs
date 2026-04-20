import type { RateLimitBucket } from "../../domain/rate-limit-bucket";

export interface RateLimitBucketsRepository {
  save(bucket: RateLimitBucket): Promise<void>;
}
