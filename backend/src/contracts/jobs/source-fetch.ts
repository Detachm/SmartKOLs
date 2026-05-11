export interface SourceFetchJob {
  job_type: "source.fetch";
  source_fetch_run_id: string;
  source_id: string;
  requested_at: string;
}
