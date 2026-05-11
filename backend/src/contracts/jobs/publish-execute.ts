export interface PublishExecuteJob {
  job_type: "publish.execute";
  publish_job_id: string;
  workspace_id: string;
  schedule_id: string;
  account_id: string;
  draft_id: string;
  idempotency_key: string;
  requested_at: string;
}
