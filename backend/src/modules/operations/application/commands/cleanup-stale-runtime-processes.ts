import type { Clock } from "../../../../core/time/clock";
import { requireIntegerInRange } from "../../../../core/validation/guards";
import type { RuntimeProcessesRepository } from "../ports/runtime-processes-repository";
import { PROCESS_STALE_AFTER_MS } from "../../domain/operations-policy";

export interface CleanupStaleRuntimeProcessesDependencies {
  processes: RuntimeProcessesRepository;
  clock: Clock;
}

export interface CleanupStaleRuntimeProcessesInput {
  stale_after_ms?: number;
  limit?: number;
}

export interface CleanupStaleRuntimeProcessesResult {
  checked_at: string;
  stale_before: string;
  matched_count: number;
  updated_count: number;
  process_ids: string[];
}

export class CleanupStaleRuntimeProcesses {
  constructor(private readonly deps: CleanupStaleRuntimeProcessesDependencies) {}

  async execute(input: CleanupStaleRuntimeProcessesInput = {}): Promise<CleanupStaleRuntimeProcessesResult> {
    const checkedAt = this.deps.clock.now().toISOString();
    const staleAfterMs = requireIntegerInRange(
      input.stale_after_ms ?? PROCESS_STALE_AFTER_MS,
      "stale_after_ms",
      1_000,
      86_400_000,
    );
    const limit = requireIntegerInRange(input.limit ?? 200, "limit", 1, 1_000);
    const staleBefore = new Date(Date.parse(checkedAt) - staleAfterMs).toISOString();
    const result = await this.deps.processes.cleanupStaleRunningProcesses({
      stale_before: staleBefore,
      stopped_at: checkedAt,
      limit,
    });

    return {
      checked_at: checkedAt,
      stale_before: staleBefore,
      matched_count: result.matched_count,
      updated_count: result.updated_count,
      process_ids: result.process_ids,
    };
  }
}
