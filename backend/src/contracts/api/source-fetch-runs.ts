import type { SourceFetchRun } from "../../modules/sources/domain/source-fetch-run";

export interface FetchSourceResponse {
  run_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  imported_count?: number;
}

export interface ExecuteSourceFetchRunResponse extends FetchSourceResponse {
  imported_count: number;
}

export interface SourceFetchRunListResponse {
  runs: SourceFetchRun[];
}
