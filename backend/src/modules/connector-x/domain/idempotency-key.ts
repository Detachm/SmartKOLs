import { requireNonEmptyString } from "../../../core/validation/guards";

export function createConnectorIdempotencyKey(parts: string[]): string {
  const normalized = parts.map((part, index) => requireNonEmptyString(part, `idempotency_key_part_${index}`));
  return normalized.join(":");
}
