import type { RuntimeProcess } from "../../domain/runtime-process";

export interface RuntimeProcessesRepository {
  upsertHeartbeat(process: RuntimeProcess): Promise<void>;
  markStopped(input: { process_id: string; stopped_at: string }): Promise<void>;
  cleanupStaleRunningProcesses(input: {
    stale_before: string;
    stopped_at: string;
    limit: number;
  }): Promise<{
    matched_count: number;
    updated_count: number;
    process_ids: string[];
  }>;
}
