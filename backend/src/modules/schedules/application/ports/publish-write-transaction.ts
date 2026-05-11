import type { AuditLog } from "../../../audit/domain/audit-log";
import type { Draft } from "../../../drafts/domain/draft";
import type { Alert } from "../../../monitoring/domain/alert";
import type { PublishJob } from "../../domain/publish-job";
import type { PublishSchedule } from "../../domain/publish-schedule";

export interface PersistedPublishedPost {
  id: string;
  workspace_id: string;
  account_id: string;
  draft_id?: string;
  connector_request_id: string;
  external_post_id: string;
  external_post_url?: string;
  content: string;
  published_at: string;
}

export interface PublishWriteTransaction {
  commitPublishCompletion(input: {
    next_job: PublishJob;
    next_schedule: PublishSchedule;
    next_draft: Draft;
    published_post: PersistedPublishedPost;
    audit_log: AuditLog;
  }): Promise<void>;

  commitPublishFailure(input: {
    next_job: PublishJob;
    next_schedule: PublishSchedule;
    next_draft: Draft;
    audit_log: AuditLog;
    alert: Alert;
  }): Promise<void>;
}
